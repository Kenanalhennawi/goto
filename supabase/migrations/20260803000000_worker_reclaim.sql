-- ============================================================
-- UPD-2.2: make queued sync jobs complete automatically.
--
-- Adds the two things the worker needs to be self-healing:
--   1. attempt tracking + heartbeat on sync_runs
--   2. claim_sync_run() also RECLAIMS runs abandoned by a crashed worker
--
-- Without the reclaim, a worker that dies mid-run leaves the job stranded in
-- 'validating'/'extracting' forever, because the previous claim only looked at
-- state = 'queued'.
--
-- Nothing here touches procedure cards, decision trees, chapters, RLS on
-- operational tables, or the atomic publish RPC.
-- Idempotent: safe to re-run.
-- ============================================================

alter table public.sync_runs
  add column if not exists attempt_count integer not null default 0,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists heartbeat_at timestamptz;

do $$ begin
  alter table public.sync_runs drop constraint if exists sync_runs_attempt_check;
  alter table public.sync_runs add constraint sync_runs_attempt_check check (
    attempt_count >= 0 and max_attempts >= 1 and max_attempts <= 10
  );
end $$;

create index if not exists sync_runs_heartbeat_idx
  on public.sync_runs (state, heartbeat_at)
  where state in ('validating', 'extracting');

-- ============================================================
-- claim_sync_run: queued first, then stale in-flight runs.
--
-- p_stale_after_seconds: a run whose heartbeat is older than this is treated
-- as abandoned. Runs that exceed max_attempts are failed instead of reclaimed,
-- so a poison job can never loop forever.
-- ============================================================
create or replace function public.claim_sync_run(
  p_worker_id text,
  p_stale_after_seconds integer default 900
)
returns public.sync_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.sync_runs;
  v_cutoff timestamptz := now() - make_interval(secs => greatest(p_stale_after_seconds, 60));
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role'
     and current_user not in ('service_role', 'postgres') then
    raise exception 'CLAIM_FORBIDDEN: only the background worker may claim runs';
  end if;

  -- 1. Fail out any stale run that has already used all of its attempts.
  update public.sync_runs set
    state = 'failed',
    progress_pct = 100,
    progress_message = 'Extraction failed',
    error_code = 'WORKER_STALLED',
    error_detail = 'The extraction worker stopped responding.',
    completed_at = now()
  where state in ('validating', 'extracting')
    and coalesce(heartbeat_at, claimed_at, created_at) < v_cutoff
    and attempt_count >= max_attempts;

  -- 2. Prefer a queued run; otherwise reclaim an abandoned in-flight run.
  select * into v_run
  from public.sync_runs
  where state = 'queued'
     or (
       state in ('validating', 'extracting')
       and coalesce(heartbeat_at, claimed_at, created_at) < v_cutoff
       and attempt_count < max_attempts
     )
  order by (state <> 'queued'), created_at asc
  for update skip locked
  limit 1;

  if v_run.id is null then
    return null;
  end if;

  update public.sync_runs set
    state = 'validating',
    claimed_at = now(),
    heartbeat_at = now(),
    claimed_by = p_worker_id,
    attempt_count = attempt_count + 1,
    started_at = coalesce(started_at, now()),
    progress_pct = 5,
    progress_message = 'Queued',
    error_code = null,
    error_detail = null
  where id = v_run.id
  returning * into v_run;

  return v_run;
end;
$$;

revoke all on function public.claim_sync_run(text, integer) from public, anon, authenticated;
grant execute on function public.claim_sync_run(text, integer) to service_role;

-- ============================================================
-- requeue_sync_run: bounded automatic retry for TRANSIENT failures only.
-- Permanent failures (invalid PDF, duplicate, older version, malformed
-- extractor output) are never requeued — they would fail identically.
-- ============================================================
create or replace function public.requeue_sync_run(p_run_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean := false;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role'
     and current_user not in ('service_role', 'postgres') then
    raise exception 'REQUEUE_FORBIDDEN: only the background worker may requeue runs';
  end if;

  update public.sync_runs set
    state = 'queued',
    progress_pct = 0,
    progress_message = 'Queued for retry',
    error_code = null,
    error_detail = left(coalesce(p_reason, ''), 300),
    heartbeat_at = null,
    claimed_by = null
  where id = p_run_id
    and attempt_count < max_attempts
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

revoke all on function public.requeue_sync_run(uuid, text) from public, anon, authenticated;
grant execute on function public.requeue_sync_run(uuid, text) to service_role;

-- ---------- Verification ----------
-- select id, state, attempt_count, max_attempts, heartbeat_at, error_code
--   from sync_runs order by created_at desc limit 10;
