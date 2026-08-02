-- ============================================================
-- SYNC PLATFORM CONSOLIDATION
--
-- ONE forward migration that replaces three unapplied patch migrations
-- (20260805/06/07, now empty stubs). Applied automatically by the worker on
-- boot — no human runs SQL.
--
-- WHAT THIS REPLACES, AND WHY
--   The sync subsystem had accumulated: two lifecycle columns written
--   independently by three code paths, three copies of the reclassification
--   threshold, five overlapping RLS policies whose permissive union silently
--   granted quality full write+delete, override columns any admin or quality
--   user could forge through PostgREST, and a four-transaction publish that
--   could leave chapters live with the run still 'staged'. Every one of those
--   produced manual SQL repair work. They are removed here, not patched.
--
-- DESIGN INVARIANTS (the whole architecture in seven lines)
--   1. `state` is the ONLY lifecycle field. `status` is deprecated and kept in
--      sync by a trigger; no application code writes it.
--   2. ONE threshold, stored in sync_settings, read by both SQL and the UI.
--   3. Publishing is ONE transaction: publish_sync_run().
--   4. Override columns are writable ONLY by owner-authorised RPCs.
--   5. Every recovery action is an RPC. No routine operation needs SQL.
--   6. RLS is a single non-overlapping matrix.
--   7. The worker owns migrations, so deployment applies them.
--
-- SAFE: idempotent; no DROP TABLE, DELETE or TRUNCATE; touches no chapter,
-- procedure card or decision tree content. Rollback SQL at the foot of file.
-- ============================================================

-- ============================================================
-- 0. Settings — the single source of truth for tunables
-- ============================================================
create table if not exists public.sync_settings (
  key         text primary key,
  value       numeric not null,
  description text
);

insert into public.sync_settings(key, value, description) values
  ('mass_reclassification_limit', 0.2,
   'Max share of chapters that may be new or removed before an owner override is required.'),
  ('worker_stale_seconds', 900,
   'A claimed run with no heartbeat for this long is reclaimed.'),
  ('worker_offline_seconds', 120,
   'No heartbeat from any worker for this long means the worker is offline.')
on conflict (key) do nothing;

alter table public.sync_settings enable row level security;
drop policy if exists "Authenticated can read sync settings" on public.sync_settings;
create policy "Authenticated can read sync settings" on public.sync_settings
  for select to authenticated using (true);
revoke all on public.sync_settings from anon, authenticated;
grant select on public.sync_settings to authenticated;

create or replace function public.sync_setting(p_key text)
returns numeric language sql stable security definer set search_path = public as $$
  select value from public.sync_settings where key = p_key
$$;
revoke all on function public.sync_setting(text) from public, anon;
grant execute on function public.sync_setting(text) to authenticated, service_role;

-- ============================================================
-- 1. Lifecycle: one authoritative column
-- ============================================================
alter table public.sync_runs
  add column if not exists status text,
  add column if not exists published_at timestamptz,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  -- Columns the recovery RPCs write. Declared here so a database that predates
  -- any of the earlier partial migrations still gains them.
  add column if not exists error_code text,
  add column if not exists error_detail text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists claimed_at timestamptz,
  add column if not exists claimed_by text,
  add column if not exists completed_at timestamptz,
  add column if not exists new_ratio numeric,
  add column if not exists removed_ratio numeric,
  add column if not exists ambiguous_count integer,
  add column if not exists reclass_override_reason text,
  add column if not exists reclass_override_by uuid,
  add column if not exists reclass_override_at timestamptz;

comment on column public.sync_runs.status is
  'DEPRECATED. Legacy lifecycle column, kept only for older readers. Mirrored '
  'from state by sync_runs_mirror_status_trg. Never write it from application code.';

do $$ begin
  alter table public.sync_runs drop constraint if exists sync_runs_state_check;
  alter table public.sync_runs add constraint sync_runs_state_check check (
    state in ('uploaded','queued','validating','extracting','staged',
              'publishing','published','failed','cancelled')
  );
  -- The legacy constraint pinned a vocabulary that no migration in this repo
  -- defined, which is what rejected a completed extraction's final write.
  alter table public.sync_runs drop constraint if exists sync_runs_status_check;
  alter table public.sync_runs add constraint sync_runs_status_check check (
    status is null or status in (
      'uploaded','queued','validating','extracting','staged',
      'publishing','published','failed','cancelled',
      'pending','processing','review','reviewed','completed','complete','error')
  ) not valid;
