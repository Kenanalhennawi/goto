-- ============================================================
-- PUB-1.2 — LIVE authorization boundary proof.
-- SUPABASE SQL EDITOR COMPATIBLE: pure SQL, no psql meta-commands (\set, \if).
--
-- Run AFTER applying 20260806000000_owner_override_boundary.sql.
-- Everything runs inside a transaction that ROLLS BACK. Nothing is mutated.
--
-- Concurrency cannot be proven from a single session; use
-- scripts/verify-publish-concurrency.psql for that.
--
-- BEFORE RUNNING: put real user ids in the three rows marked <-- EDIT.
-- ============================================================

begin;

create temporary table _p(label text, uid uuid) on commit drop;
insert into _p values
  ('owner',   '00000000-0000-0000-0000-000000000000'),  -- <-- EDIT: a real owner
  ('admin',   '00000000-0000-0000-0000-000000000000'),  -- <-- EDIT: a real admin
  ('quality', '00000000-0000-0000-0000-000000000000');  -- <-- EDIT: a real quality user

create temporary table _r(id uuid) on commit drop;
insert into _r
  select id from public.sync_runs where state = 'staged' order by created_at desc limit 1;

create temporary table _out(step text, principal text, outcome text, detail text) on commit drop;

-- ---- 0. Effective policy union --------------------------------------------
select policyname, cmd, permissive, roles, qual::text as using_expr
  from pg_policies
 where schemaname = 'public' and tablename = 'sync_runs'
 order by cmd, policyname;

-- ---- 1. Direct override write must FAIL for every principal, INSERT + UPDATE
do $$
declare r uuid; p record;
begin
  select id into r from _r;
  for p in select * from _p loop
    -- UPDATE
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', p.uid)::text, true);
      set local role authenticated;
      update public.sync_runs
         set reclass_override_reason = 'TAMPER', reclass_override_by = p.uid,
             reclass_override_at = now()
       where id = r;
      insert into _out values ('1 direct UPDATE override', p.label, 'FAIL', 'write was allowed');
    exception when others then
      insert into _out values ('1 direct UPDATE override', p.label, 'PASS', sqlerrm);
    end;
    reset role;
    -- INSERT (production policy 5 permits INSERT for quality/admin/owner)
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', p.uid)::text, true);
      set local role authenticated;
      insert into public.sync_runs(state, status, reclass_override_reason, reclass_override_by, reclass_override_at)
      values ('staged', 'staged', 'FORGED', p.uid, now());
      insert into _out values ('2 forged override on INSERT', p.label, 'FAIL', 'insert was allowed');
    exception when others then
      insert into _out values ('2 forged override on INSERT', p.label, 'PASS', sqlerrm);
    end;
    reset role;
  end loop;
end $$;

-- ---- 3. Only an owner may use the override RPCs ----------------------------
do $$
declare r uuid; p record;
begin
  select id into r from _r;
  for p in select * from _p loop
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', p.uid)::text, true);
      set local role authenticated;
      perform public.record_sync_reclass_override(r, 'Boundary verification - rolled back');
      insert into _out values ('3 override RPC', p.label,
        case when p.label = 'owner' then 'PASS' else 'FAIL' end, 'allowed');
    exception when others then
      insert into _out values ('3 override RPC', p.label,
        case when p.label = 'owner' then 'FAIL' else 'PASS' end, sqlerrm);
    end;
    reset role;
  end loop;
end $$;

-- ---- 4. Legitimate operational access is preserved -------------------------
do $$
declare r uuid; p record;
begin
  select id into r from _r;
  for p in select * from _p loop
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', p.uid)::text, true);
      set local role authenticated;
      update public.sync_runs set progress_message = progress_message where id = r;
      insert into _out values ('4 normal update retained', p.label, 'PASS', 'allowed');
    exception when others then
      insert into _out values ('4 normal update retained', p.label, 'CHECK', sqlerrm);
    end;
    reset role;
  end loop;
end $$;

-- ---- 5. Override refused on non-staged states ------------------------------
do $$
declare r uuid; o uuid; st text;
begin
  select uid into o from _p where label = 'owner';
  select id into r from public.sync_runs
   where state in ('published','failed','cancelled','publishing') limit 1;
  if r is null then
    insert into _out values ('5 override on terminal state', 'owner', 'SKIP', 'no non-staged run present');
  else
    select state into st from public.sync_runs where id = r;
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', o)::text, true);
      set local role authenticated;
      perform public.record_sync_reclass_override(r, 'Should be refused on this state');
      insert into _out values ('5 override on terminal state', 'owner', 'FAIL', 'allowed on ' || st);
    exception when others then
      insert into _out values ('5 override on terminal state', 'owner', 'PASS', st || ': ' || sqlerrm);
    end;
    reset role;
  end if;
end $$;

-- ---- 6. Audit history is append-only ---------------------------------------
do $$
begin
  begin
    set local role authenticated;
    update public.sync_reclass_override_audit set new_reason = 'tamper';
    insert into _out values ('6 audit immutable', 'authenticated', 'FAIL', 'audit was mutable');
  exception when others then
    insert into _out values ('6 audit immutable', 'authenticated', 'PASS', sqlerrm);
  end;
  reset role;
end $$;

-- ---- 7. The over-authorised release function must be gone ------------------
do $$
begin
  if exists (select 1 from pg_proc where proname = 'release_sync_run_publish_claim') then
    insert into _out values ('7 release fn removed', '-', 'FAIL', 'function still exists');
  else
    insert into _out values ('7 release fn removed', '-', 'PASS', 'absent');
  end if;
end $$;

-- ---- 8. Publish refuses a mass-reclassified run without a valid override ---
do $$
declare r uuid; a uuid;
begin
  select uid into a from _p where label = 'admin';
  select id into r from public.sync_runs
   where state = 'staged' and (coalesce(new_ratio,0) > 0.2 or coalesce(removed_ratio,0) > 0.2)
     and coalesce(btrim(reclass_override_reason),'') = '' limit 1;
  if r is null then
    insert into _out values ('8 publish blocked', 'admin', 'SKIP', 'no blocked staged run present');
  else
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
      set local role authenticated;
      perform public.publish_sync_run(r, '[]'::jsonb, array[]::uuid[], a, null, null);
      insert into _out values ('8 publish blocked', 'admin', 'FAIL', 'publish was allowed');
    exception when others then
      insert into _out values ('8 publish blocked', 'admin', 'PASS', sqlerrm);
    end;
    reset role;
  end if;
end $$;

-- ---- Results ---------------------------------------------------------------
select step, principal, outcome, left(detail, 90) as detail
  from _out
 order by step, principal;

select outcome, count(*) from _out group by outcome order by 1;

rollback;
