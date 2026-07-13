-- ============================================================
-- Verified operational content batch 2
-- PDF version: 80.8 (23-Jun-2026)
--
-- This file updates only the five named draft cards. It does not change
-- chapter_id, last_reviewed_at, or last_reviewed_by. It does not approve,
-- publish, or feature any card.
-- ============================================================

-- Meal
-- Version 80.8, chapter 37 Meal, pages 174-181.
-- Fields intentionally blank: fees and general escalation timing. Screenshot-only
-- system details and the full special-meal catalogue are not reproduced.
update public.procedure_cards
set
  title = 'Meal',
  category = 'Ancillary',
  service_code = 'SPML / MLIN',
  service_type = 'Ancillary Service',
  summary = 'Standard and special-meal handling for Economy and Business Class bookings.',
  when_to_use = 'Use for a standard meal, special-meal selection, or an inclusive-meal service-failure query.',
  channels = jsonb_build_array('Manage Booking', 'SPRINT', 'Contact Centre'),
  cut_off_time = $seed$Economy special meal: more than 24 hours before departure.

Business Class special meal: up to 24 hours before departure.

Unlisted Business Class special-meal requests require 48 hours'' notice.$seed$,
  who_can_action = jsonb_build_array('Contact Centre agent', 'Business Team for unlisted Business Class meal requests', 'Customer Service for inclusive-meal service failures'),
  required_information = jsonb_build_array('PNR', 'Passenger and segment', 'Requested meal preference or SSR code', 'Cabin class', 'Flight departure time'),
  system_steps = jsonb_build_array(
    'Retrieve the booking and confirm the passenger, segment, cabin class, and requested meal.',
    'For an eligible special meal, use Add Services, select the passenger, carrier, Meal category, and segment, then select the meal preference.',
    'When prompted for a meal-inclusive fare, confirm replacement of MLIN with SPML, continue, verify the Services tab, and save.',
    'For an inclusive-meal service failure, confirm the inclusive meal, ask the passenger to email Let''s Talk with the incident, and update SPRINT comments.'
  ),
  passenger_advice = jsonb_build_array(
    'Economy Class special meals must be selected more than 24 hours before departure.',
    'If an SPML booking is modified within 24 hours of departure, only the standard meal MLIN can be offered.',
    'Child Meal is non-vegetarian; AVML is the available vegetarian option for a child meal request.',
    'For an unlisted Business Class meal request, the Business Team may check with catering when 48 hours'' notice and the meal specifics are provided.'
  ),
  allowed = jsonb_build_array(
    'Economy passengers can select SPML more than 24 hours before departure.',
    'Contact Centre can select the documented special meals for Business Class passengers in SPRINT.',
    'Staff-ticket Business Class passengers can be assisted with the documented special-meal process.'
  ),
  not_allowed = jsonb_build_array(
    'KSML is not available in Economy Class.',
    'SPML cannot be selected during blackout dates.',
    'For TA or GDS bookings, do not pre-select or pre-purchase a meal through Contact Centre; direct the travel agency to Agency Support or the GDS team.',
    'Do not retain SPML on a modified flight within 24 hours of departure; MLIN is offered instead.'
  ),
  escalation_points = jsonb_build_array(
    'For an unlisted Business Class meal request, route the request through the Business Team to catering.',
    'For an inclusive-meal service failure reported through Let''s Talk, escalate the case to a Supervisor for Customer Service follow-up.'
  ),
  fees_charges = null,
  keywords = array['meal', 'SPML', 'MLIN', 'special meal', 'Business Class meal', 'inclusive meal'],
  aliases = array['SPML', 'MLIN', 'AVML', 'CHML', 'VGML', 'special meal'],
  priority = 55,
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  homepage_order = 0,
  source_confidence = 'source_backed',
  updated_at = now()
where slug = 'meal';

