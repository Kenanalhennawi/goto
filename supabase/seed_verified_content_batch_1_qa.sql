-- ============================================================
-- QA correction: verified operational content batch 1
-- PDF version: 80.8 (23-Jun-2026)
--
-- This correction updates only the five named draft cards. It preserves
-- chapter_id, last_reviewed_at, and last_reviewed_by. No card is approved,
-- published, or featured by this script.
-- ============================================================

-- Visa
-- Version 80.8: Travel Requirements to travel from UAE, page 270.
-- Scope is limited to the original-Emirates-ID UAE-residency scenario. General
-- visa policy, deadlines, channels, fees, escalation, and any contact list are omitted.
update public.procedure_cards
set
  title = 'UAE Residency Travel Documents',
  category = 'Travel Documents',
  service_code = 'VISA',
  service_type = 'Travel Document / Visa Reference',
  summary = 'This card covers only the UAE-residency and original Emirates ID scenario included in the manual.',
  when_to_use = 'Use when a UAE resident is departing Dubai and returning to the UAE.',
  channels = '[]'::jsonb,
  cut_off_time = null,
  who_can_action = '[]'::jsonb,
  required_information = jsonb_build_array('Original Emirates ID for the UAE-residency return-travel scenario'),
  system_steps = jsonb_build_array(
    'Confirm the passenger has the original Emirates ID for the UAE-residency return-travel scenario.',
    'Advise the passenger to obtain the latest entry and exit requirements from the relevant authorities before travel.'
  ),
  passenger_advice = jsonb_build_array(
    'Carry the original Emirates ID when departing Dubai and returning as a UAE resident.',
    'Travel requirements can change without prior notice; obtain the latest entry and exit requirements from the relevant authorities before travel.'
  ),
  allowed = jsonb_build_array('The original Emirates ID is accepted as proof of UAE residency for this travel scenario.'),
  not_allowed = jsonb_build_array('Do not rely on a resident-visa sticker as proof of UAE residency for this scenario.'),
  escalation_points = '[]'::jsonb,
  fees_charges = null,
  keywords = array['visa', 'UAE visa', 'UAE residency', 'Emirates ID', 'travel documents'],
  aliases = array['VISA', 'UAE visa', 'Emirates ID'],
  priority = 70,
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  homepage_order = 0,
  source_confidence = 'source_backed',
  updated_at = now()
where slug = 'visa';

-- OK to Board
-- Version 80.8: Ok to Board (OKTB), pages 270-272.
-- The documented workflow is only for EK* flights, UAE Visit Visa, and Floor
-- Support/Supervisor handling. General eligibility, fees, cut-off, and nationality
-- rules are omitted. Screenshots are not used as facts.
update public.procedure_cards
set
  title = 'OK to Board - EK* Manual Add',
  category = 'Travel Documents',
  service_code = 'OKTB',
  service_type = 'Travel Document Service',
  summary = 'Manual EK* OKTB add process for the UAE Visit Visa category, handled by Floor Support or a Supervisor.',
  when_to_use = 'Use for the EK* manual-add scenario described in the OKTB procedure.',
  channels = jsonb_build_array('Official flydubai OKTB website'),
  cut_off_time = null,
  who_can_action = jsonb_build_array('Floor Support', 'Supervisor'),
  required_information = jsonb_build_array('EK* booking requiring an OKTB action', 'UAE Visit Visa category'),
  system_steps = jsonb_build_array(
    'Take control of the booking.',
    'Open Add services.',
    'Select carrier EK*, category UAE Visit Visa, then select OKTB and add the service.',
    'Update PNR comments with the action taken and release control of the reservation.'
  ),
  passenger_advice = jsonb_build_array('Use the official flydubai OKTB website for the current OKTB policy.'),
  allowed = jsonb_build_array('The manual-add process applies to EK* flights handled by Floor Support or a Supervisor.'),
  not_allowed = jsonb_build_array('Do not apply this EK* manual-add procedure outside the Floor Support/Supervisor scope.'),
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

