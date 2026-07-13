-- ============================================================
-- Verified operational content: batch 1
--
-- Source of truth: The GO TO document.pdf (v80.8, 23-Jun-2026).
-- This file intentionally leaves fields blank where a rule depends on
-- an unparsed table, screenshot, or a scenario not stated in source text.
-- It does not approve, publish, feature, or record a review for any card.
-- ============================================================

-- Visa
-- Source: Travel Requirements to travel from UAE, PDF page 270.
-- The extracted source covers UAE-residency return travel only. Channels,
-- fees, cut-off, escalation, and broader visa scenarios are intentionally blank.
update public.procedure_cards
set
  title = 'Visa',
  category = 'Travel Documents',
  service_code = 'VISA',
  service_type = 'Travel Document / Visa Reference',
  summary = 'UAE residency travel-document guidance for passengers departing Dubai and returning to the UAE.',
  when_to_use = 'Use when a UAE resident is travelling from Dubai and returning to the UAE.',
  channels = '[]'::jsonb,
  cut_off_time = null,
  who_can_action = '[]'::jsonb,
  required_information = jsonb_build_array('Original Emirates ID for the UAE residency return-travel scenario'),
  system_steps = jsonb_build_array(
    'Confirm the passenger has the original Emirates ID for the UAE residency return-travel scenario.',
    'Advise the passenger to check the relevant authorities for the latest entry and exit requirements before travel.'
  ),
  passenger_advice = jsonb_build_array(
    'Carry the original Emirates ID when departing Dubai and returning as a UAE resident.',
    'Check the relevant authorities for the latest entry and exit requirements before travel.'
  ),
  allowed = jsonb_build_array('The original Emirates ID is accepted as proof of UAE residency for this travel scenario.'),
  not_allowed = jsonb_build_array('Do not rely on a resident-visa sticker as proof of UAE residency for this scenario.'),
  escalation_points = '[]'::jsonb,
  fees_charges = null,
  keywords = array['visa', 'UAE residency', 'Emirates ID', 'travel requirements'],
  aliases = array['VISA', 'UAE visa', 'Emirates ID'],
  priority = 70,
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  homepage_order = 0,
  source_confidence = 'source_backed',
  updated_at = now()
where slug = 'visa';

-- OK to Board (OKTB)
-- Source: Ok to Board (OKTB), PDF pages 270-272.
-- The manual-add steps are explicitly for EK* and Floor Support/Supervisors.
-- Cut-off, fees, and broader eligibility are intentionally blank; the source
-- directs users to the official flydubai OKTB page for the current policy.
update public.procedure_cards
set
  title = 'OK to Board',
  category = 'Travel Documents',
  service_code = 'OKTB',
  service_type = 'Travel Document Service',
  summary = 'Manual OKTB-add process for EK* flights, restricted in the source to Floor Support and Supervisors.',
  when_to_use = 'Use for the EK* manual-add scenario described in the OKTB chapter.',
  channels = jsonb_build_array('Official flydubai OKTB website'),
  cut_off_time = null,
  who_can_action = jsonb_build_array('Floor Support', 'Supervisor'),
  required_information = jsonb_build_array('Booking requiring the EK* OKTB action'),
  system_steps = jsonb_build_array(
    'Take control of the booking.',
    'Open Add services.',
    'Select carrier EK*, category UAE Visit Visa, then select OKTB and add the service.',
    'Update the PNR comments with the action taken and release control of the reservation.'
  ),
  passenger_advice = jsonb_build_array('Refer to the official flydubai OKTB page for the current OKTB policy.'),
  allowed = jsonb_build_array('The manual-add process applies to EK* flights handled by Floor Support and Supervisors.'),
  not_allowed = jsonb_build_array('Do not apply the EK* manual-add process outside the Floor Support/Supervisor scope.'),
  escalation_points = jsonb_build_array('Refer the EK* manual-add scenario to Floor Support or a Supervisor.'),
  fees_charges = null,
  keywords = array['OKTB', 'OK to Board', 'EK', 'UAE Visit Visa'],
  aliases = array['OKTB', 'OK to Board', 'OK TO'],
  priority = 68,
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  homepage_order = 0,
  source_confidence = 'source_backed',
  updated_at = now()
where slug = 'ok-to-board';

