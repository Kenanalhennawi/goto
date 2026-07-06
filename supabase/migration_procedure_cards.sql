-- ============================================================
-- Migration: procedure cards data model
-- Run once in Supabase SQL Editor.
-- ============================================================

create table if not exists procedure_cards (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid references chapters(id) on delete cascade,
  title text not null,
  slug text unique not null,
  category text not null,
  summary text,
  when_to_use text,
  agent_action jsonb not null default '[]'::jsonb,
  rules jsonb not null default '[]'::jsonb,
  exceptions jsonb not null default '[]'::jsonb,
  required_approval text,
  customer_script text,
  sprint_comment_template text,
  salesforce_classification text,
  source_pages int[] not null default '{}',
  source_version text,
  source_updated_at date,
  keywords text[] not null default '{}',
  aliases text[] not null default '{}',
  priority int not null default 0,
  review_status text not null default 'needs_review',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint procedure_cards_review_status_check check (
    review_status in ('draft', 'needs_review', 'approved', 'archived')
  ),
  constraint procedure_cards_agent_action_array_check check (jsonb_typeof(agent_action) = 'array'),
  constraint procedure_cards_rules_array_check check (jsonb_typeof(rules) = 'array'),
  constraint procedure_cards_exceptions_array_check check (jsonb_typeof(exceptions) = 'array')
);

create index if not exists procedure_cards_slug_idx on procedure_cards(slug);
create index if not exists procedure_cards_chapter_id_idx on procedure_cards(chapter_id);
create index if not exists procedure_cards_category_idx on procedure_cards(category);
create index if not exists procedure_cards_review_status_idx on procedure_cards(review_status);
create index if not exists procedure_cards_is_published_idx on procedure_cards(is_published);
create index if not exists procedure_cards_priority_idx on procedure_cards(priority desc);
create index if not exists procedure_cards_keywords_gin_idx on procedure_cards using gin (keywords);
create index if not exists procedure_cards_aliases_gin_idx on procedure_cards using gin (aliases);
create index if not exists procedure_cards_text_search_idx on procedure_cards using gin (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(when_to_use, ''))
);

create or replace function set_procedure_cards_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_procedure_cards_updated_at on procedure_cards;

create trigger set_procedure_cards_updated_at
before update on procedure_cards
for each row execute function set_procedure_cards_updated_at();

alter table procedure_cards enable row level security;

drop policy if exists "Published procedure cards are public" on procedure_cards;
drop policy if exists "Quality+ can read procedure cards" on procedure_cards;
drop policy if exists "Quality+ can insert procedure cards" on procedure_cards;
drop policy if exists "Quality+ can update procedure cards" on procedure_cards;
drop policy if exists "Admin+ can delete procedure cards" on procedure_cards;

create policy "Published procedure cards are public" on procedure_cards
for select using (
  is_published = true
  and review_status in ('needs_review', 'approved')
);

create policy "Quality+ can read procedure cards" on procedure_cards
for select using (
  exists (
    select 1 from user_roles
    where user_roles.user_id = auth.uid()
    and user_roles.role in ('quality', 'admin', 'owner')
  )
);

create policy "Quality+ can insert procedure cards" on procedure_cards
for insert with check (
  exists (
    select 1 from user_roles
    where user_roles.user_id = auth.uid()
    and user_roles.role in ('quality', 'admin', 'owner')
  )
);

create policy "Quality+ can update procedure cards" on procedure_cards
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

create policy "Admin+ can delete procedure cards" on procedure_cards
for delete using (
  exists (
    select 1 from user_roles
    where user_roles.user_id = auth.uid()
    and user_roles.role in ('admin', 'owner')
  )
);

grant select on procedure_cards to anon, authenticated;
grant insert, update, delete on procedure_cards to authenticated;
grant all on procedure_cards to service_role;

create table if not exists procedure_edit_history (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid references procedure_cards(id) on delete cascade,
  edited_by uuid references auth.users(id),
  previous_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists procedure_edit_history_procedure_id_idx
  on procedure_edit_history(procedure_id, created_at desc);
create index if not exists procedure_edit_history_edited_by_idx
  on procedure_edit_history(edited_by, created_at desc);

alter table procedure_edit_history enable row level security;

drop policy if exists "Quality+ can read procedure edit history" on procedure_edit_history;
drop policy if exists "Quality+ can insert procedure edit history" on procedure_edit_history;

create policy "Quality+ can read procedure edit history" on procedure_edit_history
for select using (
  exists (
    select 1 from user_roles
    where user_roles.user_id = auth.uid()
    and user_roles.role in ('quality', 'admin', 'owner')
  )
);

create policy "Quality+ can insert procedure edit history" on procedure_edit_history
for insert with check (
  exists (
    select 1 from user_roles
    where user_roles.user_id = auth.uid()
    and user_roles.role in ('quality', 'admin', 'owner')
  )
);

grant select, insert on procedure_edit_history to authenticated;
grant all on procedure_edit_history to service_role;