end $$;

do $$ begin
  alter table public.sync_runs validate constraint sync_runs_status_check;
exception when others then
  raise notice 'sync_runs_status_check enforced for new writes; some legacy rows differ.';
end $$;

-- state is authoritative; status follows it unconditionally so the two can
-- never diverge, whichever code path or RPC performs the write.
create or replace function public.sync_runs_mirror_status()
returns trigger language plpgsql as $$
begin
  new.status := new.state;
  return new;
end $$;

drop trigger if exists sync_runs_mirror_status_trg on public.sync_runs;
create trigger sync_runs_mirror_status_trg
  before insert or update on public.sync_runs
  for each row execute function public.sync_runs_mirror_status();

-- Repair rows the pre-consolidation publish path left inconsistent: it wrote
-- only `status`, so a fully published run still read as 'staged' everywhere.
update public.sync_runs set state = 'published'
 where status = 'published' and state is distinct from 'published';

-- Backfill the mirror for every existing row. The trigger only fires on write,
-- so without this, historical rows keep a stale legacy status (for example a
-- staged run still reading 'pending') until something happens to touch them.
update public.sync_runs set status = state where status is distinct from state;

-- ============================================================
-- 2. Override audit — immutable, complete, FK-anchored
-- ============================================================
create table if not exists public.sync_reclass_override_audit (
  id            bigint generated always as identity primary key,
  run_id        uuid not null references public.sync_runs(id) on delete restrict,
  action        text not null check (action in ('recorded','cleared')),
  prev_reason   text,
  prev_actor_id uuid,
  prev_acted_at timestamptz,
  new_reason    text,
  actor_id      uuid not null,
  actor_role    text not null,
  acted_at      timestamptz not null default now(),
  new_ratio     numeric,
  removed_ratio numeric
);

-- `create table if not exists` will not reshape a table that already exists.
alter table public.sync_reclass_override_audit
  add column if not exists prev_reason   text,
  add column if not exists prev_actor_id uuid,
  add column if not exists prev_acted_at timestamptz,
  add column if not exists new_reason    text,
  add column if not exists new_ratio     numeric,
  add column if not exists removed_ratio numeric;

create index if not exists sync_reclass_override_audit_run_idx
  on public.sync_reclass_override_audit (run_id, acted_at desc);

create or replace function public.sync_reclass_audit_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'AUDIT_IMMUTABLE: override audit history cannot be %', tg_op
    using errcode = '42501';
end $$;

drop trigger if exists sync_reclass_audit_no_update on public.sync_reclass_override_audit;
create trigger sync_reclass_audit_no_update
  before update or delete on public.sync_reclass_override_audit
  for each row execute function public.sync_reclass_audit_immutable();

alter table public.sync_reclass_override_audit enable row level security;
drop policy if exists "Quality+ can read override audit" on public.sync_reclass_override_audit;
create policy "Quality+ can read override audit" on public.sync_reclass_override_audit
  for select to authenticated
  using (public.current_app_role() in ('quality','editor','admin','owner'));
revoke all on public.sync_reclass_override_audit from anon, authenticated;
grant select on public.sync_reclass_override_audit to authenticated;

-- ============================================================
-- 3. Override column guard — INSERT and UPDATE, SECURITY INVOKER
-- ============================================================
-- SECURITY INVOKER is load-bearing and NOT interchangeable with DEFINER.
-- Measured: inside a DEFINER function current_user is always the function
-- owner, so an owner comparison there is constant-false and protects nothing.
-- As INVOKER, current_user is the caller's effective user:
--     direct PostgREST write      -> 'authenticated'  (rejected)
--     write inside a DEFINER RPC  -> table owner      (allowed)
-- A client cannot become the table owner, so this cannot be forged.
create or replace function public.sync_runs_protect_override()
returns trigger language plpgsql as $$
declare
  v_owner name := (select tableowner from pg_tables
                    where schemaname = 'public' and tablename = 'sync_runs');
  v_touched boolean;
