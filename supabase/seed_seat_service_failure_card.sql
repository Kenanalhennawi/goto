-- ============================================================
-- Seed: Pre-purchased Seat service-failure operational card (draft)
--
-- Source of truth: The GO TO document.pdf, chapter 33 Seat,
-- sections 33.10-33.12, pages 162-163.
--
-- Confirmed from source text:
-- - Agent steps for "pre-purchased seat not assigned during online
--   check-in" (33.10) and "not provided on-board" (33.11), including
--   the two on-board sub-scenarios (passenger wrote / did not write).
-- - Supervisor steps: crosscheck seats, email Reservations Support to
--   re-assign (33.10); escalate case to Customer Service (33.11).
-- - letstalk@flydubai.com intake address for on-board incidents.
-- - Recommended Salesforce classification (33.12).
--
-- Intentionally blank (not stated in source for this scenario):
-- - cut_off_time, fees_charges, required_approval, customer_script.
--
-- Unused source material: seat maps, seat-dimension tables, and
-- screenshots on pages 146-161 (they belong to the seat-assignment
-- and extra-seat cards, not to this service-failure card).
--
-- Safety:
-- - Insert-only with ON CONFLICT DO NOTHING; never touches an
--   existing card, approved or otherwise.
-- - Not approved, not published, not featured; no review metadata set.
-- ============================================================

insert into public.procedure_cards (
  chapter_id,
  title,
  slug,
  category,
  service_code,
  service_type,
  summary,
  when_to_use,
  channels,
  cut_off_time,
  who_can_action,
  required_information,
  system_steps,
  passenger_advice,
  allowed,
  not_allowed,
  escalation_points,
  fees_charges,
  salesforce_classification,
  source_pages,
  keywords,
  aliases,
  priority,
  review_status,
  is_published,
  show_on_homepage,
  homepage_order,
  source_confidence
)
select
  (select id from public.chapters where chapter_number = 33 limit 1),
  'Pre-purchased Seat Not Provided',
  'pre-purchased-seat-not-provided',
  'Seats',
  null,
  'Service Failure',
  'Handling for a pre-purchased seat that was not assigned during online check-in or not provided on-board.',
  'Use when a passenger reports that a seat they paid for was not allocated during online check-in or was not provided on the flight.',
  jsonb_build_array('Contact Centre', 'Salesforce'),
  null,
  jsonb_build_array(
    'Contact Centre agent for intake and Salesforce case creation',
    'Contact Centre supervisor for crosscheck and escalation'
  ),
  jsonb_build_array(
    'Booking reference',
    'Pre-purchased seat number',
    'Whether the seat issue happened at online check-in or on-board',
    'For an on-board issue: whether the passenger has already written to flydubai and the case number if so'
  ),
  jsonb_build_array(
    'Re-cap the booking.',
    'Confirm the pre-purchased seat number.',
    'Seat not assigned during online check-in: create and escalate a case in Salesforce to the supervisor.',
    'Seat not provided on-board and the passenger has not written to flydubai: inform the passenger to write to letstalk@flydubai.com with the incident.',
    'Seat not provided on-board and the passenger already wrote to flydubai: retrieve the case number, create a child case in Salesforce, and transfer the case to the supervisor.',
    'Update SPRINT comments.'
  ),
  jsonb_build_array(
    'For a seat not provided on-board, the passenger can write to letstalk@flydubai.com with the incident if they have not already done so.'
  ),
  '[]'::jsonb,
  '[]'::jsonb,
  jsonb_build_array(
    'Online check-in scenario: supervisor crosschecks the pre-purchased seats and emails Reservations Support with the details to re-assign the seat.',
    'On-board scenario: supervisor retrieves the case number, verifies the seat number, and escalates the case to Customer Service for follow up.'
  ),
  null,
  $seed$Online check-in > Seating: seat allocation during online check-in (selected or pre-purchased seat not correctly allocated, or enquiry on changing seats after online check-in).
Inflight product: seat > Paid and not received: customer did not get the seat paid for during booking.$seed$,
  array[162, 163],
  array['seat', 'pre-purchased seat', 'seat not provided', 'service failure', 'online check-in seat'],
  array['paid seat not received', 'seat refund', 'OLCI seat issue'],
  55,
  'needs_review',
  false,
  false,
  0,
  'source_backed'
where not exists (
  select 1 from public.procedure_cards where slug = 'pre-purchased-seat-not-provided'
);

-- ============================================================
-- Report: confirm the draft card state after running this seed.
-- ============================================================
select
  slug,
  title,
  category,
  service_type,
  review_status,
  is_published,
  show_on_homepage,
  source_confidence,
  source_pages,
  chapter_id is not null as has_linked_chapter
from public.procedure_cards
where slug = 'pre-purchased-seat-not-provided';

-- ============================================================
-- Generic-filler detection: must return zero rows.
-- ============================================================
select slug, 'filler detected' as issue
from public.procedure_cards
where slug = 'pre-purchased-seat-not-provided'
  and (
    coalesce(summary, '') || ' ' ||
    coalesce(when_to_use, '') || ' ' ||
    coalesce(cut_off_time, '') || ' ' ||
    coalesce(fees_charges, '') || ' ' ||
    coalesce(salesforce_classification, '') || ' ' ||
    system_steps::text || ' ' ||
    passenger_advice::text || ' ' ||
    allowed::text || ' ' ||
    not_allowed::text || ' ' ||
    escalation_points::text || ' ' ||
    who_can_action::text || ' ' ||
    required_information::text
  ) ~* '(source chapter|source-supported|linked source|quality review|check the source|according to source|source rules|source process|pending source review|draft operational card|use this card after|where source allows|escalate unclear)';