-- Payment
-- Source: Payment, PDF pages 187-253. The chapter contains multiple payment
-- products and several screenshot/table-heavy flows. This card records only
-- direct, general payment guidance plus the clearly stated Pay by Cash block.
-- Cut-off, required-information, escalation, and fees remain blank because they
-- vary by payment method or rely on tables/screenshots.
update public.procedure_cards
set
  title = 'Payment',
  category = 'Payment',
  service_code = 'PAYMENT',
  service_type = 'Payment Process',
  summary = 'Payment options and restrictions for flydubai new and existing bookings.',
  when_to_use = 'Use when a passenger asks about an available payment method or a Pay by Cash restriction.',
  channels = jsonb_build_array('flydubai website', 'Mobile app', 'Payment link', 'Contact Centre', 'Travel Shop', 'Payment partner'),
  cut_off_time = null,
  who_can_action = jsonb_build_array('Contact Centre agent for applicable payment guidance', 'Travel Shop or payment partner for Pay by Cash balance clearance'),
  required_information = '[]'::jsonb,
  system_steps = jsonb_build_array(
    'Identify the payment method selected for the booking.',
    'For a Pay by Cash booking, direct the passenger to a flydubai travel shop or travel partner to clear the balance.',
    'For a Pay by Cash booking, do not complete payment through ENT or IVR.'
  ),
  passenger_advice = jsonb_build_array(
    'Pay by Cash balances can be cleared only through a flydubai travel shop or travel partner.',
    'A service fee may be collected by the travel shop or travel partner for Pay by Cash.'
  ),
  allowed = jsonb_build_array('Pay by Cash is available only for a new booking created through the website or mobile app.'),
  not_allowed = jsonb_build_array(
    'Do not make changes to a Pay by Cash booking until the payment is cleared.',
    'Agents must not complete Pay by Cash payment through ENT or IVR.',
    'Do not use Pay by Cash for a booking created outside the website or mobile-app new-booking flow.'
  ),
  escalation_points = '[]'::jsonb,
  fees_charges = null,
  keywords = array['payment', 'credit card', 'debit card', 'payment link', 'pay by cash'],
  aliases = array['PAYMENT', 'Pay by Cash', 'payment link'],
  priority = 72,
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  homepage_order = 0,
  source_confidence = 'source_backed',
  updated_at = now()
where slug = 'payment';

-- Voucher
-- Source: Voucher, PDF pages 254-257.
-- Name-correction charges and unsupported manual-voucher scenarios are not
-- populated here because the source routes those outcomes through separate
-- approval/process paths.
update public.procedure_cards
set
  title = 'Voucher',
  category = 'Refund',
  service_code = 'VOUCHER',
  service_type = 'Refund / Voucher Process',
  summary = 'Voucher servicing for validity, resend requests, and eligible rename or correction requests.',
  when_to_use = 'Use for a flydubai voucher resend, validity, rename, or name-correction request.',
  channels = jsonb_build_array('Contact Centre', 'Let''s Talk'),
  cut_off_time = 'Voucher validity is 12 months from the date of issuance. Manual voucher validity may differ; follow the voucher receipt email.',
  who_can_action = jsonb_build_array('Contact Centre agent', 'Customer Service for voucher requests requiring follow-up'),
  required_information = jsonb_build_array('PNR or voucher number', 'Customer details for verification', 'Registered email address for a resend request'),
  system_steps = jsonb_build_array(
    'For a resend to the registered email address: obtain the PNR or voucher number, verify customer details, confirm the email address phonetically, and resend the voucher.',
    'For a resend to a different email address: complete security verification, update each passenger contact email, save the changes, then retrieve each voucher in the voucher module and resend it.',
    'For a voucher issued with an incorrect or incomplete passenger name because of a system issue, advise the customer to email Let''s Talk with a passport copy.'
  ),
  passenger_advice = jsonb_build_array(
    'A resent voucher may take up to one hour to be delivered.',
    'Voucher refunds are issued in the currency of the original point of departure.',
    'A voucher is issued under the passenger name and may be renamed only under the payer name in the booking when eligible.'
  ),
  allowed = jsonb_build_array(
    'Contact Centre may resend a voucher to the registered email address after verification.',
    'An unused voucher may be renamed under the payer name in the booking when the documented process is followed.'
  ),
  not_allowed = jsonb_build_array(
    'A voucher renamed under the payer name cannot be changed back to the original passenger name.',
    'A partially used voucher cannot be renamed.',
    'Manual voucher name correction or change is not permitted.'
  ),
  escalation_points = jsonb_build_array('For an eligible voucher name-correction request, follow the documented Let''s Talk and Customer Service process.'),
  fees_charges = null,
  keywords = array['voucher', 'vouchers', 'voucher resend', 'voucher rename', 'voucher correction'],
  aliases = array['VOUCHER', 'voucher resend', 'voucher name change'],
  priority = 74,
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  homepage_order = 0,
  source_confidence = 'source_backed',
  updated_at = now()
