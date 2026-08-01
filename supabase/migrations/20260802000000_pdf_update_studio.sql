-- ============================================================
-- UPD-2: Secure web PDF Update Studio — foundation.
--
-- Adds the upload/extraction lifecycle to the EXISTING sync tables, pins the
-- RLS policies that were previously dashboard-only, creates the impact report,
-- the private manual-sources bucket policies and a concurrency-safe job claim.
--
-- Guarantees preserved:
--   * publish_sync_chapters() stays SECURITY INVOKER (unchanged, not touched).
--   * Nothing here approves or publishes a procedure card.
--   * Nothing here edits a decision tree or bumps a tree version.
--   * No anonymous access to any sync object or to the stored PDFs.
--
-- Idempotent: safe to re-run.
-- ============================================================

-- ---------- Role helper (reused; created by the SEC-1 migration) -----------
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from user_roles where user_id = auth.uid() limit 1
$$;
revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

-- ============================================================
-- 1. sync_runs — upload + extraction lifecycle
-- ============================================================
alter table public.sync_runs
  add column if not exists pdf_path text,
  add column if not exists pdf_sha256 text,
  add column if not exists pdf_page_count integer,
  add column if not exists pdf_version text,
  add column if not exists pdf_version_date date,
  add column if not exists original_filename text,
  add column if not exists uploaded_by uuid references auth.users(id),
  add column if not exists state text not null default 'uploaded',
  add column if not exists progress_pct integer not null default 0,
  add column if not exists progress_message text,
  add column if not exists error_code text,
  add column if not exists error_detail text,
  add column if not exists retry_of_run_id uuid references public.sync_runs(id) on delete set null,
  add column if not exists extractor_version text,
  add column if not exists override_reason text,
  add column if not exists claimed_at timestamptz,
  add column if not exists claimed_by text,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

do $$ begin
  alter table public.sync_runs drop constraint if exists sync_runs_state_check;
  alter table public.sync_runs add constraint sync_runs_state_check check (
    state in ('uploaded','queued','validating','extracting','staged','publishing','published','failed','cancelled')
  );
  alter table public.sync_runs drop constraint if exists sync_runs_progress_check;
  alter table public.sync_runs add constraint sync_runs_progress_check check (
    progress_pct >= 0 and progress_pct <= 100
  );
end $$;

-- One active job per PDF: the same file cannot be queued twice concurrently.
create unique index if not exists sync_runs_active_hash_idx
  on public.sync_runs (pdf_sha256)
  where pdf_sha256 is not null
    and state in ('uploaded','queued','validating','extracting','staged','publishing');

create index if not exists sync_runs_state_idx on public.sync_runs (state, created_at desc);

-- ============================================================
-- 2. sync_staged_changes — explicit diff classification
-- ============================================================
alter table public.sync_staged_changes
  add column if not exists change_class text,
  add column if not exists identity_match_method text,
  add column if not exists old_page_start integer,
  add column if not exists old_page_end integer,
  add column if not exists new_page_start integer,
  add column if not exists new_page_end integer,
  add column if not exists old_source_version text,
  add column if not exists new_source_version text,
  add column if not exists change_reasons text,
  add column if not exists existing_chapter_id uuid;

do $$ begin
  alter table public.sync_staged_changes drop constraint if exists sync_staged_changes_class_check;
  alter table public.sync_staged_changes add constraint sync_staged_changes_class_check check (
    change_class is null or change_class in
      ('unchanged','metadata_only','content_changed','new','removed','renamed_moved')
  );
  alter table public.sync_staged_changes drop constraint if exists sync_staged_changes_identity_check;
  alter table public.sync_staged_changes add constraint sync_staged_changes_identity_check check (
    identity_match_method is null or identity_match_method in ('slug','title','number','none')
  );
end $$;

create index if not exists sync_staged_changes_class_idx
  on public.sync_staged_changes (sync_run_id, change_class);

-- ============================================================
-- 3. sync_impact_report — read-only analysis, never a mutation
-- ============================================================
create table if not exists public.sync_impact_report (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.sync_runs(id) on delete cascade,
  impact_type text not null,
  entity_slug text not null,
  entity_title text,
  current_version text,
  target_version text,
  status text not null,
  reason text,
  requires_manual_review boolean not null default true,
  created_at timestamptz not null default now(),
  constraint sync_impact_report_type_check check (
    impact_type in ('chapter','procedure_card','workflow','search_term','orphaned_source')
  ),
  constraint sync_impact_report_status_check check (status in ('ok','review','blocked'))
);

create index if not exists sync_impact_report_run_idx
  on public.sync_impact_report (run_id, impact_type, status);

-- ============================================================
-- 4. RLS — pinned in version control (previously dashboard-only)
-- ============================================================
alter table public.sync_runs enable row level security;
alter table public.sync_staged_changes enable row level security;
alter table public.sync_impact_report enable row level security;