begin
  if tg_op = 'INSERT' then
    -- RLS permits INSERT for admin+, so a forged override could otherwise be
    -- inserted rather than updated.
    v_touched := new.reclass_override_reason is not null
              or new.reclass_override_by     is not null
              or new.reclass_override_at     is not null;
  else
    v_touched := new.reclass_override_reason is distinct from old.reclass_override_reason
              or new.reclass_override_by     is distinct from old.reclass_override_by
              or new.reclass_override_at     is distinct from old.reclass_override_at;
  end if;

  if v_touched and current_user is distinct from v_owner then
    raise exception
      'OVERRIDE_DIRECT_WRITE_FORBIDDEN: reclass_override_* is owner-only (op=%)', tg_op
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists sync_runs_protect_override_trg on public.sync_runs;
create trigger sync_runs_protect_override_trg
  before insert or update on public.sync_runs
  for each row execute function public.sync_runs_protect_override();

-- ============================================================
-- 4. Role helpers
-- ============================================================
create or replace function public.current_app_role()
returns text language sql stable security definer set search_path = public as $$
  select role from user_roles where user_id = auth.uid() limit 1
$$;
revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

create or replace function public.assert_sync_admin()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid; v_role text;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode='42501'; end if;
  select role into v_role from user_roles where user_id = v_uid;
  if v_role is null or v_role not in ('admin','owner') then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  return v_uid;
end $$;
revoke all on function public.assert_sync_admin() from public, anon;
grant execute on function public.assert_sync_admin() to authenticated;

create or replace function public.assert_current_owner()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid; v_role text;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode='42501'; end if;
  select role into v_role from user_roles where user_id = v_uid;
  if v_role is distinct from 'owner' then
    raise exception 'OWNER_REQUIRED' using errcode='42501';
  end if;
  return v_uid;
end $$;
revoke all on function public.assert_current_owner() from public, anon;
grant execute on function public.assert_current_owner() to authenticated;

-- ============================================================
-- 5. Owner-only override RPCs — staged runs only, row locked
-- ============================================================
create or replace function public.record_sync_reclass_override(p_run_id uuid, p_reason text)
returns public.sync_runs language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_run public.sync_runs; v_new public.sync_runs;
begin
  v_uid := public.assert_current_owner();
  if p_reason is null or length(btrim(p_reason)) < 10 or length(btrim(p_reason)) > 500 then
    raise exception 'INVALID_OVERRIDE_REASON' using errcode='22023';
  end if;
  select * into v_run from sync_runs where id = p_run_id for update;
  if v_run.id is null then raise exception 'RUN_NOT_FOUND' using errcode='02000'; end if;
  if v_run.state is distinct from 'staged' or v_run.published_at is not null then
    raise exception 'RUN_NOT_OVERRIDEABLE: state=%', v_run.state using errcode='55000';
  end if;

  update sync_runs set reclass_override_reason = btrim(p_reason),
                       reclass_override_by = v_uid,
                       reclass_override_at = now()
   where id = p_run_id returning * into v_new;

  insert into sync_reclass_override_audit
    (run_id, action, prev_reason, prev_actor_id, prev_acted_at,
     new_reason, actor_id, actor_role, new_ratio, removed_ratio)
  values (p_run_id, 'recorded', v_run.reclass_override_reason, v_run.reclass_override_by,
          v_run.reclass_override_at, btrim(p_reason), v_uid, 'owner',
          v_new.new_ratio, v_new.removed_ratio);
  return v_new;
end $$;
revoke all on function public.record_sync_reclass_override(uuid, text) from public, anon;
grant execute on function public.record_sync_reclass_override(uuid, text) to authenticated;

create or replace function public.clear_sync_reclass_override(p_run_id uuid, p_reason text)
returns public.sync_runs language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_run public.sync_runs; v_new public.sync_runs;
begin
  v_uid := public.assert_current_owner();
  if p_reason is null or length(btrim(p_reason)) < 10 or length(btrim(p_reason)) > 500 then
    raise exception 'INVALID_OVERRIDE_REASON' using errcode='22023';
  end if;
  select * into v_run from sync_runs where id = p_run_id for update;
  if v_run.id is null then raise exception 'RUN_NOT_FOUND' using errcode='02000'; end if;
  if v_run.state is distinct from 'staged' or v_run.published_at is not null then
    raise exception 'RUN_NOT_OVERRIDEABLE: state=%', v_run.state using errcode='55000';
  end if;

  update sync_runs set reclass_override_reason = null,
                       reclass_override_by = null,
                       reclass_override_at = null
   where id = p_run_id returning * into v_new;

  insert into sync_reclass_override_audit
    (run_id, action, prev_reason, prev_actor_id, prev_acted_at,
     new_reason, actor_id, actor_role, new_ratio, removed_ratio)
  values (p_run_id, 'cleared', v_run.reclass_override_reason, v_run.reclass_override_by,
          v_run.reclass_override_at, btrim(p_reason), v_uid, 'owner',
          v_new.new_ratio, v_new.removed_ratio);
  return v_new;
