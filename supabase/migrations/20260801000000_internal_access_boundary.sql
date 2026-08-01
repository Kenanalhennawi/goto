-- ============================================================
-- SEC-1: Internal access boundary (idempotent).
--
-- Converts the data layer to internal-only:
--   * procedure_cards : anonymous SELECT removed; authenticated read of
--                       published+approved cards; quality+/admin+ write
--                       policies unchanged.
--   * chapters        : RLS asserted; authenticated read; quality+ write;
--                       admin+ delete; anonymous access revoked.
--   * content_issues  : anonymous INSERT removed; authenticated insert only;
--                       quality+/admin+ read/update/delete unchanged.
--   * user_roles      : RLS asserted; self-read + admin/owner management via
--                       a SECURITY DEFINER helper (avoids policy recursion).
--   * sync_runs / sync_staged_changes : RLS asserted; quality+ read+review,
--                       admin+ insert/delete; existing delete policies kept.
--   * anon grants and anon RPC execution revoked.
--
-- RLS is never disabled. Conditional blocks keep the migration safe if a
-- table does not exist in a given environment.
-- ============================================================

-- ---------- Role helper (SECURITY DEFINER prevents user_roles recursion) ----
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

-- ---------- procedure_cards ------------------------------------------------
do $$ begin
if to_regclass('public.procedure_cards') is not null then
  execute 'alter table procedure_cards enable row level security';

  -- Remove the anonymous/public read; replace with authenticated internal read.
  execute 'drop policy if exists "Published procedure cards are public" on procedure_cards';
  execute 'drop policy if exists "Published cards readable by authenticated users" on procedure_cards';
  execute $p$create policy "Published cards readable by authenticated users" on procedure_cards
    for select to authenticated
    using (is_published = true and review_status = 'approved')$p$;

  execute 'revoke select on procedure_cards from anon';
end if;
end $$;

-- ---------- chapters -------------------------------------------------------
do $$ begin
if to_regclass('public.chapters') is not null then
  execute 'alter table chapters enable row level security';

  execute 'drop policy if exists "Chapters are public" on chapters';
  execute 'drop policy if exists "Chapters readable by everyone" on chapters';
  execute 'drop policy if exists "Chapters readable by authenticated users" on chapters';
  execute 'create policy "Chapters readable by authenticated users" on chapters
    for select to authenticated using (true)';

  execute 'drop policy if exists "Quality+ can insert chapters" on chapters';
  execute $p$create policy "Quality+ can insert chapters" on chapters
    for insert to authenticated
    with check (public.current_app_role() in ('quality', 'editor', 'admin', 'owner'))$p$;

  execute 'drop policy if exists "Quality+ can update chapters" on chapters';
  execute $p$create policy "Quality+ can update chapters" on chapters
    for update to authenticated
    using (public.current_app_role() in ('quality', 'editor', 'admin', 'owner'))
    with check (public.current_app_role() in ('quality', 'editor', 'admin', 'owner'))$p$;

  execute 'drop policy if exists "Admin+ can delete chapters" on chapters';
  execute $p$create policy "Admin+ can delete chapters" on chapters
    for delete to authenticated
    using (public.current_app_role() in ('admin', 'owner'))$p$;

  execute 'revoke all on chapters from anon';
end if;
end $$;

-- ---------- content_issues -------------------------------------------------
do $$ begin
if to_regclass('public.content_issues') is not null then
  execute 'alter table content_issues enable row level security';

  execute 'drop policy if exists "Anyone can report content issue" on content_issues';
  execute 'drop policy if exists "Authenticated users can report content issues" on content_issues';
  execute 'create policy "Authenticated users can report content issues" on content_issues
    for insert to authenticated with check (auth.uid() is not null)';

  execute 'revoke all on content_issues from anon';
end if;
end $$;