-- Payment - Pay by Cash
-- Version 80.8: Payment, pages 187-253; verified facts used from Pay by Cash.
-- Card verification, payment links, duplicate payment, failed payment, product
-- tables, and payment-method-specific fees are intentionally omitted.
update public.procedure_cards
set
  title = 'Payment - Pay by Cash',
  category = 'Payment',
  service_code = 'PAYMENT',
  service_type = 'Payment Process',
  summary = 'Verified Pay by Cash rules for a new booking created through the website or mobile app.',
  when_to_use = 'Use when a booking shows the Pay by Cash payment method.',
  channels = jsonb_build_array('flydubai Travel Shop', 'Travel partner'),
  cut_off_time = null,
  who_can_action = jsonb_build_array('Travel Shop', 'Travel partner'),
  required_information = jsonb_build_array('Booking showing the Pay by Cash notification'),
  system_steps = jsonb_build_array(
    'Retrieve the booking and identify the Pay by Cash notification.',
    'Direct the passenger to a flydubai travel shop or travel partner to clear the balance.',
    'Do not complete the payment through ENT or IVR.'
  ),
  passenger_advice = jsonb_build_array(
    'Clear the balance only through a flydubai travel shop or travel partner.',
    'A service fee may be collected by the travel shop or travel partner.'
  ),
  allowed = jsonb_build_array('Pay by Cash is valid only for a new booking created through the website or mobile app.'),
  not_allowed = jsonb_build_array(
    'Do not make changes to the booking until payment is cleared.',
    'Do not complete Pay by Cash through ENT or IVR.',
    'Do not use Pay by Cash for a booking created outside the website or mobile-app new-booking flow.'
  ),
  escalation_points = '[]'::jsonb,
  fees_charges = null,
  keywords = array['payment', 'pay by cash', 'travel shop', 'payment partner'],
  aliases = array['PAYMENT', 'Pay by Cash'],
  priority = 72,
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  homepage_order = 0,
  source_confidence = 'source_backed',
  updated_at = now()
where slug = 'payment';

-- Voucher
-- Version 80.8: Voucher, pages 254-257.
-- The chapter has multiple rename/correction scenarios. Charges, screenshot-only
-- details, and any unsupported manual-voucher outcomes are omitted.
update public.procedure_cards
set
  title = 'Voucher',
  category = 'Refund',
  service_code = 'VOUCHER',
  service_type = 'Refund / Voucher Process',
  summary = 'Voucher validity, resend, and eligible name servicing guidance.',
  when_to_use = 'Use for a flydubai voucher resend, validity, rename, or name-correction request.',
  channels = jsonb_build_array('Contact Centre', 'Let''s Talk'),
  cut_off_time = $seed$Standard voucher validity: 12 months from issue date.

Manual voucher: use the validity stated in the voucher receipt email.$seed$,
  who_can_action = jsonb_build_array('Contact Centre agent', 'Customer Service for voucher requests requiring follow-up'),
  required_information = jsonb_build_array('PNR or voucher number', 'Customer details for verification', 'Registered email address for a resend request'),
  system_steps = jsonb_build_array(
    'For a resend to the registered email address: obtain the PNR or voucher number, verify customer details, confirm the email address phonetically, and resend the voucher.',
    'For a resend to a different email address: complete security verification, update each passenger contact email, save the changes, then retrieve each voucher in the voucher module and resend it.',
    'For an incorrect or incomplete passenger name caused by a system issue, advise the customer to email Let''s Talk with a passport copy.'
  ),
  passenger_advice = jsonb_build_array(
    'A resent voucher may take up to one hour to be delivered.',
    'Voucher refunds are issued in the currency of the original point of departure.',
    'An unused voucher may be renamed under the payer name in the booking when eligible.'
  ),
  allowed = jsonb_build_array(
    'Contact Centre may resend a voucher to the registered email address after verification.',
    'An unused voucher may be renamed under the payer name in the booking when the documented procedure is followed.'
  ),
  not_allowed = jsonb_build_array(
    'A voucher renamed under the payer name cannot be changed back to the original passenger name.',
    'A partially used voucher cannot be renamed.',
    'Manual voucher name correction or change is not permitted.'
  ),
  escalation_points = jsonb_build_array('For an eligible voucher name-correction request, follow the Let''s Talk and Customer Service procedure.'),
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
-- Version 80.8: Ways to Check-in, pages 279-293.
-- Verified timings: OLCI 48 hours to 75 minutes; passenger airport reporting
-- wording 60 minutes; gate closure 25 minutes; post-OLCI offload 60 minutes.
-- Counter opening/closing times are not stated in the extracted text and are blank.
-- Station lists, screenshots, and the detailed offload table are not reproduced.
update public.procedure_cards
set
  title = 'Check-in / OLCI',
  category = 'Check-in',
  service_code = 'OLCI',
  service_type = 'Check-in Reference',
  summary = 'Online and airport check-in guidance, including OLCI eligibility and post-check-in offload handling.',
  when_to_use = 'Use for online check-in, airport check-in, or a modification/cancellation request after online check-in.',
  channels = jsonb_build_array('flydubai website', 'Mobile application', 'Airport check-in counter', 'Contact Centre'),
  cut_off_time = $seed$Online check-in: 48 hours to 75 minutes before departure.

