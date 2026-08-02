-- ============================================================
-- UPD-2.7: cancel the mis-classified v81.7 staged run.
--
-- The run completed extraction but identity matching failed, producing
-- 78 new / 79 removed. Publishing it would insert 78 duplicate chapters and
-- orphan 79 live ones, breaking every procedure_cards.chapter_id link.
--
-- SAFETY:
--   * Nothing is deleted. The run, its 157 staged rows and 306 impact rows are
--     retained for audit.
--   * No chapter, procedure card, decision tree or published content is touched.
--   * The UPDATE is guarded so it can ONLY affect a run that is still staged
--     and that never published anything.
--
-- Run Section A first and confirm the counts before running Section B.
-- ============================================================

-- ---------- Section A: confirm before cancelling ----------
-- Expect: state='staged', staged_rows=157, impact_rows=306, published_at is null.
select
  r.id,
  r.state,
  r.status,
  r.progress_pct,
  r.pdf_version,
  r.published_at,
  (select count(*) from public.sync_staged_changes s where s.sync_run_id = r.id) as staged_rows,
  (select count(*) from public.sync_impact_report i where i.run_id = r.id)       as impact_rows,
  (select count(*) from public.sync_staged_changes s
     where s.sync_run_id = r.id and s.change_class = 'new')                      as staged_new,
  (select count(*) from public.sync_staged_changes s
     where s.sync_run_id = r.id and s.change_class = 'removed')                  as staged_removed
from public.sync_runs r
where r.state = 'staged'
order by r.created_at desc;

-- ---------- Section B: cancel (only after Section A matches) ----------
-- Replace <RUN_ID> with the id confirmed above.
update public.sync_runs r set
  state            = 'cancelled',
  status           = 'discarded',
  progress_message = 'Cancelled: invalid mass chapter reclassification',
  error_code       = 'MASS_RECLASSIFICATION',
  completed_at     = coalesce(r.completed_at, now())
where r.id = '<RUN_ID>'::uuid
  -- Guard rails: only a still-staged run that published nothing.
  and r.state = 'staged'
  and r.published_at is null
  and (select count(*) from public.sync_staged_changes s where s.sync_run_id = r.id) = 157
  and (select count(*) from public.sync_impact_report i where i.run_id = r.id) = 306;

-- ---------- Section C: verify ----------
-- Expect state='cancelled', status='discarded', staged/impact counts UNCHANGED.
-- select id, state, status, error_code, progress_message,
--        (select count(*) from sync_staged_changes s where s.sync_run_id = sync_runs.id) as staged_rows,
--        (select count(*) from sync_impact_report i where i.run_id = sync_runs.id)       as impact_rows
--   from sync_runs where id = '<RUN_ID>'::uuid;
--
-- Confirm no chapters were published by this run:
-- select count(*) from chapters where source_version like '81.7%';   -- expect 0 until a good run publishes
