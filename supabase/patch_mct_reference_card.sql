-- ============================================================
-- Patch: classify Minimum Connection Time as an operational reference card
--
-- Safety:
-- - Updates only the existing minimum-connection-time procedure card.
-- - Does not approve or publish automatically.
-- - Leaves the card in needs_review for quality/admin review.
-- ============================================================

update public.procedure_cards
set
  service_type = 'Connection Reference',
  cut_off_time = E'T2 -> T2\nFZ -> FZ: 60 mins\nFZ -> OA: 120 mins\n\nT3 -> T3\nFZ -> FZ: 90 mins\nFZ -> OA: 90 mins\n\nT2 -> T3\nFZ -> FZ / FZ -> OA: 120 mins\n\nT2/T3 -> T1\nFZ -> OA: 180 mins\n\nNote\nSee source chapter for OA exceptions.',
  review_status = 'needs_review',
  is_published = false,
  updated_at = now()
where slug = 'minimum-connection-time';