-- Pregnancy
-- Version 80.8, chapter 42 Pregnancy, page 258.
-- Fields intentionally blank: channels, escalation, fees, and screenshot/table facts.
update public.procedure_cards
set
  title = 'Pregnancy Travel Eligibility',
  category = 'Medical',
  service_code = null,
  service_type = 'Medical / Travel Eligibility Reference',
  summary = 'Travel eligibility and medical-certificate requirements for uncomplicated single and multiple pregnancies.',
  when_to_use = 'Use when a passenger asks whether pregnancy stage or documentation affects travel eligibility.',
  channels = '[]'::jsonb,
  cut_off_time = $seed$Single uncomplicated pregnancy: certificate required from week 29 through week 36; travel is not allowed from week 37.

Multiple uncomplicated pregnancy: certificate required from week 29 through week 32; travel is not allowed from week 33.$seed$,
  who_can_action = '[]'::jsonb,
  required_information = jsonb_build_array('Pregnancy type: single or multiple', 'Exact pregnancy week', 'Expected delivery date', 'Medical certificate when required'),
  system_steps = jsonb_build_array(
    'Identify whether the pregnancy is single or multiple and confirm the exact pregnancy week.',
    'Confirm whether a medical certificate is required for the travel date.',
    'Verify that a required certificate states the pregnancy weeks, expected delivery date, whether the pregnancy is single or multiple, that it is normal, and that the passenger is fit to fly during the travel dates.',
    'Advise the passenger to present the original required certificate at check-in.'
  ),
  passenger_advice = jsonb_build_array(
    'Carry the original medical certificate when one is required; travel is not permitted without the original certificate.',
    'The certificate may be a flydubai medical certificate form or a letter on clinic or hospital letterhead.',
    'The certificate must be signed or officially stamped by a doctor or midwife and is valid for three weeks from its issue date.'
  ),
  allowed = jsonb_build_array(
    'A single uncomplicated pregnancy may travel without a medical certificate through the end of week 28.',
    'A multiple uncomplicated pregnancy may travel without a medical certificate through the end of week 28.',
    'A required certificate may be in English, Arabic, or a language readable by ground or cabin staff.'
  ),
  not_allowed = jsonb_build_array(
    'Do not accept travel from week 37 for a single uncomplicated pregnancy.',
    'Do not accept travel from week 33 for a multiple uncomplicated pregnancy.',
    'Do not accept travel without the original medical certificate when a certificate is required.'
  ),
  escalation_points = '[]'::jsonb,
  fees_charges = null,
  keywords = array['pregnancy', 'pregnant passenger', 'medical certificate', 'fit to fly', 'expected delivery date'],
  aliases = array['PREG', 'pregnant', 'pregnancy certificate'],
  priority = 60,
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  homepage_order = 0,
  source_confidence = 'source_backed',
  updated_at = now()
where slug = 'pregnancy';

-- MEDA
-- Version 80.8, chapter 43 Medical & Death cases, pages 259-262.
-- This card is deliberately limited to the medical travel-exception workflow.
-- Death-case handling, fare tables, refund amounts, and screenshot details are not used.
update public.procedure_cards
set
  title = 'MEDA / Medical Travel Exception',
  category = 'Medical',
  service_code = null,
  service_type = 'Medical Assistance / Travel Exception',
  summary = 'Medical travel-exception workflow when a passenger has a certificate stating they are unfit to travel on the scheduled flight date.',
  when_to_use = 'Use when a passenger seeks a fee-free medical modification or cancellation and presents the documented medical scenario.',
  channels = jsonb_build_array('Contact Centre', 'Let''s Talk'),
  cut_off_time = $seed$After options are shared, the customer has 4 days to provide the preferred option.

