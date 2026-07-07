-- ============================================================
-- Seed v2: additional operational card drafts using real chapter slugs
--
-- Safety:
-- - Links each card by exact public.chapters.slug.
-- - Inserts only when the source chapter exists and the card slug is missing.
-- - Updates only cards that are not already approved + published.
-- - Does not approve, publish, or feature cards.
-- - Leaves cut-off/fees blank where exact source detail is unclear.
-- ============================================================

with seed (
  target_slug,
  title,
  source_chapter_slug,
  service_code,
  service_type,
  category,
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
) as (
  values
    -- visa | source: visa | cut-off/fees left blank pending source review.
    (
      'visa',
      'Visa',
      'visa',
      'VISA',
      'Travel Document / Visa Reference',
      'Travel Documents',
      jsonb_build_array('Contact Centre', 'Travel Shop', 'Airport'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Travel Shop or Airport team where document verification is required'),
      jsonb_build_array('Booking reference if available', 'Passenger nationality', 'Destination and transit points', 'Travel document and visa details'),
      jsonb_build_array('Check the passenger route, nationality, and travel document scenario against the Visa source chapter.', 'Advise the passenger according to the source-supported document guidance.', 'Escalate unclear document acceptance cases before confirming travel guidance.'),
      jsonb_build_array('Advise passenger that they are responsible for valid travel documents, visas, and entry permissions.', 'Advise passenger to verify official destination requirements before travel.'),
      jsonb_build_array('Visa guidance can be provided from the linked source chapter.'),
      jsonb_build_array('Do not guarantee boarding or immigration entry without valid documents and source-supported verification.'),
      jsonb_build_array('Escalate unclear visa or travel document cases to supervisor or the source-designated team.'),
      null::text,
      array['visa', 'travel document', 'entry requirement'],
      array['VISA', 'travel document', 'visa change'],
      70
    ),

    -- ok-to-board | source: ok-to-board-oktb | cut-off/fees left blank pending source review.
    (
      'ok-to-board',
      'OK To Board',
      'ok-to-board-oktb',
      'OKTB',
      'Travel Document Service',
      'Travel Documents',
      jsonb_build_array('Contact Centre', 'Travel Shop', 'Airport'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Travel Shop or Airport team where document verification is required'),
      jsonb_build_array('Booking reference', 'Passenger name', 'Destination', 'Visa or entry document details'),
      jsonb_build_array('Retrieve booking if available.', 'Check whether the route/document scenario requires OK to Board handling.', 'Follow the linked OKTB source chapter for document/channel requirements.', 'Record action or advice where required.'),
      jsonb_build_array('Advise passenger that OK to Board depends on required document verification and travel document validity.', 'Advise passenger to carry original travel documents and approvals.'),
      jsonb_build_array('OKTB can be handled where the source chapter requires and supports it.'),
      jsonb_build_array('Do not confirm OKTB without required source-supported document verification.', 'Do not guarantee immigration acceptance.'),
      jsonb_build_array('Escalate unclear OKTB cases to supervisor or the source-designated channel.'),
      null::text,
      array['OKTB', 'ok to board', 'visa ok', 'travel document'],
      array['OKTB', 'OK to Board', 'VIOK'],
      68
    ),

    -- meal | source: meal | exact cut-off/fees left blank pending source review.
    (
      'meal',
      'Meal',
      'meal',
      'MEAL',
      'Ancillary Service',
      'Ancillary',
      jsonb_build_array('Contact Centre', 'Website', 'Mobile App'),
      null::text,
      jsonb_build_array('Contact Centre agent', 'Passenger self-service where available'),
      jsonb_build_array('Booking reference', 'Passenger name', 'Flight/date', 'Meal type or SSR code'),
      jsonb_build_array('Retrieve booking.', 'Identify requested meal type or SSR code.', 'Check source chapter for availability and request conditions.', 'Add or guide to eligible channel where source allows.'),
      jsonb_build_array('Advise that meal availability depends on route, timing, and source rules.'),
      jsonb_build_array('Meal requests may be supported where source and flight conditions allow.'),
      jsonb_build_array('Do not guarantee meal availability without checking source/system availability.'),
      jsonb_build_array('Escalate unclear meal SSR or exception requests to supervisor.'),
      null::text,
      array['meal', 'SPML', 'AVML', 'CHML', 'VGML', 'BBML', 'KSML'],
      array['meal', 'special meal', 'SPML', 'AVML', 'CHML', 'VGML'],
      55
    ),

    -- pregnancy | source: pregnancy | exact medical thresholds/cut-off left blank pending source review.
    (
      'pregnancy',
      'Pregnancy',
      'pregnancy',
      'PREG',
      'Travel Eligibility Reference',
      'Medical',
      jsonb_build_array('Contact Centre', 'Airport', 'Medical review channel where source requires'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Airport or medical review where documentation is required'),
      jsonb_build_array('Passenger pregnancy stage/week', 'Travel date and route', 'Medical certificate details where source requires'),
      jsonb_build_array('Identify pregnancy stage and travel date.', 'Check the Pregnancy source chapter for eligibility and documentation requirements.', 'Escalate unclear cases before confirming travel acceptance.'),
      jsonb_build_array('Advise that acceptance depends on pregnancy stage, route, documentation, and source rules.', 'Advise passenger to carry required medical documents where applicable.'),
      jsonb_build_array('Travel may be permitted where source eligibility and documentation rules are satisfied.'),
      jsonb_build_array('Do not confirm travel acceptance if source documentation or eligibility is not met.', 'Do not provide medical advice beyond source travel eligibility guidance.'),
      jsonb_build_array('Escalate unclear pregnancy eligibility or document cases to supervisor or medical review channel.'),
      null::text,
      array['pregnancy', 'pregnant passenger', 'medical certificate'],
      array['pregnancy', 'pregnant', 'medical certificate'],
      60
    ),

    -- meda | source: medical-death-cases | exact MEDA timing/fees left blank pending source review.
    (
      'meda',
      'Medical Case / MEDA',
      'medical-death-cases',
      'MEDA',
      'Medical Assistance Service',
      'Medical',
      jsonb_build_array('Contact Centre', 'Medical review channel', 'Airport where source requires'),
      null::text,
      jsonb_build_array('Contact Centre agent for intake', 'Medical review team where approval is required', 'Airport team for day-of-travel handling'),
      jsonb_build_array('Booking reference', 'Passenger name', 'Medical condition summary', 'Required assistance', 'Medical documents/forms where source requires'),
      jsonb_build_array('Identify the medical case type.', 'Check the Medical & Death cases source chapter for required documentation and approval flow.', 'Escalate to medical/supervisor channel where source requires.'),
      jsonb_build_array('Advise passenger that travel or assistance approval depends on medical documentation and source process.'),
      jsonb_build_array('MEDA/medical case handling may proceed where required documents and approvals meet source rules.'),
      jsonb_build_array('Do not confirm medical acceptance without required source approval.', 'Do not provide medical advice beyond documented travel process.'),
      jsonb_build_array('Escalate MEDA or medical cases to the source-designated medical/supervisor channel.'),
      null::text,
      array['MEDA', 'medical assistance', 'medical case'],
      array['MEDA', 'medical', 'fit to fly'],
      66
    ),

    -- plaster-cast-leg-brace | source: passengers-with-medical-conditions-onboard---travelling-with | exact timing/fees left blank.
    (
      'plaster-cast-leg-brace',
      'Plaster Cast / Leg Brace Travel',
      'passengers-with-medical-conditions-onboard---travelling-with',
      null::text,
      'Medical Travel Eligibility Reference',
      'Medical',
      jsonb_build_array('Contact Centre', 'Medical review channel', 'Airport where source requires'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Medical review or airport team where source requires'),
      jsonb_build_array('Passenger condition', 'Cast or brace details', 'Travel date/route', 'Medical document details where source requires'),
      jsonb_build_array('Identify the plaster cast or leg brace scenario.', 'Check the linked source chapter for travel eligibility and documentation requirements.', 'Escalate unclear medical travel cases before confirming acceptance.'),
      jsonb_build_array('Advise passenger that acceptance depends on medical condition, documentation, and source rules.'),
      jsonb_build_array('Travel may be supported where source medical travel conditions are satisfied.'),
      jsonb_build_array('Do not confirm acceptance if source documentation or eligibility is unclear.'),
      jsonb_build_array('Escalate unclear medical travel eligibility cases to supervisor or medical review channel.'),
      null::text,
      array['plaster cast', 'leg brace', 'medical condition', 'travel eligibility'],
      array['plaster cast', 'leg brace', 'medical'],
      64
    ),

    -- dpna | source: disabled-passenger-with-intellectual-or-developmental-disabi | exact cut-off/fees left blank.
    (
      'dpna',
      'DPNA / Developmental Disability Assistance',
      'disabled-passenger-with-intellectual-or-developmental-disabi',
      'DPNA',
      'Special Assistance Service',
      'Special Assistance',
      jsonb_build_array('Contact Centre', 'Airport', 'Special assistance channel where source requires'),
      null::text,
      jsonb_build_array('Contact Centre agent', 'Airport or special assistance team where source requires'),
      jsonb_build_array('Booking reference', 'Passenger name', 'Assistance requirement', 'Companion/helper details where applicable'),
      jsonb_build_array('Retrieve booking.', 'Confirm assistance requirement and whether DPNA applies.', 'Check source chapter for eligibility, documents, and handling channel.', 'Request/add SSR where source allows.'),
      jsonb_build_array('Advise passenger that assistance is subject to source eligibility and airport handling.'),
      jsonb_build_array('DPNA assistance can be supported where source criteria are met.'),
      jsonb_build_array('Do not confirm unsupported assistance or medical acceptance without source approval.'),
      jsonb_build_array('Escalate unclear DPNA cases to supervisor or source-designated channel.'),
      null::text,
      array['DPNA', 'developmental disability', 'special assistance'],
      array['DPNA', 'disabled passenger', 'special assistance'],
      64
    ),

    -- payment | source: payment | exact fees left blank.
    (
      'payment',
      'Payment',
      'payment',
      'CCHK',
      'Payment Process',
      'Payment',
      jsonb_build_array('Contact Centre', 'Website', 'Mobile App', 'Payment system channel'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Supervisor or payment support where source requires'),
      jsonb_build_array('Booking reference', 'Payment status/error', 'Amount', 'Transaction/reference details where available'),
      jsonb_build_array('Identify payment scenario and booking status.', 'Check source chapter for payment failure, verification, or payment-link handling.', 'Guide customer through eligible payment channel or escalate where source requires.'),
      jsonb_build_array('Advise customer according to source-supported payment status and next action.', 'Advise customer not to share sensitive payment details outside approved secure channels.'),
      jsonb_build_array('Payment support can be provided through approved source/system channels.'),
      jsonb_build_array('Do not request or store full card details in notes.', 'Do not confirm ticketing or service until payment status is confirmed.'),
      jsonb_build_array('Escalate unresolved payment errors or card verification issues to supervisor/payment support as source requires.'),
      null::text,
      array['payment', 'CCHK', 'card verification', 'payment failure'],
      array['payment', 'CCHK', 'card check'],
      72
    ),

    -- voucher | source: voucher | exact eligibility/fees left blank.
    (
      'voucher',
      'Voucher',
      'voucher',
      'VCHR',
      'Voucher / Refund Process',
      'Refund',
      jsonb_build_array('Contact Centre', 'Manage Booking where eligible', 'Supervisor or refund support'),
      null::text,
      jsonb_build_array('Contact Centre agent', 'Supervisor or refund support for exceptions'),
      jsonb_build_array('Booking reference', 'Passenger name', 'Voucher/refund reason', 'Original form of payment where applicable'),
      jsonb_build_array('Identify voucher/refund scenario.', 'Check source voucher chapter for eligibility and handling.', 'Apply source-supported guidance or escalate where required.'),
      jsonb_build_array('Advise passenger according to voucher eligibility and source process.'),
      jsonb_build_array('Voucher handling may be available where source policy allows.'),
      jsonb_build_array('Do not promise refund/voucher outcome without source eligibility.'),
      jsonb_build_array('Escalate voucher/refund exceptions to supervisor or refund support.'),
      null::text,
      array['voucher', 'refund', 'VCHR'],
      array['voucher', 'VCHR', 'refund'],
      74
    ),

    -- check-in-olci | source: ways-to-check-in | exact check-in windows left blank.
    (
      'check-in-olci',
      'Check-in / OLCI',
      'ways-to-check-in',
      'OLCI',
      'Check-in Reference',
      'Check-in',
      jsonb_build_array('Website', 'Mobile App', 'Airport check-in', 'Contact Centre for guidance'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Airport check-in team for airport handling'),
      jsonb_build_array('Booking reference', 'Passenger name', 'Flight/date', 'Check-in status', 'Error message if OLCI failed'),
      jsonb_build_array('Identify check-in scenario and channel.', 'Check source chapter for online check-in rules and exceptions.', 'Advise eligible channel or airport handling.', 'Escalate technical/restricted cases where source requires.'),
      jsonb_build_array('Advise passenger to use eligible check-in channel according to source rules.'),
      jsonb_build_array('Online or airport check-in may be available depending on source rules and booking/passenger conditions.'),
      jsonb_build_array('Do not guarantee online check-in when route, document, SSR, booking status, or source restriction blocks it.'),
      jsonb_build_array('Escalate unresolved OLCI or restricted check-in cases to supervisor/support channel.'),
      null::text,
      array['OLCI', 'online check-in', 'check-in'],
      array['OLCI', 'DCS', 'online check-in'],
      78
    ),

    -- sprint-check-in-dcs | source: sprint-check-in-dcs | exact handling left blank.
    (
      'sprint-check-in-dcs',
      'SPRINT Check-in DCS',
      'sprint-check-in-dcs',
      'DCS',
      'Check-in Reference',
      'Check-in',
      jsonb_build_array('SPRINT', 'DCS', 'Contact Centre', 'Airport check-in'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Airport/DCS team for operational handling'),
      jsonb_build_array('PNR', 'Check-in status', 'DCS message/error', 'Flight/date'),
      jsonb_build_array('Identify SPRINT/DCS check-in scenario.', 'Check source chapter for supported action.', 'Escalate unresolved DCS issues where source requires.'),
      jsonb_build_array('Advise passenger according to source-supported check-in/DCS outcome.'),
      jsonb_build_array('DCS handling may apply where source process supports it.'),
      jsonb_build_array('Do not override DCS restrictions without source-supported handling.'),
      jsonb_build_array('Escalate unclear DCS/check-in cases to supervisor or airport support.'),
      null::text,
      array['SPRINT', 'DCS', 'check-in'],
      array['SPRINT', 'DCS', 'check-in'],
      67
    ),

    -- interline-connection | source: interline | exact fees left blank.
    (
      'interline-connection',
      'Interline',
      'interline',
      'OAL / APIS',
      'Interline Reference',
      'Interline',
      jsonb_build_array('Contact Centre', 'Airport transfer desk', 'Partner airline / ticket issuer where source requires'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Supervisor for unclear interline/codeshare cases'),
      jsonb_build_array('Booking reference', 'Ticket issuer', 'Operating carriers', 'Connection details', 'Baggage tag/status', 'Passenger documents'),
      jsonb_build_array('Identify interline scenario and ticket issuer.', 'Check linked Interline source chapter for handling responsibility.', 'Escalate unclear partner-airline cases before committing.'),
      jsonb_build_array('Advise passenger where ticket issuer or partner airline must handle the request.'),
      jsonb_build_array('Interline handling may apply where source rules and carrier/ticketing conditions support it.'),
      jsonb_build_array('Do not commit partner airline rebooking/refund/baggage handling unless source policy supports it.'),
      jsonb_build_array('Escalate unclear interline cases to supervisor or source-designated support team.'),
      null::text,
      array['interline', 'connection', 'transfer', 'OAL', 'APIS'],
      array['interline', 'connection', 'transfer', 'OAL', 'APIS'],
      85
    ),

    -- codeshare | source: codeshare | exact fees/deadlines left blank.
    (
      'codeshare',
      'Codeshare',
      'codeshare',
      null::text,
      'Codeshare Reference',
      'Interline',
      jsonb_build_array('Contact Centre', 'Partner airline / ticket issuer where source requires'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Supervisor for unclear codeshare cases'),
      jsonb_build_array('Booking reference', 'Marketing/operating carrier', 'Ticket issuer', 'Customer request'),
      jsonb_build_array('Identify codeshare scenario.', 'Check source chapter for handling responsibility and restrictions.', 'Escalate unclear ownership cases before committing.'),
      jsonb_build_array('Advise passenger according to source-supported codeshare handling.'),
      jsonb_build_array('Codeshare handling applies where source rules support it.'),
      jsonb_build_array('Do not override partner/ticket issuer responsibility.'),
      jsonb_build_array('Escalate unclear codeshare cases to supervisor.'),
      null::text,
      array['codeshare', 'interline', 'partner airline'],
      array['codeshare', 'partner airline'],
      76
    ),

    -- government-deals | source: government-deals | exact eligibility/fees left blank.
    (
      'government-deals',
      'Government Deals',
      'government-deals',
      'GOV',
      'Booking Process',
      'Booking',
      jsonb_build_array('Contact Centre', 'Website / booking flow where eligible', 'Government deal channel where source requires'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Supervisor for eligibility exceptions'),
      jsonb_build_array('Deal/program name', 'Passenger eligibility detail', 'Promo/deal code where applicable', 'Travel dates and route'),
      jsonb_build_array('Identify government deal/program requested.', 'Check source chapter for eligibility and booking process.', 'Guide passenger to eligible booking/channel or escalate.'),
      jsonb_build_array('Advise that eligibility depends on source rules and required proof/code.'),
      jsonb_build_array('Government deals may be used where source eligibility and booking conditions are met.'),
      jsonb_build_array('Do not apply or promise government deal eligibility without source criteria.'),
      jsonb_build_array('Escalate unclear government deal eligibility or booking exceptions to supervisor.'),
      null::text,
      array['government deals', 'ESAAD', 'ALSAADA', 'GDRFA'],
      array['government deals', 'ESAAD', 'ALSAADA', 'GDRFA'],
      75
    ),

    -- gds | source: gds-booking | exact GDS commands left blank.
    (
      'gds',
      'GDS Booking',
      'gds-booking',
      'GDS',
      'GDS Reference',
      'GDS',
      jsonb_build_array('GDS', 'Contact Centre', 'GDS support'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'GDS support for system/booking assistance'),
      jsonb_build_array('GDS booking reference', 'PNR', 'Ticket/document number', 'Request type', 'Error/message where applicable'),
      jsonb_build_array('Identify the GDS scenario.', 'Check source chapter for supported action and restrictions.', 'Escalate to GDS support when required.'),
      jsonb_build_array('Advise according to source-supported GDS handling and responsibility.'),
      jsonb_build_array('GDS handling is supported where source process and ownership allow it.'),
      jsonb_build_array('Do not perform unsupported GDS changes directly.', 'Do not override GDS/ticketing ownership rules.'),
      jsonb_build_array('Escalate unsupported or unclear GDS cases to GDS support or supervisor.'),
      null::text,
      array['GDS', 'booking', 'ticketing', 'document'],
      array['GDS', 'PNR', 'ticketing'],
      62
    ),

    -- fare-types | source: fare-types | exact fare conditions left blank.
    (
      'fare-types',
      'Fare Types',
      'fare-types',
      'FARE',
      'Fare Reference',
      'Fares',
      jsonb_build_array('Contact Centre', 'Website', 'Travel Shop'),
      null::text,
      jsonb_build_array('Contact Centre agent for fare guidance', 'Supervisor for unclear fare-rule exceptions'),
      jsonb_build_array('Fare brand/type', 'Route/date', 'Customer request: change, refund, baggage, seat, or service'),
      jsonb_build_array('Identify fare type/brand.', 'Check source fare type chapter for included services and restrictions.', 'Advise passenger according to fare conditions.'),
      jsonb_build_array('Advise passenger that fare conditions determine included services, changes, refund, and optional extras.'),
      jsonb_build_array('Fare rules apply according to source fare type/brand.'),
      jsonb_build_array('Do not promise change/refund/service benefits without checking fare type source rule.'),
      jsonb_build_array('Escalate unclear fare-rule exception requests to supervisor.'),
      null::text,
      array['fare types', 'fare brand', 'fare rules'],
      array['fare types', 'fare brand', 'fare rules'],
      58
    ),

    -- staff-tickets | source: staff-tickets | exact eligibility/fees left blank.
    (
      'staff-tickets',
      'Staff Tickets',
      'staff-tickets',
      'ID50 / ID90',
      'Staff Travel Reference',
      'Staff Travel',
      jsonb_build_array('Contact Centre', 'Staff travel channel where source requires', 'Airport where source requires'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Staff travel / supervisor channel for eligibility exceptions'),
      jsonb_build_array('Staff ticket type', 'Passenger/staff eligibility detail', 'Travel date/route', 'Request type'),
      jsonb_build_array('Identify staff ticket type and request.', 'Check source chapter for eligibility and restrictions.', 'Guide to source-supported channel or escalate.'),
      jsonb_build_array('Advise that staff ticket handling depends on staff travel rules and eligibility.'),
      jsonb_build_array('Staff ticket handling may be supported where source eligibility and process allow.'),
      jsonb_build_array('Do not treat staff tickets as standard commercial bookings without checking source rules.'),
      jsonb_build_array('Escalate unclear staff travel eligibility or exception cases.'),
      null::text,
      array['staff tickets', 'ID50', 'ID90', 'staff travel'],
      array['staff tickets', 'ID50', 'ID90', 'staff travel'],
      57
    ),

    -- insurance | source: travel-insurance | exact fee/cut-off left blank.
    (
      'insurance',
      'Travel Insurance',
      'travel-insurance',
      'INS',
      'Ancillary Service',
      'Ancillary',
      jsonb_build_array('Website', 'Contact Centre for eligible guidance', 'Eligible servicing channels'),
      null::text,
      jsonb_build_array('Contact Centre agent for eligible guidance', 'Supervisor for unclear optional-extra cases'),
      jsonb_build_array('Booking reference', 'Passenger name', 'Insurance request/status', 'Route/date'),
      jsonb_build_array('Retrieve booking.', 'Check travel insurance source rules and eligibility.', 'Advise passenger on eligible channel and restrictions.'),
      jsonb_build_array('Advise that travel insurance availability depends on booking/channel/source rules.'),
      jsonb_build_array('Travel insurance may be available through eligible channels where source allows.'),
      jsonb_build_array('Do not add or promise insurance where source/channel does not support it.'),
      jsonb_build_array('Escalate unclear travel insurance cases to supervisor.'),
      null::text,
      array['travel insurance', 'insurance', 'optional extras'],
      array['insurance', 'travel insurance'],
      56
    ),

    -- seat-assignment | source: seat | exact seat-fee/cut-off left blank.
    (
      'seat-assignment',
      'Seat Assignment',
      'seat',
      'SEAT',
      'Seat Service',
      'Seats',
      jsonb_build_array('Contact Centre', 'Website', 'Mobile App', 'Airport where source allows'),
      null::text,
      jsonb_build_array('Contact Centre agent', 'Airport team for airport-handled seating', 'Supervisor for exception/SSR-related seating'),
      jsonb_build_array('Booking reference', 'Passenger name', 'Seat request', 'SSR/special assistance status', 'Fare/booking status'),
      jsonb_build_array('Retrieve booking.', 'Check requested seat and passenger eligibility/restrictions.', 'Check source seat rules, chargeability, and SSR-related seating conditions.', 'Assign or guide passenger to eligible channel where source allows.'),
      jsonb_build_array('Advise passenger that seat assignment is subject to availability, fare/service rules, and restrictions.'),
      jsonb_build_array('Seat assignment may be available where source rules and availability allow.'),
      jsonb_build_array('Do not assign restricted seats to ineligible passengers.', 'Do not promise specific seats without confirming availability and source restrictions.'),
      jsonb_build_array('Escalate SSR-related seating, restricted seat, or exception cases to supervisor/airport team where source requires.'),
      null::text,
      array['seat', 'seat assignment', 'SEAT', 'extra legroom'],
      array['SEAT', 'seat assignment', 'seat'],
      65
    ),

    -- no-show-access | source: no-show-access-modification-cancellation | exact fees left blank.
    (
      'no-show-access',
      'No Show Access',
      'no-show-access-modification-cancellation',
      'NOSHOW',
      'Booking Modification Reference',
      'Booking',
      jsonb_build_array('Contact Centre', 'Supervisor / floor in charge where source requires'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Supervisor / floor in charge for exception handling'),
      jsonb_build_array('Booking reference', 'Passenger name', 'Flight/date', 'No-show status', 'Requested modification or cancellation'),
      jsonb_build_array('Retrieve booking and confirm no-show/access status.', 'Check source chapter for allowed modification/cancellation handling.', 'Escalate exceptions before committing to customer.'),
      jsonb_build_array('Advise passenger according to source no-show modification/cancellation rules.'),
      jsonb_build_array('No-show modification/cancellation handling may be supported where source rules allow.'),
      jsonb_build_array('Do not process restricted no-show changes without source/supervisor guidance.'),
      jsonb_build_array('Escalate unclear no-show modification/cancellation cases to supervisor or floor in charge.'),
      null::text,
      array['no show', 'modification', 'cancellation'],
      array['no-show', 'no show access'],
      69
    ),

    -- pre-purchased-ssrs | source: pre-purchased-ssrs | exact deadline/fees left blank.
    (
      'pre-purchased-ssrs',
      'Pre-purchased SSRs',
      'pre-purchased-ssrs',
      'SSR',
      'SSR Reference',
      'SSR',
      jsonb_build_array('Contact Centre', 'Website / eligible servicing channels', 'Airport where source requires'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Supervisor for SSR exceptions'),
      jsonb_build_array('Booking reference', 'SSR/service type', 'Payment/status', 'Flight/date', 'Modification/cancellation scenario'),
      jsonb_build_array('Identify pre-purchased SSR/service.', 'Check source chapter for modification, cancellation, or carry-forward rules.', 'Advise passenger or escalate according to source.'),
      jsonb_build_array('Advise that pre-purchased SSR handling depends on source rules, booking changes, and service status.'),
      jsonb_build_array('Pre-purchased SSRs may be handled where source conditions allow.'),
      jsonb_build_array('Do not promise SSR carry-forward/refund without source confirmation.'),
      jsonb_build_array('Escalate unclear pre-purchased SSR cases to supervisor.'),
      null::text,
      array['pre-purchased SSR', 'SSR', 'optional service'],
      array['SSR', 'pre-purchased SSR'],
      63
    ),

    -- special-requests | source: ssr---special-requests | exact deadline/fees left blank.
    (
      'special-requests',
      'SSR Special Requests',
      'ssr---special-requests',
      'SSR',
      'SSR Process',
      'SSR',
      jsonb_build_array('Contact Centre', 'Airport where source requires', 'Supervisor for exception SSRs'),
      null::text,
      jsonb_build_array('Contact Centre agent', 'Supervisor for unclear or exception SSRs'),
      jsonb_build_array('Booking reference', 'Passenger name', 'Requested SSR/service', 'Flight/date', 'Eligibility/document details where source requires'),
      jsonb_build_array('Identify requested SSR.', 'Check linked SSR Special Requests source chapter for eligibility and handling.', 'Add/request SSR where source allows or escalate if unclear.'),
      jsonb_build_array('Advise passenger that SSR acceptance depends on source rules, eligibility, and availability.'),
      jsonb_build_array('Special requests may be supported where source criteria are met.'),
      jsonb_build_array('Do not confirm unsupported SSRs or exceptions without source/supervisor guidance.'),
      jsonb_build_array('Escalate unclear SSR special request cases to supervisor.'),
      null::text,
      array['SSR', 'special request', 'service request'],
      array['SSR', 'special requests'],
      61
    )
),
resolved as (
  select
    seed.*,
    chapters.id as chapter_id,
    chapters.page_start,
    chapters.page_end,
    chapters.source_version,
    chapters.updated_at as source_updated_at
  from seed
  join public.chapters on chapters.slug = seed.source_chapter_slug
),
prepared as (
  select
    *,
    case
      when page_start is not null and page_end is not null and page_end >= page_start
        then array(select generate_series(page_start, page_end))
      when page_start is not null
        then array[page_start]
      when page_end is not null
        then array[page_end]
      else '{}'
    end as source_pages
  from resolved
)
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
  source_pages,
  source_version,
  source_updated_at,
  keywords,
  aliases,
  priority,
  review_status,
  is_published,
  show_on_homepage,
  source_confidence
)
select
  chapter_id,
  title,
  target_slug,
  category,
  service_code,
  service_type,
  'Draft operational card linked to the real source chapter slug: ' || source_chapter_slug || '.',
  'Use this card after quality review to guide agents from the linked source chapter.',
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
  source_pages,
  source_version,
  source_updated_at::date,
  keywords,
  aliases,
  priority,
  'needs_review',
  false,
  false,
  'source_backed'
from prepared
on conflict (slug) do update set
  chapter_id = excluded.chapter_id,
  title = excluded.title,
  category = excluded.category,
  service_code = excluded.service_code,
  service_type = excluded.service_type,
  summary = excluded.summary,
  when_to_use = excluded.when_to_use,
  channels = excluded.channels,
  cut_off_time = excluded.cut_off_time,
  who_can_action = excluded.who_can_action,
  required_information = excluded.required_information,
  system_steps = excluded.system_steps,
  passenger_advice = excluded.passenger_advice,
  allowed = excluded.allowed,
  not_allowed = excluded.not_allowed,
  escalation_points = excluded.escalation_points,
  fees_charges = excluded.fees_charges,
  source_pages = excluded.source_pages,
  source_version = excluded.source_version,
  source_updated_at = excluded.source_updated_at,
  keywords = excluded.keywords,
  aliases = excluded.aliases,
  priority = excluded.priority,
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  source_confidence = 'source_backed',
  updated_at = now()
where not (procedure_cards.review_status = 'approved' and procedure_cards.is_published = true);
