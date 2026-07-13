-- ============================================================
-- Verified operational content batch 3
-- PDF version: 80.8 (23-Jun-2026)
--
-- Scope: GDS, Fare Types, Staff Tickets, Travel Insurance, Seat Assignment.
-- Safety: updates only the five existing cards below. It does not change
-- chapter_id or review metadata and does not approve, publish, or feature cards.
-- ============================================================

-- GDS Booking | PDF v80.8 | chapter 16 GDS booking | pages 54-59.
-- Confirmed: agency ownership, Contact Centre exceptions, unpaid GDS seat block,
-- and preferred-seat timing. Fee amounts and unrelated GDS tables are unused.
update public.procedure_cards
set
  title = 'GDS Booking',
  category = 'GDS',
  service_code = 'GDS',
  service_type = 'GDS Reference',
  summary = 'Handling boundaries for bookings made by travel agencies through GDS.',
  when_to_use = 'Use for a travel-agency GDS booking request, including supported Contact Centre servicing and unpaid-seat queries.',
  channels = jsonb_build_array('Contact Centre', 'Travel agency', 'flydubai Travel Shop'),
  cut_off_time = $seed$Preferred Economy seats can be purchased up to 3 hours before departure.
GDS support hours: Monday-Saturday 08:00-20:00; Sunday 10:00-18:30 (Dubai local time).$seed$,
  who_can_action = jsonb_build_array('Travel agency for modifications, cancellations, balance-due payments, and SSR changes', 'Contact Centre for approved limited actions', 'GDS Support for an unpaid GDS booking raised by a travel agent'),
  required_information = jsonb_build_array('PNR', 'Ticket or booking status', 'Requested service', 'Whether the booking has a balance due'),
  system_steps = jsonb_build_array('Identify that the booking was made through GDS.', 'Confirm whether the requested action is one of the Contact Centre exceptions.', 'For a permitted request, complete the approved service in SPRINT.', 'For an unpaid GDS booking, direct the passenger to the travel agency.'),
  passenger_advice = jsonb_build_array('For booking modifications, cancellations, payments due, or SSR changes, contact the travel agency that issued the booking.', 'A preferred Economy seat is chargeable and subject to availability.'),
  allowed = jsonb_build_array('Contact Centre may update Skywards number, email address, or telephone number.', 'Contact Centre may assist with seats, special meals, wheelchair, sporting equipment, and resending a ticket receipt.'),
  not_allowed = jsonb_build_array('Do not modify, cancel, collect a balance-due payment, or add, modify, or cancel SSRs on a GDS booking.', 'Do not assign a charged seat while a GDS booking is fully unpaid or has a segment balance due.', 'Do not advise the ticket fare or balance due for a GDS date modification.'),
  escalation_points = jsonb_build_array('A travel agent reporting an unpaid GDS booking should be directed to GDS Support.', 'Travel agency callers should use the travel-agency servicing route for their booking actions.'),
  fees_charges = null,
  keywords = array['GDS', 'travel agency', 'agency booking', 'PNR', 'unpaid booking', 'preferred seat'],
  aliases = array['GDS booking', 'travel agent booking', 'agency PNR'],
  priority = 62,
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  homepage_order = 0,
  source_confidence = 'source_backed',
  updated_at = now()
where slug = 'gds';

-- Fare Types | PDF v80.8 | chapter 11 Fare Types | pages 44-49.
-- Confirmed: fare-brand rule lookup, change/cancel treatment, partial-cancel,
-- voucher and optional-extra rules. Large fare tables and variable fee amounts are unused.
update public.procedure_cards
set
  title = 'Fare Types',
  category = 'Fares',
  service_code = null,
  service_type = 'Fare Reference',
  summary = 'Fare-brand rules for booking changes, cancellations, refunds, and included services.',
  when_to_use = 'Use when a passenger asks what their fare permits or requests a change, cancellation, or refund.',
  channels = jsonb_build_array('Contact Centre', 'SPRINT'),
  cut_off_time = $seed$Optional extras such as meals, baggage, and seats can be cancelled only up to 24 hours before departure.