-- ---------- user_roles -----------------------------------------------------
do $$ begin
if to_regclass('public.user_roles') is not null then
  execute 'alter table user_roles enable row level security';

  execute 'drop policy if exists "Users can read own role" on user_roles';
  execute 'create policy "Users can read own role" on user_roles
    for select to authenticated using (user_id = auth.uid())';

  execute 'drop policy if exists "Admin+ can read all roles" on user_roles';
  execute $p$create policy "Admin+ can read all roles" on user_roles
    for select to authenticated
    using (public.current_app_role() in ('admin', 'owner'))$p$;

  execute 'drop policy if exists "Admin+ can insert roles" on user_roles';
  execute $p$create policy "Admin+ can insert roles" on user_roles
    for insert to authenticated
    with check (public.current_app_role() in ('admin', 'owner'))$p$;

  execute 'drop policy if exists "Admin+ can update roles" on user_roles';
  execute $p$create policy "Admin+ can update roles" on user_roles
    for update to authenticated
    using (public.current_app_role() in ('admin', 'owner'))
    with check (public.current_app_role() in ('admin', 'owner'))$p$;

  execute 'drop policy if exists "Admin+ can delete roles" on user_roles';
  execute $p$create policy "Admin+ can delete roles" on user_roles
    for delete to authenticated
    using (public.current_app_role() in ('admin', 'owner'))$p$;

  execute 'revoke all on user_roles from anon';
end if;
end $$;

-- ---------- sync_runs ------------------------------------------------------
do $$ begin
if to_regclass('public.sync_runs') is not null then
  execute 'alter table sync_runs enable row level security';

  execute 'drop policy if exists "Quality+ can read sync runs" on sync_runs';
  execute $p$create policy "Quality+ can read sync runs" on sync_runs
    for select to authenticated
    using (public.current_app_role() in ('quality', 'editor', 'admin', 'owner'))$p$;

  execute 'drop policy if exists "Admin+ can insert sync runs" on sync_runs';
  execute $p$create policy "Admin+ can insert sync runs" on sync_runs
    for insert to authenticated
    with check (public.current_app_role() in ('admin', 'owner'))$p$;

  execute 'drop policy if exists "Admin+ can update sync runs" on sync_runs';
  execute $p$create policy "Admin+ can update sync runs" on sync_runs
    for update to authenticated
    using (public.current_app_role() in ('admin', 'owner'))
    with check (public.current_app_role() in ('admin', 'owner'))$p$;

  -- Existing "Admin+ can delete sync runs" policy (migration_delete_admin_items)
  -- is preserved as-is.
  execute 'revoke all on sync_runs from anon';
end if;
end $$;

-- ---------- sync_staged_changes -------------------------------------------
do $$ begin
if to_regclass('public.sync_staged_changes') is not null then
  execute 'alter table sync_staged_changes enable row level security';

  execute 'drop policy if exists "Quality+ can read staged sync changes" on sync_staged_changes';
  execute $p$create policy "Quality+ can read staged sync changes" on sync_staged_changes
    for select to authenticated
    using (public.current_app_role() in ('quality', 'editor', 'admin', 'owner'))$p$;

  -- Review (approve/reject) happens from the quality+ sync review screen.
  execute 'drop policy if exists "Quality+ can update staged sync changes" on sync_staged_changes';
  execute $p$create policy "Quality+ can update staged sync changes" on sync_staged_changes
    for update to authenticated
    using (public.current_app_role() in ('quality', 'editor', 'admin', 'owner'))
    with check (public.current_app_role() in ('quality', 'editor', 'admin', 'owner'))$p$;

  execute 'drop policy if exists "Admin+ can insert staged sync changes" on sync_staged_changes';
  execute $p$create policy "Admin+ can insert staged sync changes" on sync_staged_changes
    for insert to authenticated
    with check (public.current_app_role() in ('admin', 'owner'))$p$;

  -- Existing "Admin+ can delete staged sync changes" policy is preserved.
  execute 'revoke all on sync_staged_changes from anon';
end if;
end $$;

-- ---------- RPC surface ----------------------------------------------------
-- Chapter search is internal-only: anonymous execution revoked.
do $$ begin
if exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_chapters'
) then
  execute 'revoke all on function public.search_chapters(text) from public, anon';
  execute 'grant execute on function public.search_chapters(text) to authenticated';
end if;
end $$;