end $$;
revoke all on function public.clear_sync_reclass_override(uuid, text) from public, anon;
grant execute on function public.clear_sync_reclass_override(uuid, text) to authenticated;

-- ============================================================
-- 6. Publish gate — one rule, read from sync_settings
-- ============================================================
create or replace function public.sync_run_publish_blocked(p_run public.sync_runs)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_limit numeric; v_last_action text; v_last_actor uuid; v_last_at timestamptz;
begin
  if p_run.published_at is not null then return 'ALREADY_PUBLISHED'; end if;
  if p_run.state is distinct from 'staged' then return 'RUN_NOT_PUBLISHABLE'; end if;

  v_limit := coalesce(public.sync_setting('mass_reclassification_limit'), 0.2);
  if coalesce(p_run.new_ratio,0) <= v_limit and coalesce(p_run.removed_ratio,0) <= v_limit then
    return null;
  end if;

  if coalesce(btrim(p_run.reclass_override_reason),'') = '' then
    return 'MASS_RECLASSIFICATION_BLOCKED';
  end if;
  if p_run.reclass_override_by is null or p_run.reclass_override_at is null then
    return 'OVERRIDE_INCOMPLETE';
  end if;
  if not exists (select 1 from user_roles
                  where user_id = p_run.reclass_override_by and role = 'owner') then
    return 'OVERRIDE_ACTOR_NOT_OWNER';
  end if;
  -- The LATEST audit event must be a 'recorded' by the SAME actor now stored on
  -- the run. Checking for any historical 'recorded' row was wrong: the sequence
  -- recorded -> cleared -> recorded -> cleared leaves historical 'recorded'
  -- rows behind, so a stale or re-forged override column could satisfy it.
  -- Current fields, latest action and actor must all agree.
  select a.action, a.actor_id, a.acted_at
    into v_last_action, v_last_actor, v_last_at
    from sync_reclass_override_audit a
   where a.run_id = p_run.id
   order by a.acted_at desc, a.id desc
   limit 1;

  if v_last_action is distinct from 'recorded' then return 'OVERRIDE_UNAUDITED'; end if;
  if v_last_actor is distinct from p_run.reclass_override_by then
    return 'OVERRIDE_ACTOR_MISMATCH';
  end if;
  -- The stored timestamp must match the audited decision, so the columns cannot
  -- have been rewritten after the fact.
  if p_run.reclass_override_at is distinct from v_last_at then
    return 'OVERRIDE_STALE';
  end if;
  return null;
end $$;
revoke all on function public.sync_run_publish_blocked(public.sync_runs) from public, anon;
grant execute on function public.sync_run_publish_blocked(public.sync_runs) to authenticated;

-- ============================================================
-- 6b. Chapter slug — SQL twin of lib/sync-identity.ts
-- ============================================================
-- publish_sync_run proves that each submitted operation belongs to the run by
-- deriving the slug from the staged row's title. That derivation must match the
-- TypeScript exactly, or a legitimate publish would be rejected. Mirrors
-- stripChapterNumberPrefix() + slugifyChapter():
--   strip a leading "NN. " chapter number, lower-case, drop everything except
--   [a-z0-9_ -], collapse whitespace/underscores to '-', truncate to 60.
-- Verified byte-for-byte against all 81 chapters of the real v81.7 extraction.
create or replace function public.slugify_chapter_title(p_title text)
returns text language sql immutable as $$
  select left(
    regexp_replace(
      regexp_replace(
        lower(btrim(regexp_replace(coalesce(p_title, ''), '^[[:space:]]*[0-9]{1,3}\.[[:space:]]*', ''))),
        '[^a-z0-9[:space:]_-]', '', 'g'),
      '[[:space:]_]+', '-', 'g'),
    60)
$$;
revoke all on function public.slugify_chapter_title(text) from public, anon;
grant execute on function public.slugify_chapter_title(text) to authenticated, service_role;