For a non-DCS station, pre-flight changes are permitted more than 60 minutes before departure.$seed$,
  who_can_action = jsonb_build_array('Contact Centre agent using SPRINT fare rules'),
  required_information = jsonb_build_array('PNR', 'Fare brand', 'Flight/date', 'Requested change or cancellation', 'Booking and check-in status'),
  system_steps = jsonb_build_array('Retrieve the booking and verify that the segment status is active.', 'Open the applicable fare rules in SPRINT.', 'Confirm the change, cancellation, refund, or included-service rule for the fare brand.', 'Apply the displayed fare difference and applicable fee when the rule permits the request.'),
  passenger_advice = jsonb_build_array('Fare conditions determine included services, changes, cancellations, and refunds.', 'A non-refundable fare returns only applicable taxes when cancelled.', 'A cancellation refund is issued as a flydubai voucher valid for flights and optional extras for 12 months from issue.'),
  allowed = jsonb_build_array('Rebooking and cancellation are handled under the fare rules shown in SPRINT.', 'A child or infant added to a booking must use the same fare brand as the existing passengers.'),
  not_allowed = jsonb_build_array('Do not partially cancel a journey that has not started; cancel the entire booking.', 'Do not change a checked-in passenger before the passenger is offloaded.', 'Do not promise a fixed fee because fees and fare differences depend on the displayed fare rule.'),
  escalation_points = jsonb_build_array(),
  fees_charges = null,
  keywords = array['fare types', 'fare brand', 'Lite', 'Value', 'Flex', 'Business', 'fare rules', 'refund'],
  aliases = array['fare rules', 'fare brand', 'Lite fare', 'Value fare', 'Flex fare'],
  priority = 58,
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  homepage_order = 0,
  source_confidence = 'source_backed',
  updated_at = now()
where slug = 'fare-types';

-- Staff Tickets | PDF v80.8 | Staff Tickets chapter linked to this card.
-- The extracted chapter does not expose a reliable operational table in text.
-- Only the narrow source-confirmed ticket-type reference is retained; timing,
-- fees, credentials, and screenshot/table details are intentionally blank.
update public.procedure_cards
set
  title = 'Staff Tickets',
  category = 'Staff Travel',
  service_code = 'ID50 / ID90',
  service_type = 'Staff Travel Reference',
  summary = 'Reference for staff-travel ticket types.',
  when_to_use = 'Use for an ID50 or ID90 staff-ticket query.',
  channels = jsonb_build_array(),
  cut_off_time = null,
  who_can_action = jsonb_build_array(),
  required_information = jsonb_build_array('Staff ticket type', 'PNR when available', 'Travel date and route', 'Requested service'),
  system_steps = jsonb_build_array(),
  passenger_advice = jsonb_build_array(),
  allowed = jsonb_build_array(),
  not_allowed = jsonb_build_array('Do not treat an ID50 or ID90 ticket as a standard commercial booking.'),
  escalation_points = jsonb_build_array(),
  fees_charges = null,
  keywords = array['staff tickets', 'staff travel', 'ID50', 'ID90'],
  aliases = array['ID50', 'ID90', 'staff travel'],
  priority = 57,
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  homepage_order = 0,
  source_confidence = 'source_backed',
  updated_at = now()
where slug = 'staff-tickets';

-- Travel Insurance | PDF v80.8 | chapter 39 Travel Insurance | pages 184-185.
-- Confirmed: INSU SSR, channel and booking exclusions, timing, async-booking,
-- policy resend, and coverage limits. Price slab screenshots/tables are unused.
update public.procedure_cards
set
  title = 'Travel Insurance',
  category = 'Ancillary',
  service_code = 'INSU',
  service_type = 'Ancillary Service',
  summary = 'XCover travel-insurance handling for eligible flydubai bookings.',
  when_to_use = 'Use for an insurance purchase, eligibility, policy-email, or asynchronous-booking query.',
  channels = jsonb_build_array('flydubai booking channels', 'Contact Centre', 'Salesforce for policy-email resend'),
  cut_off_time = $seed$Insurance can be added at any time before the journey starts.
Coverage is available for trips up to 90 days when the trip starts within 150 days of booking.$seed$,
  who_can_action = jsonb_build_array('Contact Centre agent for purchase guidance and policy-email resend intake', 'Supervisor or Floor Support for a policy-email resend', 'Shift in Charge for an asynchronous booking query'),
  required_information = jsonb_build_array('PNR', 'Passenger type', 'Trip dates and duration', 'Booking type', 'Whether the booking is asynchronous', 'Policy-email resend request when applicable'),
  system_steps = jsonb_build_array('Retrieve the booking and confirm the passenger and booking are eligible.', 'Confirm the journey has not started and the trip duration is within the stated coverage limit.', 'For a policy-email resend, create and escalate a Salesforce case with the PNR.', 'Check the Services tab for SSR INSU, policy number, and policy status.'),
  passenger_advice = jsonb_build_array('The policy email is sent by XCover to the booking passenger after a successful purchase.', 'Insurance is not available for infants.', 'For a modified booking that becomes asynchronous, the existing cover remains with XCover on the original dates.'),
  allowed = jsonb_build_array('Insurance is available for adult and child passengers on eligible booking types.', 'Insurance may be added for added passengers or segments where the booking remains eligible.'),
  not_allowed = jsonb_build_array('Do not offer insurance through GDS or OTA.', 'Do not add insurance to multi-city, interline, codeshare, or asynchronous bookings.', 'Do not expect insurance to transfer to a modified booking that becomes asynchronous.'),
  escalation_points = jsonb_build_array('Escalate an asynchronous-booking insurance request to Shift in Charge.', 'Policy-email resend cases are handled by Supervisor or Floor Support after Salesforce escalation.'),
  fees_charges = null,
  keywords = array['insurance', 'XCover', 'INSU', 'travel insurance', 'policy email'],
  aliases = array['INSU', 'XCover', 'policy resend'],
  priority = 56,
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  homepage_order = 0,
  source_confidence = 'source_backed',
  updated_at = now()