where slug = 'voucher';

-- Ways to Check-in / OLCI
-- Source: Ways to Check-in, PDF pages 279-293. The station/destination lists,
-- screenshots, and the detailed offload table are deliberately not reproduced.
-- The card retains only direct timing, eligibility, and escalation statements.
update public.procedure_cards
set
  title = 'Check-in / OLCI',
  category = 'Check-in',
  service_code = 'OLCI',
  service_type = 'Check-in Reference',
  summary = 'Online and airport check-in guidance, including OLCI eligibility and post-check-in offload handling.',
  when_to_use = 'Use for online check-in, airport check-in, or a modification/cancellation request after online check-in.',
  channels = jsonb_build_array('flydubai website', 'Mobile application', 'Airport check-in counter', 'Contact Centre'),
  cut_off_time = 'Online check-in is available from 48 hours until 75 minutes before departure.',
  who_can_action = jsonb_build_array('Passenger through online check-in', 'Airport check-in team', 'Contact Centre agent for post-OLCI modification or cancellation requests', 'Supervisor for offload requests'),
  required_information = jsonb_build_array('Booking reference and departure airport, or the primary passenger last name', 'Flight departure time', 'Current check-in status'),
  system_steps = jsonb_build_array(
    'For online check-in, use the booking reference and departure airport or the primary passenger last name.',
    'For a modification or cancellation request after online check-in, honour the request and escalate the case to a Supervisor to offload the passenger.',
    'For an online-check-in issue, advise the passenger to report to the check-in counter at least three hours before departure for normal airport check-in.'
  ),
  passenger_advice = jsonb_build_array(
    'Online check-in opens 48 hours and closes 75 minutes before departure.',
    'Airport passengers should arrive at least 60 minutes before departure; boarding gates close 25 minutes before departure.',
    'For an online-check-in issue, report to the check-in counter at least three hours before departure for normal airport check-in.'
  ),
  allowed = jsonb_build_array('An offload request after online check-in is applicable up to 60 minutes before departure.'),
  not_allowed = jsonb_build_array(
    'Online check-in is not eligible when the booking requires debit or credit card verification at the airport check-in desk.',
    'Online check-in is not eligible when the customer has a special request for cabin baggage or requests an extra seat.',
    'Offload requests to add SSRs will not be honoured.',
    'Contact Centre must reject offload requests for passengers checked in at the airport.'
  ),
  escalation_points = jsonb_build_array('Escalate a post-OLCI modification or cancellation case to a Supervisor for offload.'),
  fees_charges = null,
  keywords = array['OLCI', 'online check-in', 'check-in', 'offload', 'airport check-in'],
  aliases = array['OLCI', 'online check-in', 'online checkin', 'check in'],
  priority = 78,
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  homepage_order = 0,
  source_confidence = 'source_backed',
  updated_at = now()
where slug = 'check-in-olci';

-- Review report: confirm workflow state and key source-backed fields.
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
  source_confidence,
  updated_at
from public.procedure_cards
where slug in ('visa', 'ok-to-board', 'payment', 'voucher', 'check-in-olci')
order by slug;

-- Generic-filler check, limited to this batch.
select
  slug,
  array_remove(array[
    case when lower(coalesce(summary, '')) ~ 'source chapter|source-supported|linked source|quality review|check the source|according to source|source rules|source process|pending source review|draft operational card|use this card after|where source allows|escalate unclear' then 'summary' end,
    case when lower(coalesce(when_to_use, '')) ~ 'source chapter|source-supported|linked source|quality review|check the source|according to source|source rules|source process|pending source review|draft operational card|use this card after|where source allows|escalate unclear' then 'when_to_use' end,
    case when lower(coalesce(jsonb_pretty(system_steps), '')) ~ 'source chapter|source-supported|linked source|quality review|check the source|according to source|source rules|source process|pending source review|draft operational card|use this card after|where source allows|escalate unclear' then 'system_steps' end,
    case when lower(coalesce(jsonb_pretty(passenger_advice), '')) ~ 'source chapter|source-supported|linked source|quality review|check the source|according to source|source rules|source process|pending source review|draft operational card|use this card after|where source allows|escalate unclear' then 'passenger_advice' end
  ], null) as filler_fields
from public.procedure_cards
where slug in ('visa', 'ok-to-board', 'payment', 'voucher', 'check-in-olci')
order by slug;