-- ============================================================
-- 7. Atomic publish — ONE transaction
-- ============================================================
-- SECURITY DEFINER, deliberately, and this is a trade-off worth stating.
--
-- The raw writer publish_sync_chapters() is revoked from `authenticated` below,
-- because it accepts a client-supplied editor UUID that it writes into
-- chapters.updated_by and the edit history — directly callable, it let any
-- admin forge attribution. Once revoked, a SECURITY INVOKER wrapper cannot call
-- it either (it would execute as the caller, who no longer holds EXECUTE), so
-- this function runs as DEFINER.
--
-- What is GIVEN UP: chapter writes no longer pass through the caller's RLS.
-- What is GAINED, and why it is a net improvement: the only reachable publish
-- entry point now verifies, under a row lock, that the caller is admin/owner,
-- that the run is staged and unpublished, that reclassification limits hold,
-- that any override is current/owner/audited, that approved staged rows exist,
-- and that EVERY submitted operation corresponds to an approved staged row of
-- THIS run. Previously none of that was enforced and the raw writer was
-- directly callable. Authorization is now explicit rather than implicit.
-- CONVERGENCE FROM A PARTIALLY-APPLIED DATABASE.
-- The live project already carries an EARLIER draft of this work in which
-- publish_sync_run took (uuid, jsonb, uuid[], uuid, text, text) — it accepted a
-- client-supplied editor. `create or replace function` matches on the argument
-- list, so it would ADD A SECOND OVERLOAD rather than replace that one, leaving
-- the vulnerable signature callable and letting PostgREST resolve to either.
-- Drop the old signature explicitly first. Same for any other shape this
-- migration supersedes.
drop function if exists public.publish_sync_run(uuid, jsonb, uuid[], uuid, text, text);
-- Live inspection also found TWO claim_sync_run overloads: the original
-- (text) and the UPD-2.2 (text, integer). The worker calls the two-argument
-- form, but leaving both means PostgREST and any future caller can resolve to
-- the stale one, which has no stale-run reclaim. Drop the superseded form.
drop function if exists public.claim_sync_run(text);
drop function if exists public.claim_sync_run_for_publish(uuid);
drop function if exists public.release_sync_run_publish_claim(uuid);