Post-OLCI offload request: up to 60 minutes before departure.$seed$,
  who_can_action = jsonb_build_array('Passenger through online check-in', 'Airport check-in team', 'Contact Centre agent for post-OLCI modification or cancellation requests', 'Supervisor for offload requests'),
  required_information = jsonb_build_array('Booking reference and departure airport, or the primary passenger last name', 'Flight departure time', 'Current check-in status'),
  system_steps = jsonb_build_array(
    'For online check-in, use the booking reference and departure airport or the primary passenger last name.',
    'For a modification or cancellation request after online check-in, honour the request and escalate the case to a Supervisor to offload the passenger.',
    'For an online-check-in issue, advise the passenger to report to the check-in counter at least three hours before departure for normal airport check-in.'
  ),
  passenger_advice = jsonb_build_array(
    'Passenger will need to be at the airport at least 60 minutes prior to departure time.',
    'Boarding gates close 25 minutes before flight departure.',
    'For an online-check-in issue, report to the check-in counter at least three hours before departure for normal airport check-in.'
  ),
  allowed = jsonb_build_array('A post-OLCI offload request is applicable up to 60 minutes before departure.'),
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
  source_version,
  source_confidence
from public.procedure_cards
where slug in ('visa', 'ok-to-board', 'payment', 'voucher', 'check-in-olci')
order by slug;

-- Generic-filler check, limited to this batch.
select
  slug,
  array_remove(array[
    case when lower(coalesce(summary, '')) ~ 'check source|according to source|source-backed|linked source|where source allows|pending review|escalate unclear|refer to the source chapter' then 'summary' end,
    case when lower(coalesce(when_to_use, '')) ~ 'check source|according to source|source-backed|linked source|where source allows|pending review|escalate unclear|refer to the source chapter' then 'when_to_use' end,
    case when lower(coalesce(jsonb_pretty(required_information), '')) ~ 'check source|according to source|source-backed|linked source|where source allows|pending review|escalate unclear|refer to the source chapter' then 'required_information' end,
    case when lower(coalesce(jsonb_pretty(system_steps), '')) ~ 'check source|according to source|source-backed|linked source|where source allows|pending review|escalate unclear|refer to the source chapter' then 'system_steps' end,
    case when lower(coalesce(jsonb_pretty(passenger_advice), '')) ~ 'check source|according to source|source-backed|linked source|where source allows|pending review|escalate unclear|refer to the source chapter' then 'passenger_advice' end,
    case when lower(coalesce(jsonb_pretty(allowed), '')) ~ 'check source|according to source|source-backed|linked source|where source allows|pending review|escalate unclear|refer to the source chapter' then 'allowed' end,
    case when lower(coalesce(jsonb_pretty(not_allowed), '')) ~ 'check source|according to source|source-backed|linked source|where source allows|pending review|escalate unclear|refer to the source chapter' then 'not_allowed' end,
    case when lower(coalesce(jsonb_pretty(escalation_points), '')) ~ 'check source|according to source|source-backed|linked source|where source allows|pending review|escalate unclear|refer to the source chapter' then 'escalation_points' end,
    case when lower(coalesce(fees_charges, '')) ~ 'check source|according to source|source-backed|linked source|where source allows|pending review|escalate unclear|refer to the source chapter' then 'fees_charges' end
  ], null) as filler_fields
from public.procedure_cards
where slug in ('visa', 'ok-to-board', 'payment', 'voucher', 'check-in-olci')
order by slug;

-- Confirm OLCI timings and restrictions separately for reviewer inspection.
select
  slug,
  cut_off_time,
  passenger_advice,
  not_allowed,
  escalation_points
from public.procedure_cards
where slug = 'check-in-olci';

-- Confirm intentionally narrow card scopes.
select
  slug,
  title,
  summary,
  when_to_use,
  service_code,
  service_type
from public.procedure_cards
where slug in ('visa', 'ok-to-board', 'payment')
order by slug;
