-- ============================================================
-- Migration: chapter issue reports
-- Run once in Supabase SQL Editor.
-- ============================================================

create table if not exists content_issues (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid references chapters(id) on delete cascade,
  chapter_slug text not null,
  section_id text,
  reported_by uuid references auth.users(id),
  reporter_email text,
  message text not null check (char_length(message) between 3 and 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);

create index if not exists idx_content_issues_status on content_issues(status, created_at desc);
create index if not exists idx_content_issues_chapter on content_issues(chapter_id, created_at desc);

alter table content_issues enable row level security;

drop policy if exists "Anyone can report content issue" on content_issues;
drop policy if exists "Quality+ can read content issues" on content_issues;
drop policy if exists "Quality+ can update content issues" on content_issues;

create policy "Anyone can report content issue" on content_issues
for insert with check (true);

create policy "Quality+ can read content issues" on content_issues
for select using (
  exists (
    select 1 from user_roles
    where user_roles.user_id = auth.uid()
    and user_roles.role in ('quality', 'admin', 'owner')
  )
);

create policy "Quality+ can update content issues" on content_issues
for update using (
  exists (
    select 1 from user_roles
    where user_roles.user_id = auth.uid()
    and user_roles.role in ('quality', 'admin', 'owner')
  )
) with check (
  exists (
    select 1 from user_roles
    where user_roles.user_id = auth.uid()
    and user_roles.role in ('quality', 'admin', 'owner')
  )
);

grant insert on content_issues to anon, authenticated;
grant select, update on content_issues to authenticated;
grant all on content_issues to service_role;
