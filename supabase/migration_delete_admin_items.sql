-- ============================================================
-- Migration: admin cleanup actions
-- Run once in Supabase SQL Editor.
-- Allows admins/owner to delete fixed issue reports and old sync runs.
-- ============================================================

drop policy if exists "Admin+ can delete content issues" on content_issues;
create policy "Admin+ can delete content issues" on content_issues
for delete using (
  exists (
    select 1 from user_roles
    where user_roles.user_id = auth.uid()
    and user_roles.role in ('admin', 'owner')
  )
);

drop policy if exists "Admin+ can delete sync runs" on sync_runs;
create policy "Admin+ can delete sync runs" on sync_runs
for delete using (
  exists (
    select 1 from user_roles
    where user_roles.user_id = auth.uid()
    and user_roles.role in ('admin', 'owner')
  )
);

drop policy if exists "Admin+ can delete staged sync changes" on sync_staged_changes;
create policy "Admin+ can delete staged sync changes" on sync_staged_changes
for delete using (
  exists (
    select 1 from user_roles
    where user_roles.user_id = auth.uid()
    and user_roles.role in ('admin', 'owner')
  )
);

grant delete on content_issues to authenticated;
grant delete on sync_runs to authenticated;
grant delete on sync_staged_changes to authenticated;
