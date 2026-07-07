-- ============================================================
-- Migration: featured procedure cards for homepage
--
-- Separates public publication from homepage featuring.
-- Existing published cards are not featured automatically.
-- ============================================================

alter table public.procedure_cards
  add column if not exists show_on_homepage boolean not null default false,
  add column if not exists homepage_order int not null default 0;

create index if not exists procedure_cards_show_on_homepage_idx
  on public.procedure_cards (show_on_homepage);

create index if not exists procedure_cards_homepage_order_idx
  on public.procedure_cards (homepage_order);