-- ---- sync_runs ----
drop policy if exists "Quality+ can read sync runs" on public.sync_runs;
create policy "Quality+ can read sync runs" on public.sync_runs
  for select to authenticated
  using (public.current_app_role() in ('quality','editor','admin','owner'));

drop policy if exists "Admin+ can insert sync runs" on public.sync_runs;
create policy "Admin+ can insert sync runs" on public.sync_runs
  for insert to authenticated
  with check (public.current_app_role() in ('admin','owner'));

drop policy if exists "Admin+ can update sync runs" on public.sync_runs;
create policy "Admin+ can update sync runs" on public.sync_runs
  for update to authenticated
  using (public.current_app_role() in ('admin','owner'))
  with check (public.current_app_role() in ('admin','owner'));
-- NOTE: the background worker updates processing state with the service role,
-- which bypasses RLS by design. The service role key never reaches the browser.

-- ---- sync_staged_changes ----
drop policy if exists "Quality+ can read staged sync changes" on public.sync_staged_changes;
create policy "Quality+ can read staged sync changes" on public.sync_staged_changes
  for select to authenticated
  using (public.current_app_role() in ('quality','editor','admin','owner'));

-- Reviewers approve staged chapters from the browser (SyncReviewClient); this
-- policy is the ONLY thing standing between an ordinary agent and approving
-- chapter content, which is why it must live in version control.
drop policy if exists "Quality+ can update staged sync changes" on public.sync_staged_changes;
create policy "Quality+ can update staged sync changes" on public.sync_staged_changes
  for update to authenticated
  using (public.current_app_role() in ('quality','editor','admin','owner'))
  with check (public.current_app_role() in ('quality','editor','admin','owner'));

drop policy if exists "Admin+ can insert staged sync changes" on public.sync_staged_changes;
create policy "Admin+ can insert staged sync changes" on public.sync_staged_changes
  for insert to authenticated
  with check (public.current_app_role() in ('admin','owner'));

-- ---- sync_impact_report ----
drop policy if exists "Quality+ can read impact report" on public.sync_impact_report;
create policy "Quality+ can read impact report" on public.sync_impact_report
  for select to authenticated
  using (public.current_app_role() in ('quality','editor','admin','owner'));

drop policy if exists "Admin+ can write impact report" on public.sync_impact_report;
create policy "Admin+ can write impact report" on public.sync_impact_report
  for insert to authenticated
  with check (public.current_app_role() in ('admin','owner'));

-- ---- Revoke anonymous access everywhere ----
revoke all on public.sync_runs from anon;
revoke all on public.sync_staged_changes from anon;
revoke all on public.sync_impact_report from anon;
grant select on public.sync_impact_report to authenticated;

-- ============================================================
-- 5. Private storage bucket: manual-sources
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('manual-sources', 'manual-sources', false, 41943040, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = 41943040,
  allowed_mime_types = array['application/pdf'];

drop policy if exists "Admin+ can upload manual sources" on storage.objects;
create policy "Admin+ can upload manual sources" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'manual-sources'
    and public.current_app_role() in ('admin','owner')
  );

drop policy if exists "Admin+ can read manual sources" on storage.objects;
create policy "Admin+ can read manual sources" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'manual-sources'
    and public.current_app_role() in ('admin','owner')
  );

drop policy if exists "Owner can delete manual sources" on storage.objects;
create policy "Owner can delete manual sources" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'manual-sources'
    and public.current_app_role() = 'owner'
  );

-- ============================================================
-- 6. Concurrency-safe job claim (worker only, service role)
-- ============================================================
-- SECURITY DEFINER + explicit role guard: only the service role may claim.
-- FOR UPDATE SKIP LOCKED guarantees two workers never take the same run.
create or replace function public.claim_sync_run(p_worker_id text)
returns public.sync_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.sync_runs;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role'
     and current_user not in ('service_role', 'postgres') then
    raise exception 'CLAIM_FORBIDDEN: only the background worker may claim runs';
  end if;

  select * into v_run
  from public.sync_runs
  where state = 'queued'
  order by created_at asc
  for update skip locked
  limit 1;

  if v_run.id is null then
    return null;
  end if;

  update public.sync_runs set
    state = 'validating',
    claimed_at = now(),
    claimed_by = p_worker_id,
    started_at = coalesce(started_at, now()),
    progress_pct = 5,
    progress_message = 'Validating uploaded PDF'
  where id = v_run.id
  returning * into v_run;

  return v_run;
end;
$$;

revoke all on function public.claim_sync_run(text) from public, anon, authenticated;
grant execute on function public.claim_sync_run(text) to service_role;

-- ============================================================
-- 7. Verification
-- ============================================================
-- select state, count(*) from sync_runs group by state;
-- select change_class, count(*) from sync_staged_changes group by change_class;
-- select impact_type, status, count(*) from sync_impact_report group by 1,2;
-- select id, public from storage.buckets where id = 'manual-sources';  -- public must be false