where slug = 'insurance';

-- Seat Assignment | PDF v80.8 | chapter 33 Seat | pages 144-163.
-- Confirmed: timing, chargeability, exit-row eligibility, GDS balance block,
-- travel-agency boundary, and circular-flight rule. Fee amounts/screenshots are unused.
update public.procedure_cards
set
  title = 'Seat Assignment',
  category = 'Seats',
  service_code = null,
  service_type = 'Seat Service',
  summary = 'Pre-purchased and assigned-seat handling for flydubai-operated flights.',
  when_to_use = 'Use for a seat request, a preferred-seat payment question, or an exit-row eligibility query.',
  channels = jsonb_build_array('Contact Centre', 'Travel agency portal', 'Airport check-in'),
  cut_off_time = 'Seats can be selected up to 3 hours before departure, subject to availability.',
  who_can_action = jsonb_build_array('Contact Centre for flydubai-operated flights, except G fares', 'Travel agency through the travel-agency portal', 'Airport check-in for seats not pre-purchased'),
  required_information = jsonb_build_array('PNR', 'Flight/date', 'Requested seat', 'Fare or booking status', 'Passenger age and assistance requirements', 'Whether the GDS booking has a balance due'),
  system_steps = jsonb_build_array('Retrieve the booking and confirm the requested flight is flydubai-operated.', 'Check seat availability, fare entitlement, and passenger eligibility.', 'For a circular flight, confirm the same seat is available on every leg before assigning it.', 'For a GDS booking with balance due, direct the passenger to the travel agency.'),
  passenger_advice = jsonb_build_array('Seat selection is subject to availability.', 'Passengers without a pre-purchased seat may receive a free seat at check-in, except extra-legroom rows.', 'An exit-row passenger may be reseated without refund if they cannot assist in an emergency.'),
  allowed = jsonb_build_array('Economy passengers may pre-purchase a preferred seat subject to availability.', 'Business passengers may select a seat free of charge in the Business cabin, subject to availability.', 'Contact Centre can assist with flydubai-operated flights except G fares.'),
  not_allowed = jsonb_build_array('Do not assign an emergency-exit seat to a passenger under 16 years old.', 'Do not assign an emergency-exit seat to a passenger travelling with an infant, needing assistance, pregnant, or unable to meet the stated mobility, health, language, hearing, or sight requirements.', 'Do not assign a charged seat on a fully unpaid or balance-due GDS booking.'),
  escalation_points = jsonb_build_array('Travel-agency callers should use the travel-agency portal; Contact Centre may assist after travel-agency hours.', 'Use Agency Support for travel-agency portal issues.'),
  fees_charges = null,
  keywords = array['seat', 'seat assignment', 'preferred seat', 'exit row', 'extra legroom'],
  aliases = array['seat selection', 'preferred seat', 'emergency exit seat'],
  priority = 65,
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  homepage_order = 0,
  source_confidence = 'source_backed',
  updated_at = now()
where slug = 'seat-assignment';

-- Status report for this batch.
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
where slug in ('gds', 'fare-types', 'staff-tickets', 'insurance', 'seat-assignment')
order by slug;

-- Generic filler detector for fields changed in this batch.
select
  slug,
  field_name,
  field_value
from public.procedure_cards as procedure,
lateral (
  values
    ('summary', coalesce(procedure.summary, '')),
    ('when_to_use', coalesce(procedure.when_to_use, '')),
    ('fees_charges', coalesce(procedure.fees_charges, '')),
    ('system_steps', coalesce(procedure.system_steps::text, '')),
    ('passenger_advice', coalesce(procedure.passenger_advice::text, '')),
    ('not_allowed', coalesce(procedure.not_allowed::text, '')),
    ('escalation_points', coalesce(procedure.escalation_points::text, ''))
) as checked(field_name, field_value)
where procedure.slug in ('gds', 'fare-types', 'staff-tickets', 'insurance', 'seat-assignment')
  and lower(checked.field_value) similar to '%(source chapter|source-supported|linked source|quality review|check the source|according to source|source rules|source process|pending source review|draft operational card|use this card after|where source allows|escalate unclear)%'
order by procedure.slug, checked.field_name;

-- Narrow scope report.
select slug, title, summary, when_to_use, service_type
from public.procedure_cards
where slug in ('gds', 'fare-types', 'staff-tickets', 'insurance', 'seat-assignment')
order by slug;

-- Timing, fee, restriction, and escalation report.
select slug, cut_off_time, fees_charges, not_allowed, escalation_points
from public.procedure_cards
where slug in ('gds', 'fare-types', 'staff-tickets', 'insurance', 'seat-assignment')
order by slug;
