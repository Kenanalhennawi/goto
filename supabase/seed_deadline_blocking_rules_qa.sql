-- ============================================================
-- Seed QA: deadline, blocking, escalation, and passenger-advice rules
--
-- Safety:
-- - Updates existing procedure_cards by slug only.
-- - Skips cards that are already approved and published.
-- - Does not approve, publish, or feature cards.
-- - Keeps all changed cards in needs_review for quality/admin validation.
-- - Content below is condensed from the linked source chapters / prior
--   source-backed service-card extraction and must be reviewed before publish.
-- ============================================================

with qa_updates as (
  select *
  from (
    values
      -- name-correction:
      -- Adds source-backed action deadline, no-show block, name correction/change distinction,
      -- small-correction/title/space guidance, interline and DSO voucher escalation.
      -- Fees are left blank because the exact charge must be checked in source/system before publish.
      (
        'name-correction',
        'NCFB / NCFE',
        'Booking Process',
        jsonb_build_array('Contact Centre', 'SPRINT', 'Supervisor / shift in charge for exceptions'),
        $seed$Name correction must be handled more than 6 hours before departure when supported by the source scenario.
Do not process name correction after no-show.
Check the exact source scenario before committing exceptions.$seed$,
        jsonb_build_array('Contact Centre agent for standard source-backed correction scenarios', 'Supervisor / shift in charge for unclear cases, exceptions, interline impact, DSO impact, or voucher reissue'),
        jsonb_build_array('Booking reference', 'Passenger current name', 'Requested corrected name', 'Reason for correction', 'Passport/travel document details where required', 'Booking channel', 'Ticket/flight status', 'Whether passenger is no-show', 'Whether booking includes interline or Dubai Stopover benefits'),
        jsonb_build_array('Retrieve the booking.', 'Confirm flight status and verify the request is more than 6 hours before departure where the source scenario requires it.', 'Check that the passenger is not no-show.', 'Identify whether this is a name correction or name change.', 'Match the request to the exact source scenario: title, space, gender/title, small spelling correction, more than 3 letters, name swap, or single-name handling.', 'Check booking channel and interline restrictions before actioning.', 'Collect applicable charge only where source/system confirms it.', 'Update SPRINT comments with old name, requested new name, document support, rule applied, and action taken.'),
        jsonb_build_array('Advise that name correction is possible only when the booking condition and source scenario allow it.', 'Advise that name correction must be completed before the permitted cut-off and cannot be handled after no-show.', 'Advise that travel document support may be required.', 'If the booking has Dubai Stopover benefits, advise that hotel voucher handling may require reissue by the relevant team.'),
        jsonb_build_array('Minor corrections such as title/space/gender or small spelling scenarios may be handled when they match the source rules.', 'Name correction on interline booking is handled only when the source permits it, such as FZ direct channel and fully active booking conditions.', 'Dubai Stopover name correction may require hotel voucher reissue by holidays team through shift-in-charge.'),
        jsonb_build_array('Do not process name correction after no-show.', 'Do not treat a name swap or full name change as a simple spelling correction.', 'Do not commit corrections over the permitted limit, such as more than 3 letters, unless the exact source scenario allows it.', 'Do not handle interline/voucher/DSO impact cases without supervisor or shift-in-charge review.', 'Do not promise fee waiver unless the source/system confirms it.'),
        jsonb_build_array('Escalate unclear name correction/name change distinction to supervisor or shift in charge.', 'Escalate interline restrictions, name swap, more-than-3-letter cases, and exception requests.', 'For Dubai Stopover benefits, shift-in-charge should notify holidays team for hotel voucher reissue where source requires it.'),
        null::text
      ),

      -- baggage-upgrade:
      -- Confirms existing booking 6-hour deadline, modified/new booking supervisor exception,
      -- optional baggage movement/cancellation 24-hour rule, Non-DCS/OLCI and unsupported channel blocks.
      -- Exact fees remain system-based.
      (
        'baggage-upgrade',
        'BAGG',
        'Baggage Service',
        jsonb_build_array('Website', 'Mobile App', 'Contact Centre', 'OLCI', 'TA Portal for eligible bookings'),
        $seed$Existing booking baggage add/upgrade: up to 6 hours prior to departure via eligible channels.
Modified or new booking baggage add/upgrade: Contact Centre approaches shift in charge for action up to D-2 hours where source allows.
Moving or cancellation of optional baggage is allowed only 24 hours prior to departure.$seed$,
        jsonb_build_array('Contact Centre agent for eligible booking/channel combinations', 'Shift in charge / Supervisor for modified or new booking exception handling', 'Passenger self-service where available'),
        jsonb_build_array('Booking reference', 'Passenger name', 'Flight/date', 'Booking channel/document type', 'Itinerary type', 'Baggage amount requested', 'Whether booking is existing, modified, or new', 'Whether passenger is using OLCI or departing from Non-DCS station'),
        jsonb_build_array('Retrieve booking and check booking type, itinerary, channel, document, and station restrictions.', 'For existing eligible bookings, add/upgrade baggage only within the 6-hour cut-off.', 'For modified or new bookings, approach shift in charge up to D-2 hours when the source exception applies.', 'Check whether OLCI/Non-DCS restrictions block baggage upgrade.', 'Collect baggage upgrade charge as per system.', 'Update comments/SPRINT with channel, deadline check, and action taken.'),
        jsonb_build_array('Advise that baggage upgrade is subject to eligibility, channel, document type, availability, and system price.', 'Advise that optional extras may not carry forward after modification within 24 hours and passenger may need to pay again.', 'Advise that moving/cancelling optional baggage is allowed only 24 hours prior to departure where source allows.'),
        jsonb_build_array('Existing eligible bookings can support baggage add/upgrade up to 6 hours prior to departure.', 'Modified/new booking exception may be handled through shift in charge up to D-2 hours where source allows.', 'FZ Prime direct-channel point-to-point and connection bookings can support baggage upgrade through eligible servicing channels.'),
        jsonb_build_array('Do not add/upgrade baggage for source matrix cases marked unsupported.', 'Baggage upgrade is not available via OLCI for passengers travelling from a Non-DCS station.', 'Do not move or cancel optional baggage inside the 24-hour restriction unless source/supervisor guidance permits it.', 'Do not promise carry-forward of paid SSR after modification inside 24 hours.'),
        jsonb_build_array('Approach shift in charge / Supervisor for modified or new booking baggage add/upgrade inside the source exception window.', 'Use the source matrix for unsupported document/channel combinations before committing to passenger.'),
        'All baggage upgrade cost is as per system. Paid SSR may not carry forward or adjust after modification within the last 24 hours before departure; passenger may need to pay again.'
      ),

      -- wheelchair:
      -- Confirms 24-hour general rule, WCHR 12-hour system limit, WCHS/WCHC 24-hour rules,
      -- battery-powered wheelchair 48-hour notification and 3-hour airport reporting.
      -- Fees are left blank because no clear fee rule is needed for the operational card.
      (
        'wheelchair',
        'WCHR / WCHS / WCHC',
        'Special Assistance Service',
        jsonb_build_array('All FZ contact points', 'Contact Centre', 'Airport check-in'),
        $seed$Wheelchair request should be made at least 24 hours prior to departure.
Within the last 24 hours, system restrictions apply: WCHR can be requested up to 12 hours prior to departure; WCHS and WCHC require 24 hours prior to departure.
Battery-powered wheelchair: passenger must notify flydubai 48 hours in advance and report to airport 3 hours prior to departure.$seed$,
        jsonb_build_array('Contact Centre agent', 'SUP/FS for seat assignment escalation', 'Airport team for wheelchair delivery and check-in arrangements', 'Partner airline approval flow for battery-powered wheelchair on partner travel'),
        jsonb_build_array('Booking reference', 'Passenger name', 'SSR code required: WCHR, WCHS, WCHC, WCBD, WCBW, or WCLB', 'Passenger mobility level', 'Whether passenger can use stairs/cabin unassisted', 'Companion/helper details for WCHC where required', 'Medical certificate details where required', 'Battery type, dimensions, weight, watt hours, battery count, and securing instructions for powered mobility aid'),
        jsonb_build_array('Retrieve PNR.', 'Confirm required assistance level and correct SSR code.', 'Check request timing: general 24-hour rule, WCHR 12-hour limit, WCHS/WCHC 24-hour limit, battery wheelchair 48-hour notification.', 'For WCHC, verify companion/helper and medical certificate requirement as per source.', 'Add wheelchair SSR and save.', 'Offer adjoining seats for wheelchair passenger and one companion from rows 29-31 free of cost where source conditions apply.', 'Escalate seat assignment to SUP/FS.', 'Update SPRINT comments with SSR, timing, and any battery details.'),
        jsonb_build_array('Advise passenger to approach a flydubai counter/representative for wheelchair assistance; it will not be waiting at airport entrance by default.', 'Advise battery-powered wheelchair passengers to report to airport 3 hours before departure.', 'Advise that assistance depends on the SSR code and passenger mobility level.', 'Advise that damaged/leaking battery equipment cannot be accepted.'),
        jsonb_build_array('Wheelchair can be requested through all FZ contact points.', 'WCHR/WCHS/WCHC identify the assistance level required.', 'WCBD/WCBW/WCLB identify mobility equipment/battery type.', 'Adjoining seats for the wheelchair passenger and one companion may be assigned free of cost from row 29-31 subject to source conditions and availability.'),
        jsonb_build_array('Battery or mobility aid with signs of damage or leaking cannot be accepted.', 'Electric wheelchair dimensions must not exceed cargo door dimensions 35 in x 48 in / 89 cm x 122 cm and weight must not exceed 100 kg.', 'Hoverboard type equipment is banned and not allowed on FZ aircraft.', 'WCHC passenger must travel with companion/helper in the same cabin on an adjoining seat and carry fit-to-fly medical certificate in English as stated in source.'),
        jsonb_build_array('Escalate seat assignment request to SUP/FS.', 'For battery-powered wheelchair on partner travel, passenger must write to Letstalk with relevant documents to notify the other carrier and approve carriage.'),
        null::text
      ),

      -- flight-disruption:
      -- Confirms pop-up/no-pop-up handling, no free-of-charge promise without validated guidance,
      -- 72-hour interline/codeshare distinction, and SUP/FS escalation.
      -- Fees are not applicable; refund handling remains source zone/FOP/voucher logic.
      (
        'flight-disruption',
        'FDIS',
        'Disruption Reference / Process',
        jsonb_build_array('Contact Centre', 'Manage Booking for eligible direct/TA bookings', 'Travel Shop', 'Supervisor / FS', 'Reservations Support'),
        $seed$For interline/codeshare TA/OAL-system bookings where FZ leg is disrupted: within 72 hours of departure, Contact Centre honors rebooking requests; for refunds, refer caller to ticket issuer.
Outside 72 hours, refer passenger to ticket issuer for rebooking and refund.$seed$,
        jsonb_build_array('Contact Centre agent', 'Supervisor / FS for action and approvals', 'Reservations Support for offered options and assistance', 'Passenger self-service for eligible direct channel/TA bookings'),
        jsonb_build_array('PNR', 'Passenger contact details', 'Affected flight details', 'Disruption type', 'Whether disruption pop-up is available', 'Email/options received from SUP/FS/Outbound/Reservations Support', 'Customer request: rebooking, cancellation, refund, or acceptance', 'Interline/codeshare and ticket issuer details', 'Refund zone and form of payment where applicable'),
        jsonb_build_array('Retrieve PNR.', 'Check whether Flight Disruption pop-up is available.', 'If pop-up is available, modify/cancel using the options available in the pop-up/email guidance.', 'If no pop-up is available, refer to email received from SUP/FS/Outbound team and advise passenger accordingly.', 'Do not offer free-of-charge options without pop-up or validated guidance.', 'For interline/codeshare, check whether request is within 72 hours and whether customer wants rebooking or refund.', 'Create and escalate Salesforce case to supervisor when source requires supervisor action.', 'Update SPRINT comments.'),
        jsonb_build_array('Advise passenger according to available pop-up/email options and validated policy.', 'For eligible self-service accommodation, advise passenger they may manage booking online while flight status is active and not online checked-in.', 'For TA/OAL-system interline/codeshare refund requests, advise passenger to contact ticket issuer as source states.', 'If asked about refund processing time, advise bank timelines vary and passenger should review subsequent credit card statement as source script states.'),
        jsonb_build_array('Eligible passengers may re-accommodate themselves free of charge according to policy, default +/- 10 days from affected flight unless otherwise specified.', 'Direct channel bookings except travel shop bookings may have manage-booking options online.', 'For disruption within 72 hours on TA/OAL system interline/codeshare, Contact Centre honors rebooking requests.'),
        jsonb_build_array('Do not offer anything free of charge if there is no pop-up and options have not been validated.', 'For OAL leg disruption, refer passenger to ticket issuer for rebooking/refund assistance.', 'For TA/OAL-system interline/codeshare refund requests, refer caller to ticket issuer.', 'Outside 72 hours for TA/OAL-system interline/codeshare, refer passenger to ticket issuer for rebooking and refund.', 'For Red/Amber zone handling, do not promise original FOP refund without source exception or supervisor guidance.'),
        jsonb_build_array('Refer Flight not cancelled Changes pop-up to FS/SUP in charge for clear instructions.', 'Escalate free-of-cost modification/cancellation where available option requires SUP/FS action.', 'Always refer to SUP/FS in charge to check OAL availability before committing anything to caller.', 'Consult on-floor supervisor for Red/Amber zone original-FOP refund insistence as source states.'),
        'Refund handling follows zone logic shown in source: Green may refund to original FOP or voucher; Red/Amber default voucher handling applies with listed exceptions and supervisor guidance.'
      ),

      -- lounge-access-during-olci:
      -- Confirms 48-hour OLCI window, 4-hour access, excluded passenger/bookings,
      -- non-refundable/non-transferable rule and FDIS/manual SSR exceptions.
      -- Exact pricing remains dynamic/system-based.
      (
        'lounge-access-during-olci',
        'LNGL / OLCI Lounge',
        'Service',
        jsonb_build_array('Website', 'Online Check-in', 'Dubai Terminal 2 subject to availability', 'Contact Centre for guidance/classification'),
        'Available for purchase within 48 hours prior to departure, provided OLCI is open for the flight via flydubai website. Passenger can purchase 4-hour access.',
        jsonb_build_array('Passenger self-service during OLCI', 'Contact Centre for service guidance and classification', 'Shift in charge for manual SSR guidance scenarios'),
        jsonb_build_array('Booking reference', 'Passenger name', 'Flight/date', 'Booking status', 'Whether lounge was purchased during OLCI', 'Scenario: voluntary modification, cancellation, upgrade, FDIS, no-show, terminal change, payment/service issue'),
        jsonb_build_array('Identify whether lounge access was purchased during OLCI.', 'Check booking status and scenario.', 'For voluntary modification, drop SSR as source scenario table indicates.', 'For voluntary cancellation or upgrade to J class, drop SSR and do not offer refund.', 'For FDIS re-accommodation, move SSR to the new flight.', 'For FDIS cancellation/refund, follow refund to FOP or voucher as applicable.', 'Use Online check-in Lounge classification for lounge sale cases during online check-in.'),
        jsonb_build_array('Advise that lounge purchase during OLCI is subject to dynamic pricing and availability.', 'Advise that successful purchase is reflected on the boarding pass.', 'Advise passenger that access is for 4 hours.', 'If not purchased online, advise the service may still be available at Terminal 2 subject to availability.', 'Advise that all charges are non-refundable and non-transferable unless FDIS scenario in source applies.'),
        jsonb_build_array('Available to passengers travelling or connecting with flydubai from Dubai Terminal 2 during OLCI via flydubai website.', 'Available for Economy passengers.', 'Available for passengers upgraded to J class via OLCI or Plusgrade.', 'Available for ID50 bookings in J and Y class.', 'Can be purchased for one or multiple passengers in the same booking during OLCI.', 'Infants receive complimentary access when accompanied by an eligible adult.'),
        jsonb_build_array('Group bookings are excluded from online lounge purchase.', 'Infant passengers cannot purchase lounge access separately.', 'Passengers already eligible for lounge access, such as Business Class passengers or loyalty tier entitlement, are restricted from purchase.', 'All charges are non-refundable and non-transferable except source-defined FDIS refund scenarios.'),
        jsonb_build_array('Refer to shift in charge for reinstatement of flight, no-show change/cancel, or terminal change where manual SSR handling is required.', 'Use service recovery classification where access could not be provided due to peak hours, payment unsuccessful, or similar source examples.'),
        'Pricing is dynamic and subject to availability. Charges apply per passenger. All forms of payment are applicable. All charges are non-refundable and non-transferable except source-defined FDIS refund scenarios.'
      ),

      -- dubai-stopover:
      -- Confirms DSO/FDSO handling, DSO-tagged segment modification consequences,
      -- FDIS handling, name-correction voucher reissue, hotel complaints and paid extension rules.
      -- Cut-off left blank because no exact action cut-off was clearly isolated in source-backed extraction.
      (
        'dubai-stopover',
        'DSO / FDSO',
        'Service / Stopover',
        jsonb_build_array('Website', 'SPRINT', 'Contact Centre', 'Holidays team for hotel voucher issues'),
        null::text,
        jsonb_build_array('Contact Centre agent', 'Shift in charge for hotel voucher reissue notification', 'Holidays team for hotel complaints/voucher issues'),
        jsonb_build_array('Booking reference', 'Passenger name', 'Return booking details', 'Connection details', 'Segment where DSO SSR is tagged', 'Customer request: modify, rebook, cancel, upgrade/downgrade, name correction, or no-show change', 'Hotel complaint details if applicable'),
        jsonb_build_array('Retrieve PNR and identify whether DSO SSR/FDSO exists.', 'Check which segment DSO is tagged to and what customer wants to modify.', 'If modifying non-DSO segment, DSO is retained.', 'If modifying DSO-tagged OB segment, follow system warning: Yes removes SSR and cancels hotel; No retains SSR and refreshes modification.', 'If cabin change occurs on DSO-tagged sector, ensure SSR is moved/retained and hotel remains as originally booked.', 'For FDIS on affected DSO-tagged segment, rebook/cancel as per policy and do not move DSO to new flight.', 'For name correction on passenger with DSO benefit, shift-in-charge notifies holidays team to reissue hotel voucher.'),
        jsonb_build_array('Advise eligible passengers to check Dubai Stopover information on the flydubai website.', 'For hotel complaints, refer customer to holidays@flydubai.com.', 'Advise that extension or additional nights must be arranged directly with the hotel and paid by the passenger when source scenario applies.', 'Advise that modifying a DSO-tagged segment may remove SSR and cancel hotel depending on system warning response.'),
        jsonb_build_array('Dubai Stopover allows eligible flydubai passengers on return bookings with a connection to enjoy one complimentary 24-hour hotel stay in Dubai during transit.', 'DSO SSR appears under services tab and Services window, and Dubai Stopover label displays on PNR header.', 'PNRs with DSO SSR are highlighted in green under Find Reservation results.', 'DSO is retained when modification is completed on a non-DSO segment.'),
        jsonb_build_array('For FDIS rebook/cancel on affected segment tagged to DSO, DSO is dropped and should not be moved to the new flight.', 'If user confirms modification warning on the DSO-tagged OB flight, SSR is removed and hotel is cancelled.', 'Any extension or additional nights must be arranged directly with the hotel and paid by passenger.', 'Do not treat DSO hotel voucher impact as normal name correction without shift-in-charge notification.'),
        jsonb_build_array('Shift-in-charge should notify holidays team to reissue hotel voucher after name correction for passenger holding RT ticket with DSO benefits.', 'Hotel complaints go to holidays@flydubai.com.', 'Use FDIS policy handling for disrupted DSO-tagged segment and do not move DSO to new flight.'),
        null::text
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
    fees_charges
  )
)
update public.procedure_cards as procedure
set
  service_code = qa_updates.service_code,
  service_type = qa_updates.service_type,
  channels = qa_updates.channels,
  cut_off_time = qa_updates.cut_off_time,
  who_can_action = qa_updates.who_can_action,
  required_information = qa_updates.required_information,
  system_steps = qa_updates.system_steps,
  passenger_advice = qa_updates.passenger_advice,
  allowed = qa_updates.allowed,
  not_allowed = qa_updates.not_allowed,
  escalation_points = qa_updates.escalation_points,
  fees_charges = qa_updates.fees_charges,
  source_confidence = 'source_backed',
  review_status = 'needs_review',
  is_published = false,
  updated_at = now()
from qa_updates
where procedure.slug = qa_updates.slug
  and not (procedure.review_status = 'approved' and procedure.is_published = true);