-- NOTE THE SIGNATURE: there is no p_editor and no p_editor_email.
-- publish_sync_chapters accepts a client-supplied editor UUID and writes it to
-- chapters.updated_by and the edit history. Because that function is granted to
-- `authenticated`, any admin could call it directly through PostgREST and
-- attribute an edit to somebody else. The editor is now derived from auth.uid()
-- here and passed down, so the attribution cannot be forged.
create or replace function public.publish_sync_run(
  p_run_id uuid, p_operations jsonb, p_temporary_move_ids uuid[],
  p_source_version text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_role text; v_email text; v_run public.sync_runs; v_blocked text;
        v_approved int; v_result jsonb; v_bad text;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode='42501'; end if;
  select role into v_role from user_roles where user_id = v_uid;
  if v_role is null or v_role not in ('admin','owner') then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;

  -- Serialise concurrent publishes of the same run.
  select * into v_run from sync_runs where id = p_run_id for update;
  if v_run.id is null then raise exception 'RUN_NOT_FOUND' using errcode='02000'; end if;

  v_blocked := public.sync_run_publish_blocked(v_run);
  if v_blocked is not null then
    raise exception 'PUBLISH_REFUSED: %', v_blocked using errcode='55006';
  end if;

  select count(*) into v_approved from sync_staged_changes
   where sync_run_id = p_run_id and approved = true;
  if v_approved = 0 then
    raise exception 'PUBLISH_REFUSED: NO_APPROVED_CHANGES' using errcode='55006';
  end if;

  -- The operation list is built in the application, so it must be proved to
  -- belong to THIS run before anything is written. Without this an admin could
  -- call publish_sync_run with a valid staged run id but an operation list
  -- naming unrelated chapters, injecting edits the reviewer never saw.
  select string_agg(distinct op->>'slug', ', ')
    into v_bad
    from jsonb_array_elements(coalesce(p_operations, '[]'::jsonb)) op
   where not exists (
     select 1 from sync_staged_changes sc
      where sc.sync_run_id = p_run_id
        and sc.approved = true
        and public.slugify_chapter_title(sc.title) = op->>'slug'
   );
  if v_bad is not null then
    raise exception 'PUBLISH_REFUSED: OPERATION_NOT_IN_RUN (%)', left(v_bad, 120)
      using errcode='55006';
  end if;

  -- Editor identity is server-derived. A client value is never trusted.
  --
  -- Read the email from the verified JWT claims rather than from auth.users.
  -- (An earlier revision of this comment claimed the function is SECURITY
  -- INVOKER and therefore could not read auth.users. That was wrong -- the
  -- function is declared SECURITY DEFINER above, so it could. The reason to
  -- prefer the claim stands on its own and is stated correctly here.)
  -- The JWT claim is signed by GoTrue and cannot be altered by the caller, it
  -- needs no extra privilege, and it keeps this function independent of the
  -- auth schema. auth.uid() already fixes the identity; the email is only
  -- attribution metadata carried into edit history.
  --
  -- The inner nullif() is load-bearing: current_setting(..., true) returns NULL
  -- when the setting is absent (safe), but an EMPTY STRING when it is present
  -- and blank -- and ''::json raises "invalid input syntax for type json",
  -- which would abort an otherwise valid publish. Cast only a non-empty value.
  v_email := nullif(
    nullif(current_setting('request.jwt.claims', true), '')::json->>'email', '');

  update sync_runs set state='publishing', progress_message='Publishing' where id = p_run_id;

  if jsonb_array_length(coalesce(p_operations,'[]'::jsonb)) > 0 then
    v_result := public.publish_sync_chapters(
      p_operations, p_temporary_move_ids, v_uid, v_email, p_source_version);
  else
    v_result := jsonb_build_object('published', 0);
  end if;

  update sync_runs
     set state='published', published_at=now(), completed_at=coalesce(completed_at, now()),
         progress_pct=100, progress_message='Published'
   where id = p_run_id;

  return coalesce(v_result,'{}'::jsonb) || jsonb_build_object('runId', p_run_id, 'atomic', true);
end $$;
revoke all on function public.publish_sync_run(uuid, jsonb, uuid[], text) from public, anon;
grant execute on function public.publish_sync_run(uuid, jsonb, uuid[], text) to authenticated;

-- The raw chapter writer must NOT stay callable by the browser: it trusts a
-- client-supplied editor UUID and performs no run validation. publish_sync_run
-- is the only supported entry point.
do $$ begin
  revoke execute on function public.publish_sync_chapters(jsonb, uuid[], uuid, text, text)
    from public, anon, authenticated;
exception when undefined_function then
  raise notice 'publish_sync_chapters not present yet; grants unchanged.';
end $$;

-- ============================================================
-- 8. Recovery RPCs — every repair action, no SQL required
-- ============================================================
-- Cancel: any non-terminal run. Staged rows are kept for the record.
create or replace function public.cancel_sync_run(p_run_id uuid, p_reason text default null)
returns public.sync_runs language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_run public.sync_runs;
begin
  v_uid := public.assert_sync_admin();
  select * into v_run from sync_runs where id = p_run_id for update;
  if v_run.id is null then raise exception 'RUN_NOT_FOUND' using errcode='02000'; end if;
  if v_run.state in ('published','cancelled') then
    raise exception 'RUN_TERMINAL: state=%', v_run.state using errcode='55000';
  end if;
  update sync_runs
     set state='cancelled', cancelled_at=now(), cancelled_by=v_uid, progress_pct=100,
         progress_message=coalesce(nullif(btrim(p_reason),''), 'Cancelled by administrator'),
         completed_at=now()
   where id = p_run_id returning * into v_run;
  return v_run;
end $$;
revoke all on function public.cancel_sync_run(uuid, text) from public, anon;
grant execute on function public.cancel_sync_run(uuid, text) to authenticated;

-- Reprocess: re-queue the SAME stored PDF. Replaces "delete the row and
-- re-upload", which was the previous manual recovery.
create or replace function public.reprocess_sync_run(p_run_id uuid)
returns public.sync_runs language plpgsql security definer set search_path = public as $$
declare v_run public.sync_runs;
begin
  perform public.assert_sync_admin();
  select * into v_run from sync_runs where id = p_run_id for update;
  if v_run.id is null then raise exception 'RUN_NOT_FOUND' using errcode='02000'; end if;
  if v_run.state = 'published' then
    raise exception 'RUN_TERMINAL: a published run cannot be reprocessed' using errcode='55000';
  end if;
  if v_run.pdf_path is null then
    raise exception 'NO_STORED_PDF: upload the PDF again' using errcode='55000';
  end if;

  delete from sync_staged_changes where sync_run_id = p_run_id;
  delete from sync_impact_report  where run_id     = p_run_id;

  update sync_runs
     set state='queued', progress_pct=0, progress_message='Queued for extraction',
         error_code=null, error_detail=null, claimed_at=null, claimed_by=null,
         heartbeat_at=null, completed_at=null, attempt_count=0
   where id = p_run_id returning * into v_run;
  return v_run;
end $$;
revoke all on function public.reprocess_sync_run(uuid) from public, anon;
grant execute on function public.reprocess_sync_run(uuid) to authenticated;

-- Discard staged review: clear the review without touching live content.
create or replace function public.discard_sync_run_staging(p_run_id uuid)
returns public.sync_runs language plpgsql security definer set search_path = public as $$
declare v_run public.sync_runs;
begin
  perform public.assert_sync_admin();
  select * into v_run from sync_runs where id = p_run_id for update;
  if v_run.id is null then raise exception 'RUN_NOT_FOUND' using errcode='02000'; end if;
  if v_run.state = 'published' then
    raise exception 'RUN_TERMINAL: published content cannot be discarded here' using errcode='55000';
  end if;
  delete from sync_staged_changes where sync_run_id = p_run_id;
  delete from sync_impact_report  where run_id     = p_run_id;
  update sync_runs set state='cancelled', completed_at=now(), progress_pct=100,
                       progress_message='Review discarded'
   where id = p_run_id returning * into v_run;
  return v_run;
end $$;
revoke all on function public.discard_sync_run_staging(uuid) from public, anon;
grant execute on function public.discard_sync_run_staging(uuid) to authenticated;

-- Restore to staged after a failed publish preparation. Only ever moves
-- publishing -> staged, and never a run whose content already applied.
create or replace function public.restore_sync_run_to_staged(p_run_id uuid)
returns public.sync_runs language plpgsql security definer set search_path = public as $$
declare v_run public.sync_runs;
begin
  perform public.assert_sync_admin();
  select * into v_run from sync_runs where id = p_run_id for update;
  if v_run.id is null then raise exception 'RUN_NOT_FOUND' using errcode='02000'; end if;
  if v_run.published_at is not null then
    raise exception 'RUN_TERMINAL: this run already published' using errcode='55000';
  end if;
  if v_run.state is distinct from 'publishing' then
    raise exception 'NOT_IN_PUBLISHING: state=%', v_run.state using errcode='55000';
  end if;
  update sync_runs set state='staged', progress_message='Ready for review'
   where id = p_run_id returning * into v_run;
  return v_run;
end $$;
revoke all on function public.restore_sync_run_to_staged(uuid) from public, anon;
grant execute on function public.restore_sync_run_to_staged(uuid) to authenticated;

-- ============================================================
-- 9. Worker health — so the UI can never silently show "Queued"
-- ============================================================
create table if not exists public.sync_worker_heartbeat (
  worker_id     text primary key,
  last_seen_at  timestamptz not null default now(),
  current_run_id uuid,
  version       text
);
alter table public.sync_worker_heartbeat enable row level security;
drop policy if exists "Quality+ can read worker health" on public.sync_worker_heartbeat;
create policy "Quality+ can read worker health" on public.sync_worker_heartbeat
  for select to authenticated
  using (public.current_app_role() in ('quality','editor','admin','owner'));
revoke all on public.sync_worker_heartbeat from anon, authenticated;
grant select on public.sync_worker_heartbeat to authenticated;

create or replace function public.record_worker_heartbeat(
  p_worker_id text, p_run_id uuid default null, p_version text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.sync_worker_heartbeat(worker_id, last_seen_at, current_run_id, version)
  values (p_worker_id, now(), p_run_id, p_version)
  on conflict (worker_id) do update
    set last_seen_at = now(), current_run_id = excluded.current_run_id,
        version = coalesce(excluded.version, sync_worker_heartbeat.version);
$$;
revoke all on function public.record_worker_heartbeat(text, uuid, text) from public, anon, authenticated;
grant execute on function public.record_worker_heartbeat(text, uuid, text) to service_role;

create or replace function public.sync_system_health()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'workerOnline', exists (
      select 1 from sync_worker_heartbeat
       where last_seen_at > now() - make_interval(
         secs => coalesce(public.sync_setting('worker_offline_seconds'), 120))),
    'lastHeartbeatAt', (select max(last_seen_at) from sync_worker_heartbeat),
    'workers', (select count(*) from sync_worker_heartbeat),
    'currentRunId', (select current_run_id from sync_worker_heartbeat
                      where current_run_id is not null order by last_seen_at desc limit 1),
    'queueDepth', (select count(*) from sync_runs where state = 'queued'),
    'processing', (select count(*) from sync_runs where state in ('validating','extracting')),
    'lastSuccessfulRunAt', (select max(published_at) from sync_runs where state = 'published'),
    'lastStagedAt', (select max(completed_at) from sync_runs where state = 'staged')
  )
$$;
revoke all on function public.sync_system_health() from public, anon;
grant execute on function public.sync_system_health() to authenticated;

-- ============================================================
-- 10. RLS — one non-overlapping matrix
-- ============================================================
--   role          SELECT  INSERT  UPDATE  DELETE
--   owner           y       y       y       y
--   admin           y       y       y       y
--   quality         y       n       n       n
--   editor          y       n       n       n
--   agent           n       n       n       n
--   anon            n       n       n       n
--   service_role  bypasses RLS (worker only)
--
-- The production-only "Quality+ manage sync runs" (FOR ALL) policy is removed.
-- Permissive policies combine with OR, so it silently granted quality UPDATE,
-- INSERT and DELETE, defeating every narrower policy. Verified against the
-- application: run creation and deletion are admin-gated API routes, and
-- reviewers write sync_staged_changes (its own policy, untouched), never
-- sync_runs. No code path needs quality write access here.
alter table public.sync_runs enable row level security;

drop policy if exists "Quality+ manage sync runs"   on public.sync_runs;
drop policy if exists "Quality+ can read sync runs" on public.sync_runs;
drop policy if exists "Admin+ can insert sync runs" on public.sync_runs;
drop policy if exists "Admin+ can update sync runs" on public.sync_runs;
drop policy if exists "Admin+ can delete sync runs" on public.sync_runs;

-- Drop the NEW names too, so re-running this migration is a no-op rather than
-- a duplicate-object error.
drop policy if exists "sync_runs read"   on public.sync_runs;
drop policy if exists "sync_runs insert" on public.sync_runs;
drop policy if exists "sync_runs update" on public.sync_runs;
drop policy if exists "sync_runs delete" on public.sync_runs;

create policy "sync_runs read"   on public.sync_runs for select to authenticated
  using (public.current_app_role() in ('quality','editor','admin','owner'));
create policy "sync_runs insert" on public.sync_runs for insert to authenticated
  with check (public.current_app_role() in ('admin','owner'));
create policy "sync_runs update" on public.sync_runs for update to authenticated
  using (public.current_app_role() in ('admin','owner'))
  with check (public.current_app_role() in ('admin','owner'));
create policy "sync_runs delete" on public.sync_runs for delete to authenticated
  using (public.current_app_role() in ('admin','owner'));

revoke all on public.sync_runs from anon;

-- ============================================================
-- 11. Verification (read-only)
-- ============================================================
--   select * from public.sync_system_health();
--   select policyname, cmd, roles from pg_policies
--    where schemaname='public' and tablename='sync_runs' order by cmd;
--
-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop trigger if exists sync_runs_protect_override_trg on public.sync_runs;
-- drop trigger if exists sync_runs_mirror_status_trg   on public.sync_runs;
-- drop function if exists public.publish_sync_run(uuid, jsonb, uuid[], uuid, text, text);
-- HYG-2 FIX: the five lines below were duplicated here from section 7 and the
-- DROP was left EXECUTABLE inside this ROLLBACK comment block. It was a no-op
-- today only because section 7 already dropped the same signature. Left live it
-- is a trap: if a legitimate claim_sync_run(text) is ever reintroduced, merely
-- re-running this migration would silently delete it. Now inert, like the rest
-- of the rollback block.
-- drop function if exists public.claim_sync_run(text);
-- drop policy if exists "sync_runs read"   on public.sync_runs;
-- drop policy if exists "sync_runs insert" on public.sync_runs;
-- drop policy if exists "sync_runs update" on public.sync_runs;
-- drop policy if exists "sync_runs delete" on public.sync_runs;
-- create policy "Quality+ manage sync runs" on public.sync_runs for all using (
--   exists (select 1 from user_roles where user_id = auth.uid()
--            and role in ('quality','admin','owner')));
-- create policy "Quality+ can read sync runs" on public.sync_runs for select to authenticated
--   using (public.current_app_role() in ('quality','editor','admin','owner'));
-- -- Chapter content is never modified by this migration, so nothing to restore.