The internal approval remains valid for 30 days from the date the options are shared.$seed$,
  who_can_action = jsonb_build_array('Contact Centre agent', 'Supervisor', 'Customer Service team'),
  required_information = jsonb_build_array('PNR or Let''s Talk case number', 'Medical certificate stating the passenger was unfit to travel by air on the scheduled flight date', 'Passenger preferred option after validation'),
  system_steps = jsonb_build_array(
    'Retrieve the PNR or Let''s Talk case and confirm the medical certificate states that the passenger was unfit to travel on the scheduled flight date.',
    'If the passenger has not emailed, ask them to email Let''s Talk with the medical certificate attached and explain that the request is subject to approval.',
    'If the documents are verified and options have been provided, check the fare or refund option with Floor Support or a Supervisor, escalate the case request, and update SPRINT.',
    'If documents are not verified or options have not been provided, escalate to a Supervisor for follow-up and update SPRINT.'
  ),
  passenger_advice = jsonb_build_array(
    'Email Let''s Talk with a medical certificate that states the passenger was unfit to travel on the scheduled flight date.',
    'The request is subject to validation and approval.',
    'Provide the preferred option within four days after options are shared.'
  ),
  allowed = jsonb_build_array('A medical exception may be considered after Customer Service validates the medical certificate and provides the applicable options.'),
  not_allowed = jsonb_build_array(
    'Do not offer a fee-free modification or cancellation before medical documents are validated.',
    'Do not confirm an outcome before the request is approved.'
  ),
  escalation_points = jsonb_build_array(
    'Escalate unverified documents or missing options to a Supervisor for follow-up.',
    'After verified documents and options are available, escalate the case request through the documented Customer Service process.'
  ),
  fees_charges = null,
  keywords = array['MEDA', 'medical exception', 'unfit to travel', 'medical certificate', 'fee-free change', 'medical refund'],
  aliases = array['MEDA', 'medical travel', 'medical cancellation', 'medical modification'],
  priority = 66,
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  homepage_order = 0,
  source_confidence = 'source_backed',
  updated_at = now()
where slug = 'meda';

-- Plaster cast / leg brace
-- Version 80.8, chapter 44 Passengers with medical conditions onboard - travelling with, pages 263-265.
-- Fields intentionally blank: escalation and non-text table/screenshot facts. This card is limited to cast and leg-brace travel.
update public.procedure_cards
set
  title = 'Plaster Cast / Leg Brace Travel',
  category = 'Medical',
  service_code = null,
  service_type = 'Medical Travel Eligibility Reference',
  summary = 'Travel and seating rules for a passenger with a plaster cast or leg brace.',
  when_to_use = 'Use for a passenger travelling with a plaster cast, leg brace, or a need to accommodate a leg in flight.',
  channels = jsonb_build_array('Contact Centre'),
  cut_off_time = $seed$A cast that is 48 hours old or less must be split and requires a medical certificate.

