-- ============================================================
-- UPD-2.7: mass-reclassification guard + audited owner override.
--
-- Adds only the columns the guard needs. No RLS policy is relaxed: the
-- owner-only requirement is enforced in the API route, and the existing
-- "Admin+ can update sync runs" policy still applies.
--
-- Touches nothing operational: no chapters, procedure cards, decision trees,
-- search, publishing semantics or extraction text logic.
-- Idempotent: safe to re-run.
-- ============================================================

alter table public.sync_runs
  add column if not exists new_ratio numeric,
  add column if not exists removed_ratio numeric,
  add column if not exists ambiguous_count integer,
  -- Audited override: only an OWNER may set these (enforced in the API route).
  add column if not exists reclass_override_reason text,
  add column if not exists reclass_override_by uuid references auth.users(id),
  add column if not exists reclass_override_at timestamptz;

do $$ begin
  alter table public.sync_runs drop constraint if exists sync_runs_ratio_check;
  alter table public.sync_runs add constraint sync_runs_ratio_check check (
    (new_ratio is null or (new_ratio >= 0 and new_ratio <= 1))
    and (removed_ratio is null or (removed_ratio >= 0 and removed_ratio <= 1))
    and (ambiguous_count is null or ambiguous_count >= 0)
  );
  -- An override must always carry a reason and an owner: never silent.
  alter table public.sync_runs drop constraint if exists sync_runs_reclass_override_check;
  alter table public.sync_runs add constraint sync_runs_reclass_override_check check (
    (reclass_override_reason is null and reclass_override_by is null)
    or (
      reclass_override_reason is not null
      and length(btrim(reclass_override_reason)) > 0
      and reclass_override_by is not null
    )
  );
end $$;

-- ---------- Verification ----------
-- select id, state, new_ratio, removed_ratio, ambiguous_count,
--        reclass_override_reason is not null as overridden
--   from sync_runs order by created_at desc limit 10;
