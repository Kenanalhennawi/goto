-- ============================================================
-- GITHUB ACTIONS DISPATCHER
--
-- Replaces the permanent-worker model with a dispatch model, and replaces the
-- health contract that described it.
--
-- WHY
--   The worker was a Render Background Worker. Render's free compute covers web
--   services, Key Value and Postgres only; background workers start at $7/month,
--   and a free web service spins down when it receives no inbound HTTP — which a
--   queue poller never does. GitHub Actions runs the same Node + Python + Poppler
--   stack for free, so the worker became a finite job.
--
-- THE HONESTY PROBLEM THIS FIXES
--   sync_system_health() returned `workerOnline`, computed from a heartbeat
--   written by a process that no longer exists between jobs. Under Actions that
--   value is false almost all the time, which would make the admin UI shout
--   "worker offline" during completely normal operation — and, worse, would make
--   a REAL outage indistinguishable from idleness. There is no permanent process,
--   so the UI must stop claiming there is one and report what is actually true:
--   is a dispatcher configured, when did it last succeed, and is anything stuck.
--
-- SAFE: additive columns, one function replaced. No data is modified.
-- Rollback at the foot of the file.
-- ============================================================

-- ============================================================
-- 1. Per-run dispatch telemetry
-- ============================================================
-- Deliberately narrow. We store WHEN a dispatch was attempted and whether it
-- worked, plus a short machine-readable code. We never store the token, the
-- GitHub response body, or any header: a failed dispatch response can echo
-- request metadata, and this table is readable by every reviewer.
alter table public.sync_runs
  add column if not exists dispatch_attempted_at timestamptz,
  add column if not exists dispatch_succeeded_at timestamptz,
  add column if not exists dispatch_error_code   text;

comment on column public.sync_runs.dispatch_error_code is
  'Short machine code only (e.g. DISPATCH_UNAUTHORIZED, DISPATCH_TIMEOUT). '
  'Never a raw GitHub response, never a token.';

do $$ begin
  alter table public.sync_runs drop constraint if exists sync_runs_dispatch_error_code_check;
  alter table public.sync_runs add constraint sync_runs_dispatch_error_code_check
    check (dispatch_error_code is null or dispatch_error_code ~ '^[A-Z_]{3,40}$');
end $$;

-- Service role writes telemetry; the API route runs as the caller, so the
-- admin/owner UPDATE policy already covers the app path.

-- ============================================================
-- 2. Honest health contract
-- ============================================================
-- Return type changes, so the old signature must go first.
drop function if exists public.sync_system_health();

create or replace function public.sync_system_health()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    -- ---- queue truth ----
    'queueDepth',        (select count(*) from sync_runs where state = 'queued'),
    'oldestQueuedAt',    (select min(created_at) from sync_runs where state = 'queued'),
    'activeRun',         (select jsonb_build_object('id', id, 'state', state,
                                 'progressPct', progress_pct, 'message', progress_message,
                                 'startedAt', started_at)
                            from sync_runs
                           where state in ('validating','extracting','publishing')
                           order by created_at desc limit 1),

    -- ---- dispatcher truth (per-run telemetry, aggregated) ----
    'lastDispatchAttemptAt', (select max(dispatch_attempted_at) from sync_runs),
    'lastDispatchSuccessAt', (select max(dispatch_succeeded_at) from sync_runs),
    'lastDispatchErrorCode', (select dispatch_error_code from sync_runs
                               where dispatch_error_code is not null
                               order by dispatch_attempted_at desc nulls last limit 1),

    -- ---- processing truth ----
    -- Written while a job is in flight. It proves recent ACTIVITY; it does NOT
    -- prove a process is alive right now, and nothing here should be rendered
    -- as "online".
    'lastProcessingActivityAt', (select max(last_seen_at) from sync_worker_heartbeat),
    'latestCompletedRun', (select jsonb_build_object('id', id, 'state', state,
                                  'completedAt', completed_at, 'publishedAt', published_at,
                                  'errorCode', error_code)
                             from sync_runs
                            where state in ('published','failed','cancelled','staged')
                            order by coalesce(completed_at, published_at, created_at) desc
                            limit 1),
    'lastSuccessfulRunAt', (select max(published_at) from sync_runs where state = 'published'),
    'lastStagedAt',        (select max(completed_at) from sync_runs where state = 'staged'),

    -- ---- stuck detection ----
    -- A queued run older than this with no dispatch success means the dispatch
    -- was lost. It is NOT an error state: the scheduled recovery workflow picks
    -- it up. The UI says "waiting for dispatcher", never "offline".
    'stuckQueuedCount', (select count(*) from sync_runs
                          where state = 'queued'
                            and created_at < now() - make_interval(
                              secs => coalesce(public.sync_setting('dispatch_grace_seconds'), 900))),

    -- Reaching this function at all proves the consolidation migration applied.
    'migrationReady', true
  )
$$;
revoke all on function public.sync_system_health() from public, anon;
grant execute on function public.sync_system_health() to authenticated;

-- ============================================================
-- 3. Settings for the dispatch model
-- ============================================================
insert into public.sync_settings(key, value, description) values
  ('dispatch_grace_seconds', 900,
   'A queued run older than this with no successful dispatch is reported as waiting for the scheduled recovery workflow.')
on conflict (key) do nothing;

-- worker_offline_seconds described a permanent process and no longer means
-- anything. Left in place rather than deleted so an older deployed build that
-- still reads it does not break mid-rollout; it is simply unused.
comment on table public.sync_worker_heartbeat is
  'Processing ACTIVITY log, not a liveness signal. Under GitHub Actions there is '
  'no permanent process, so an old timestamp here means "idle", not "broken". '
  'Used by claim_sync_run to reclaim runs abandoned by an evicted job.';

-- ============================================================
-- ROLLBACK (inert - uncomment deliberately)
-- ============================================================
-- alter table public.sync_runs
--   drop column if exists dispatch_attempted_at,
--   drop column if exists dispatch_succeeded_at,
--   drop column if exists dispatch_error_code;
-- drop function if exists public.sync_system_health();
-- -- then recreate the previous workerOnline-based function from
-- -- 20260808000000_sync_platform_consolidation.sql section 9.