A cast more than 48 hours old may be accepted without a medical certificate when the documented travel conditions are met.$seed$,
  who_can_action = jsonb_build_array('Contact Centre agent'),
  required_information = jsonb_build_array('Whether the cast is full or half and whether it is below the knee', 'Time since the cast was applied', 'Whether the passenger can sit upright during taxi, take-off, and landing', 'Whether the passenger can move during the flight and an emergency without assistance', 'Medical certificate for a fresh cast', 'Cabin class and requested seat'),
  system_steps = jsonb_build_array(
    'Retrieve the PNR and identify the cast or leg-brace type and when it was applied.',
    'For a full cast or brace, arrange Business Class only; a half cast below the knee may travel in Economy or Business Class under the documented seating conditions.',
    'For a cast applied within 48 hours, confirm it is split and that a medical certificate is available.',
    'Assign a documented window-seat option; do not place the affected leg into the aisle.',
    'Record the cast or brace details in the PNR.'
  ),
  passenger_advice = jsonb_build_array(
    'A passenger with a cast applied within 48 hours needs a split cast and medical certificate.',
    'A full cast or brace requires Business Class; a Business Class upgrade can be purchased when the booked Economy seat cannot accommodate the leg.',
    'Carry one pair of crutches, braces, canes, a walker, or a prosthetic device as applicable.'
  ),
  allowed = jsonb_build_array(
    'A passenger may be accepted without a medical certificate when the cast is more than 48 hours old, they can sit upright, and they can move during the flight and an emergency without assistance.',
    'A half cast below the knee may be accepted in an Economy Class window XLGR first-row seat or a Business Class window seat.',
    'A full leg cast including the knee is accepted in a Business Class window seat only.'
  ),
  not_allowed = jsonb_build_array(
    'Do not accept a passenger with both legs in casts, a need to elevate legs, or a leg cast that does not fit within the booked-class legroom.',
    'Do not use an extra seat or XLGR in Economy Class to elevate a leg; only Business Class is permitted for leg elevation.',
    'Do not assign an emergency-exit-row seat.',
    'Do not assign an aisle seat unless it is requested or the only available option, and the leg must not extend into the aisle.'
  ),
  escalation_points = '[]'::jsonb,
  fees_charges = 'Standard seat charges apply for a Y-class window seat in the first row.',
  keywords = array['plaster cast', 'leg brace', 'cast', 'medical certificate', 'leg elevation', 'XLGR'],
  aliases = array['cast', 'plaster', 'leg brace', 'broken leg'],
  priority = 61,
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  homepage_order = 0,
  source_confidence = 'source_backed',
  updated_at = now()
where slug = 'plaster-cast-leg-brace';

-- DPNA
-- Version 80.8, chapter 35 Disabled Passenger with Intellectual or Developmental Disability Needs Assistance, page 171.
-- Fields intentionally blank: fees other than the documented free-of-cost row 29-31 assignment, and screenshot facts.
update public.procedure_cards
set
  title = 'DPNA Assistance',
  category = 'Special Assistance',
  service_code = 'DPNA',
  service_type = 'Special Assistance Service',
  summary = 'DXB assistance for a passenger with an intellectual or developmental disability who needs support.',
  when_to_use = 'Use when the passenger needs DPNA assistance at DXB airport.',
  channels = jsonb_build_array('Contact Centre', 'flydubai check-in counter at DXB'),
  cut_off_time = 'Add SSR DPNA up to 12 hours before departure.',
  who_can_action = jsonb_build_array('Contact Centre agent', 'Supervisor or Floor Support for a non-inclusive-seat-fare waiver', 'DXB check-in team'),
  required_information = jsonb_build_array('PNR', 'Passenger requiring assistance', 'Travel companion details', 'Assistance needed: priority check-in, priority boarding, or wheelchair'),
  system_steps = jsonb_build_array(
    'Retrieve the PNR and confirm that the passenger needs DPNA assistance.',
    'Add SSR DPNA to the passenger who needs assistance up to 12 hours before departure.',
    'Assign adjoining seats for the DPNA passenger and one travel companion, using only a window or middle seat for the DPNA passenger.',
    'For a non-inclusive seat fare, escalate the seat assignment request to Supervisor or Floor Support; for a seat-inclusive fare, assign adjoining seats excluding emergency-exit seats.',
    'Update SPRINT comments with the required assistance.'
  ),
  passenger_advice = jsonb_build_array(
    'A travel companion must travel in the same cabin and provide constant supervision and support.',
    'Approach the flydubai check-in counter for priority check-in, priority boarding, and a wheelchair when needed.',
    'Additional airport assistance is subject to approval at check-in.'
  ),
  allowed = jsonb_build_array(
    'DPNA assistance includes priority check-in, priority boarding, and wheelchair assistance when needed at DXB.',
    'Rows 29-31 may be assigned free of charge for a non-inclusive seat fare after Supervisor or Floor Support approval.',
    'The passenger receives assistance during disembarkation and baggage claim.'
  ),
  not_allowed = jsonb_build_array(
    'Do not accept DPNA travel without a companion in the same cabin for constant supervision and support.',
    'Do not assign an emergency-exit-row seat.',
    'Do not assign an aisle seat to the DPNA passenger.',
    'Do not commit to additional airport assistance before approval at check-in.'
  ),
  escalation_points = jsonb_build_array(
    'Escalate a non-inclusive-seat-fare waiver request to Supervisor or Floor Support.',
    'Additional airport assistance is decided at check-in.'
  ),
  fees_charges = null,
  keywords = array['DPNA', 'disabled passenger', 'intellectual disability', 'developmental disability', 'priority check-in', 'special assistance'],
  aliases = array['DPNA', 'hidden disability', 'autism', 'dementia', 'Down Syndrome'],
  priority = 64,
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  homepage_order = 0,
  source_confidence = 'source_backed',
  updated_at = now()
