-- ============================================================
-- Migration: Service Card fields for operational procedure cards
-- Run once in Supabase SQL Editor.
-- ============================================================

alter table public.procedure_cards
  add column if not exists service_code text,
  add column if not exists service_type text,
  add column if not exists channels jsonb default '[]'::jsonb,
  add column if not exists cut_off_time text,
  add column if not exists who_can_action jsonb default '[]'::jsonb,
  add column if not exists required_information jsonb default '[]'::jsonb,
  add column if not exists system_steps jsonb default '[]'::jsonb,
  add column if not exists passenger_advice jsonb default '[]'::jsonb,
  add column if not exists allowed jsonb default '[]'::jsonb,
  add column if not exists not_allowed jsonb default '[]'::jsonb,
  add column if not exists escalation_points jsonb default '[]'::jsonb,
  add column if not exists fees_charges text,
  add column if not exists source_confidence text default 'needs_review',
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists last_reviewed_by uuid references auth.users(id);

alter table public.procedure_cards
  add constraint procedure_cards_source_confidence_check
  check (source_confidence in ('needs_review', 'source_backed', 'approved'))
  not valid;

alter table public.procedure_cards validate constraint procedure_cards_source_confidence_check;

alter table public.procedure_cards
  add constraint procedure_cards_channels_array_check
  check (jsonb_typeof(channels) = 'array')
  not valid;

alter table public.procedure_cards
  add constraint procedure_cards_who_can_action_array_check
  check (jsonb_typeof(who_can_action) = 'array')
  not valid;

alter table public.procedure_cards
  add constraint procedure_cards_required_information_array_check
  check (jsonb_typeof(required_information) = 'array')
  not valid;

alter table public.procedure_cards
  add constraint procedure_cards_system_steps_array_check
  check (jsonb_typeof(system_steps) = 'array')
  not valid;

alter table public.procedure_cards
  add constraint procedure_cards_passenger_advice_array_check
  check (jsonb_typeof(passenger_advice) = 'array')
  not valid;

alter table public.procedure_cards
  add constraint procedure_cards_allowed_array_check
  check (jsonb_typeof(allowed) = 'array')
  not valid;

alter table public.procedure_cards
  add constraint procedure_cards_not_allowed_array_check
  check (jsonb_typeof(not_allowed) = 'array')
  not valid;

alter table public.procedure_cards
  add constraint procedure_cards_escalation_points_array_check
  check (jsonb_typeof(escalation_points) = 'array')
  not valid;

alter table public.procedure_cards validate constraint procedure_cards_channels_array_check;
alter table public.procedure_cards validate constraint procedure_cards_who_can_action_array_check;
alter table public.procedure_cards validate constraint procedure_cards_required_information_array_check;
alter table public.procedure_cards validate constraint procedure_cards_system_steps_array_check;
alter table public.procedure_cards validate constraint procedure_cards_passenger_advice_array_check;
alter table public.procedure_cards validate constraint procedure_cards_allowed_array_check;
alter table public.procedure_cards validate constraint procedure_cards_not_allowed_array_check;
alter table public.procedure_cards validate constraint procedure_cards_escalation_points_array_check;

create index if not exists procedure_cards_service_code_idx on public.procedure_cards (service_code);
create index if not exists procedure_cards_service_type_idx on public.procedure_cards (service_type);
create index if not exists procedure_cards_source_confidence_idx on public.procedure_cards (source_confidence);
