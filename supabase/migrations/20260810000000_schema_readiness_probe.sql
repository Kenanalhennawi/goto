-- ============================================================
-- SCHEMA READINESS PROBE
--
-- WHY THIS EXISTS
--   worker/migrate.mjs refuses to start against a schema it does not
--   understand. Its original check called each required RPC with NO arguments
--   and treated PGRST202 as proof of absence, on the stated assumption that
--   "a wrong-arguments error still proves the function EXISTS".
--
--   That assumption is false. PostgREST resolves a function by name AND
--   argument list. A function with REQUIRED parameters can never be matched by
--   a no-argument call, so it answers PGRST202 — indistinguishable from a
--   function that genuinely does not exist.
--
--   Consequence, observed on a live staging Actions run: claim_sync_run(text,
--   integer), requeue_sync_run(uuid, text) and record_worker_heartbeat(text,
--   uuid, text) were ALWAYS reported missing and the worker exited 1 against a
--   correct database. Only sync_system_health(), which takes no arguments, ever
--   passed — which is precisely why the failure named those three and not it.
--
--   Probing by execution is the wrong instrument regardless: calling
--   claim_sync_run to discover whether it exists would actually claim a job.
--
-- WHAT THIS DOES
--   Asks pg_proc. No side effects, no argument guessing. It also returns
--   overload counts, so a superseded signature that came back from the dead is
--   caught at startup rather than at publish time.
--
-- SAFE: one read-only function. No data touched. Rollback at foot of file.
-- ============================================================

create or replace function public.sync_schema_ready()
returns jsonb language sql stable security definer set search_path = public as $$
  with required(name) as (
    values ('claim_sync_run'), ('requeue_sync_run'),
           ('record_worker_heartbeat'), ('sync_system_health'),
           ('publish_sync_run'), ('publish_sync_chapters')
  ),
  present as (
    select r.name,
           exists (select 1 from pg_proc p
                     join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = r.name) as ok
      from required r
  )
  select jsonb_build_object(
    'ready',   (select bool_and(ok) from present)
               and (select to_regclass('public.sync_settings') is not null),
    'missing', (select coalesce(jsonb_agg(name order by name), '[]'::jsonb)
                  from present where not ok),
    'settingsTable', (select to_regclass('public.sync_settings') is not null),
    'publishOverloads', (select count(*) from pg_proc p
                           join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='public' and p.proname='publish_sync_run'),
    'claimOverloads',   (select count(*) from pg_proc p
                           join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='public' and p.proname='claim_sync_run')
  )
$$;
revoke all on function public.sync_schema_ready() from public, anon;
grant execute on function public.sync_schema_ready() to authenticated, service_role;

-- PostgREST caches the schema. Without this, a freshly created function is
-- invisible to RPC callers until the cache happens to refresh.
notify pgrst, 'reload schema';

-- ============================================================
-- ROLLBACK (inert - uncomment deliberately)
-- ============================================================
-- drop function if exists public.sync_schema_ready();