where slug = 'dpna';

-- Batch status report.
select
  slug,
  title,
  review_status,
  is_published,
  show_on_homepage,
  homepage_order,
  service_code,
  service_type,
  cut_off_time,
  fees_charges,
  source_confidence
from public.procedure_cards
where slug in ('meal', 'pregnancy', 'meda', 'plaster-cast-leg-brace', 'dpna')
order by slug;

-- Generic-filler check, limited to this batch.
select
  slug,
  array_remove(array[
    case when lower(coalesce(summary, '')) ~ 'check source|according to source|source-backed|linked source|where source allows|pending review|escalate unclear|refer to source chapter' then 'summary' end,
    case when lower(coalesce(when_to_use, '')) ~ 'check source|according to source|source-backed|linked source|where source allows|pending review|escalate unclear|refer to source chapter' then 'when_to_use' end,
    case when lower(coalesce(jsonb_pretty(required_information), '')) ~ 'check source|according to source|source-backed|linked source|where source allows|pending review|escalate unclear|refer to source chapter' then 'required_information' end,
    case when lower(coalesce(jsonb_pretty(system_steps), '')) ~ 'check source|according to source|source-backed|linked source|where source allows|pending review|escalate unclear|refer to source chapter' then 'system_steps' end,
    case when lower(coalesce(jsonb_pretty(passenger_advice), '')) ~ 'check source|according to source|source-backed|linked source|where source allows|pending review|escalate unclear|refer to source chapter' then 'passenger_advice' end,
    case when lower(coalesce(jsonb_pretty(allowed), '')) ~ 'check source|according to source|source-backed|linked source|where source allows|pending review|escalate unclear|refer to source chapter' then 'allowed' end,
    case when lower(coalesce(jsonb_pretty(not_allowed), '')) ~ 'check source|according to source|source-backed|linked source|where source allows|pending review|escalate unclear|refer to source chapter' then 'not_allowed' end,
    case when lower(coalesce(jsonb_pretty(escalation_points), '')) ~ 'check source|according to source|source-backed|linked source|where source allows|pending review|escalate unclear|refer to source chapter' then 'escalation_points' end,
    case when lower(coalesce(fees_charges, '')) ~ 'check source|according to source|source-backed|linked source|where source allows|pending review|escalate unclear|refer to source chapter' then 'fees_charges' end
  ], null) as filler_fields
from public.procedure_cards
where slug in ('meal', 'pregnancy', 'meda', 'plaster-cast-leg-brace', 'dpna')
order by slug;

-- Timing and document summary for review.
select
  slug,
  cut_off_time,
  required_information,
  not_allowed,
  escalation_points
from public.procedure_cards
where slug in ('meal', 'pregnancy', 'meda', 'plaster-cast-leg-brace', 'dpna')
order by slug;

-- Narrow-scope report for medical travel-exception and plaster-cast cards.
select
  slug,
  title,
  summary,
  when_to_use,
  service_code,
  service_type,
  required_information,
  cut_off_time,
  fees_charges
from public.procedure_cards
where slug in ('meda', 'plaster-cast-leg-brace')
order by slug;
