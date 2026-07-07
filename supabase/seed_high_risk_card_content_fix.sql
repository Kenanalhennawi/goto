-- ============================================================
-- Content fix: high-risk operational card drafts
--
-- Safety:
-- - Updates only baggage-upgrade, name-correction, and sporting-equipment.
-- - Does not approve, publish, or feature cards.
-- - Keeps all three cards in needs_review for quality/admin validation.
-- - Uses only source-backed text from linked GO TO manual chapters.
-- ============================================================

with fixed_cards as (
  select *
  from (
    values
      -- baggage-upgrade
      -- Source: Chapter 26 Baggage, pages 103, 107-110.
      -- Confirmed: baggage add/upgrade through flydubai web/contact centre subject to availability,
      -- dynamic pricing by origin/destination, SPRINT baggage SSRs, East Africa baggage deal,
      -- business-upgrade handling for pre-paid baggage, and route-specific baggage deal notes.
      -- Left blank: cut_off_time, because the 6-hour, D-2, Non-DCS/OLCI, and paid-SSR
      -- carry-forward rules were not clearly confirmed in parsed source text.
      (
        'baggage-upgrade',
        'BAGG',
        'Baggage Service',
        jsonb_build_array('Website', 'Contact Centre', 'SPRINT'),
        null::text,
        jsonb_build_array('Contact Centre agent', 'Passenger self-service on eligible web flows'),
        jsonb_build_array('Booking reference', 'Passenger name', 'Flight/date', 'Origin and destination', 'Current baggage allowance', 'Requested baggage amount', 'Existing baggage SSRs if any'),
        jsonb_build_array('Retrieve the booking.', 'Check whether baggage add or upgrade is available for the passenger and route.', 'Add or upgrade baggage through SPRINT when applicable.', 'Upgrade baggage on top of existing baggage SSRs; do not cancel/refund an existing baggage SSR only to provide a lower rate.', 'Collect the baggage upgrade charge shown by the system.', 'If passenger intends normal upgrade to Business Class, cancel the baggage SSR first and refund it to voucher before upgrading the flight.', 'Update booking comments with baggage SSR and charge details.'),
        jsonb_build_array('Advise that baggage prices are dynamic and depend on origin and destination.', 'Advise that baggage add or upgrade is subject to availability.', 'For Business Class upgrade, advise that pre-paid baggage may need to be cancelled and refunded to voucher before the flight upgrade.'),
        jsonb_build_array('Passengers with no baggage allowance, or passengers who wish to upgrade baggage allowance, can add baggage subject to availability through flydubai web or Contact Centre.', 'East Africa baggage upgrade applies to passengers originating from ZNZ, EBB, MBA, or NBO with a maximum of 90 kg packed into three pieces.', 'East Africa baggage upgrade is applicable for Economy only.'),
        jsonb_build_array('Do not cancel/refund an existing baggage SSR only to provide a better baggage rate.', 'East Africa baggage upgrade does not include Business Class.', 'Passengers who upgrade to Business Class through bidding are not eligible for refund of pre-paid baggage purchased before the bid upgrade.'),
        jsonb_build_array('Refer route-specific baggage deal questions and charge confirmation to the current baggage chart/system price before committing to the passenger.'),
        'Baggage prices are dynamic and subject to origin and destination. DAR sector rate shown in source: USD 6 per kg. DXB-KRT baggage deal source note shows AED 10 per kg, with route suspended until further notice.',
        array['BAGG', 'baggage upgrade', 'baggage rates', 'baggage SSR', 'East Africa baggage upgrade'],
        array['baggage', 'baggage upgrade', 'bag upgrade', 'BAGB', 'BUPX', 'BUPY', 'BUPZ'],
        80
      ),

      -- name-correction
      -- Source: Chapter 51 Name Change / Correction, pages 274-278.
      -- Confirmed: 6-hour restriction, no-show validation, free title/space/up-to-3-letter
      -- correction, USD/AED fees, name swap fees, airport/check-in desk RES Support USD100,
      -- GDS/codeshare/interline restriction, checked-in and OLCI blocks, and supervisor review.
      (
        'name-correction',
        'NCFB / NCFE',
        'Booking Process',
        jsonb_build_array('Contact Centre', 'SPRINT', 'Supervisor / floor support', 'RES Support for airport/check-in desk calls'),
        'Name correction within 6 hours to flight departure is not permitted.',
        jsonb_build_array('Contact Centre agent for eligible direct-channel and TA scenarios', 'Supervisor / floor support for charge confirmation and exception cases', 'RES Support when check-in desk calls for airport name correction'),
        jsonb_build_array('Booking reference', 'Passenger current name', 'Requested corrected name', 'Correction type: title, space, up to 3 letters, more than 3 letters, full first/middle/last name, addition/deletion, maiden-to-married, or name swap', 'Passport or supporting document where applicable', 'Booking channel', 'Whether passenger was no-show at any previous stage', 'Whether passenger is already checked in or online checked in', 'Whether booking is GDS, codeshare, or interline'),
        jsonb_build_array('Retrieve the PNR.', 'Validate that the passenger was not a no-show at any previous stage, even if current segments are active.', 'Confirm the request is more than 6 hours before flight departure.', 'Identify the correction type and applicable fee.', 'For phone requests, advise customer to write to Letstalk with relevant documents where the process requires documents.', 'For existing case requests, review the case and attached documents.', 'For title correction or remove/add space, retrieve the PNR, validate no-show status, inform customer of policy, recap the requested correction, update the name/title in SPRINT, and update SPRINT comments.', 'Collect the applicable SSR fee where required.', 'Update SPRINT comments with old name, requested new name, fee/SSR, document support, and action taken.'),
        jsonb_build_array('Advise that name correction is for genuine cases and must not be used to change to a different passenger.', 'Advise that name correction cannot be done within 6 hours of flight departure.', 'Advise that correction is not handled after no-show validation fails.', 'Advise that checked-in or online checked-in passengers are handled at the airport when applicable charges apply.', 'Advise the exact fee before collecting payment.'),
        jsonb_build_array('Title correction, space correction, up to 3-character name correction, and gender/title change are free of charge.', 'More than 3-character name correction is USD 100 / AED 367.', 'Complete correction of first, middle, or last name is USD 100 / AED 367.', 'Addition or deletion of names in first name or last name is USD 100 / AED 367.', 'Name changed from maiden name to married name is USD 100 / AED 367.', 'Name swap without altering spelling is USD 30 / AED 110.', 'Name swap combined with more than 3-character correction is USD 100 / AED 367.'),
        jsonb_build_array('Do not process name correction within 6 hours of flight departure.', 'Do not process name correction when passenger was no-show at any previous stage.', 'Do not do name corrections for GDS, codeshare, or interline bookings.', 'Do not change name on TA block fare bookings.', 'Do not do name correction if passenger is already checked in.', 'Do not offload online checked-in passenger for name correction or title correction; airport handles it with applicable charges if any.', 'Do not use name correction for a different passenger.'),
        jsonb_build_array('Contact Center agents must refer to floor support or supervisor in charge to confirm charges and possibility for name correction/change.', 'If check-in desk calls RES Support for name correction as per passport, RES Support applies USD 100 even for one character, title, or space.', 'Escalate interline system issue scenarios to supervisor.'),
        'Title correction, space correction, one-character correction, and up to 3-character correction: no charge. More than 3-character correction, complete first/middle/last name correction, addition/deletion of names, or maiden-to-married name: USD 100 / AED 367. Name swap without spelling change: USD 30 / AED 110. Airport/check-in desk RES Support name correction as per passport: USD 100 even for one character, title, or space.',
        array['NCFB', 'NCFE', 'name correction', 'name change', 'name swap', 'title correction'],
        array['name correction', 'name change', 'NCFB', 'NCFE', 'name swap', 'title change', 'space correction'],
        95
      ),

      -- sporting-equipment
      -- Source: Chapter 28 Sporting Equipment, pages 125-129.
      -- Confirmed: 24-hour pre-booking, sporting weapons 96-hour pre-booking,
      -- SUP/FS max 10 equipment up to 12 hours prior, Special Handling approval above 10,
      -- SPEQ/SPEX fees, 48-hour pre-authorization for equipment beyond 350 cm,
      -- pole vault/javelin/hang glider and sporting weapon timing, Dubai Police AED300,
      -- 24-hour refund rule, 2-hour airport arrival, and go-show subject to space/payload.
      (
        'sporting-equipment',
        'SPEQ / SPEX',
        'Baggage Service',
        jsonb_build_array('Contact Centre', 'Supervisor / FS', 'Special Handling team', 'Customer Service Group / Security for sporting weapons', 'Airport check-in'),
        $seed$Sporting equipment must be pre-booked at least 24 hours prior to departure.
Sporting weapons must be pre-booked at least 96 hours prior to departure.
SUP/FS only may add SPEQ/SPEX up to 12 hours prior to departure, with a maximum limit of 10 equipment per flight.
Equipment beyond 350 cm requires pre-authorization 48 hours before departure.$seed$,
        jsonb_build_array('Contact Centre agent for standard point-to-point sporting equipment requests', 'Supervisor / FS for requests inside 24 hours up to 12 hours prior and for connecting/interline/codeshare handling', 'Special Handling team for requests beyond maximum limit of 10 equipment', 'Customer Service Group / Security approval flow for sporting weapons'),
        jsonb_build_array('PNR', 'Passenger name', 'Flight/date/sector', 'Equipment type', 'Equipment dimensions: length, width, height', 'Whether item is sporting equipment, restricted equipment, pole vault, javelin, hang glider, or sporting weapon', 'Whether itinerary is point-to-point, connection, interline, or codeshare', 'For firearms/weapons: nationality, passport details/copy, weapon make, caliber, model, serial number, license copy, number of firearms, ammunition quantity/weight, and purpose of carriage'),
        jsonb_build_array('Retrieve the PNR.', 'Verify departure timing against the 24-hour sporting equipment rule or 96-hour sporting weapon rule.', 'Check equipment dimensions.', 'For 160-189 cm, add SPEQ per leg.', 'For 190-350 cm, add SPEX per leg.', 'For equipment beyond 350 cm, obtain pre-authorization 48 hours before departure.', 'For requests inside 24 hours, check with SUP in charge whether SPEQ/SPEX can be added.', 'SUP/FS can add SSR up to 12 hours prior to departure within the maximum limit of 10 equipment per flight.', 'For requests beyond 10 equipment, obtain Special Handling team approval.', 'Collect applicable handling fee per sector.', 'Update SPRINT comments.', 'For sporting weapons, follow approval flow and collect required weapon/firearm details.'),
        jsonb_build_array('Advise that sporting equipment is subject to fees and must be pre-booked.', 'Advise passenger travelling with sporting equipment to arrive at least 2 hours prior to flight departure.', 'Advise that go-show sporting equipment is accepted only subject to space and payload availability.', 'Advise that sporting weapon, firearms, or ammunition can be carried only as checked-in baggage and require approval.'),
        jsonb_build_array('Sporting equipment can be carried subject to applicable fees and pre-booking.', 'SPEQ applies to equipment between 160 cm and 189 cm.', 'SPEX applies to equipment between 190 cm and 350 cm.', 'SPEQ handling fee is AED 150 for one flight.', 'SPEX handling fee is AED 270 for one flight.', 'Handling fee is refundable up to 24 hours prior to departure according to flydubai refund policy.', 'All sports equipment will be accepted as part of the passenger checked baggage allowance.'),
        jsonb_build_array('Within 24 hours, handling fee is non-refundable and non-transferable and can only be used by the passenger for the specific flight and sector for which it is paid.', 'Sporting weapons, firearms, and ammunition can be carried as checked-in baggage only.', 'No dangerous goods can be carried in sports equipment except where the dangerous goods rules allow it.', 'Weapon/firearms approval is valid only for the approved flight, date, and sector; a new approval is required if travel date changes.'),
        jsonb_build_array('Escalate requests inside 24 hours to SUP in charge.', 'Escalate requests beyond 10 equipment per flight to Special Handling team.', 'Escalate connecting, interline, or codeshare SSR handling to Supervisor where required.', 'Escalate sporting weapons/firearms/ammunition approval through Supervisor and Customer Service Group / Security approval flow.'),
        'SPEQ handling fee: AED 150 per flight. SPEX handling fee: AED 270 per flight. For connection examples in source, fees apply per sector. Sporting weapons require AED 300 per passenger per sector for Dubai Police approval, in addition to applicable SPEX/SPEQ handling charges where applicable.',
        array['SPEQ', 'SPEX', 'sporting equipment', 'sporting weapons', 'firearms', 'weapon'],
        array['SPEQ', 'SPEX', 'sports equipment', 'sporting equipment', 'weapon', 'firearms', 'javelin', 'pole vault', 'hang glider'],
        85
      )
  ) as card(
    slug,
    service_code,
    service_type,
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
    keywords,
    aliases,
    priority
  )
)
update public.procedure_cards as procedure
set
  service_code = fixed_cards.service_code,
  service_type = fixed_cards.service_type,
  channels = fixed_cards.channels,
  cut_off_time = fixed_cards.cut_off_time,
  who_can_action = fixed_cards.who_can_action,
  required_information = fixed_cards.required_information,
  system_steps = fixed_cards.system_steps,
  passenger_advice = fixed_cards.passenger_advice,
  allowed = fixed_cards.allowed,
  not_allowed = fixed_cards.not_allowed,
  escalation_points = fixed_cards.escalation_points,
  fees_charges = fixed_cards.fees_charges,
  keywords = fixed_cards.keywords,
  aliases = fixed_cards.aliases,
  priority = fixed_cards.priority,
  source_confidence = 'source_backed',
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  updated_at = now()
from fixed_cards
where procedure.slug = fixed_cards.slug;

select
  slug,
  title,
  review_status,
  is_published,
  service_code,
  service_type,
  cut_off_time,
  fees_charges,
  source_confidence,
  updated_at
from public.procedure_cards
where slug in (
  'baggage-upgrade',
  'name-correction',
  'sporting-equipment'
)
order by slug;
