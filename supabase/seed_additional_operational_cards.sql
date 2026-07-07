-- ============================================================
-- Seed: additional source-linked operational card drafts
--
-- Safety:
-- - Creates/updates procedure_cards by slug only.
-- - Inserts a card only when a matching source chapter exists.
-- - Skips cards that are already approved and published.
-- - Does not approve, publish, or feature cards.
-- - Keeps all changed cards in needs_review for quality/admin review.
-- - Leaves deadline/fee fields blank where exact source detail is unclear.
-- ============================================================

with seed (
  title,
  slug,
  category,
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
  priority,
  title_patterns,
  body_patterns
) as (
  values
    -- visa: Travel Document / Visa Reference.
    -- Cut-off and fees left blank because exact operational deadline/charge must be verified in source.
    (
      'Visa',
      'visa',
      'Travel Documents',
      'VISA',
      'Travel Document / Visa Reference',
      jsonb_build_array('Contact Centre', 'Travel Shop', 'Airport', 'UAE Travel Shops'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Travel Shop / Airport team where document verification is required'),
      jsonb_build_array('Booking reference', 'Passenger nationality', 'Destination/transit country', 'Travel document details', 'Visa or entry document details', 'Passenger travel itinerary'),
      jsonb_build_array('Retrieve booking if available.', 'Check destination, transit, nationality, and document scenario against the source chapter.', 'Advise passenger to verify visa and entry requirements before travel.', 'Use source contact/channel guidance when the case requires travel shop or airport handling.', 'Update SPRINT comments where a case or advice record is required.'),
      jsonb_build_array('Advise that passengers are responsible for holding valid travel documents and visa/entry approvals.', 'Advise customer to check official destination requirements before travel.', 'If the case needs verification, direct passenger to the source-supported channel.'),
      jsonb_build_array('Visa and travel document guidance can be provided from the source chapter.', 'Some cases may require travel shop or airport verification.'),
      jsonb_build_array('Do not guarantee boarding or entry when documents have not been verified by the responsible authority.', 'Do not override destination or immigration requirements.'),
      jsonb_build_array('Escalate unclear visa/document cases to supervisor or the source-designated team/channel.'),
      null::text,
      array['visa', 'travel document', 'entry requirement', 'UAE travel shops'],
      array['VISA', 'travel document', 'visa change'],
      70,
      array['Visa', 'UAE Travel Shops', 'Travel Requirements'],
      array['visa', 'travel document', 'entry requirement', 'ok to board']
    ),

    -- ok-to-board: Travel Document Service.
    -- Exact cut-off and fee left blank until reviewed against source chapter.
    (
      'OK to Board',
      'ok-to-board',
      'Travel Documents',
      'OKTB',
      'Travel Document Service',
      jsonb_build_array('Contact Centre', 'Travel Shop', 'Airport'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Travel Shop / Airport team where source requires document verification'),
      jsonb_build_array('Booking reference', 'Passenger name', 'Destination', 'Visa/document details', 'Document copy or reference where source requires it'),
      jsonb_build_array('Retrieve booking.', 'Confirm whether the route/document scenario requires OK to Board handling.', 'Check source chapter for required document and channel.', 'Record advice/action in SPRINT where required.'),
      jsonb_build_array('Advise passenger that OK to Board/document acceptance depends on the source process and travel document validity.', 'Advise passenger to carry original travel documents and approvals.'),
      jsonb_build_array('OK to Board guidance may apply where the source chapter requires document verification before travel.'),
      jsonb_build_array('Do not confirm OK to Board without the required source-supported verification.', 'Do not guarantee immigration acceptance.'),
      jsonb_build_array('Escalate unclear OKTB/document acceptance cases to supervisor or source-designated channel.'),
      null::text,
      array['OKTB', 'ok to board', 'visa', 'travel document'],
      array['OKTB', 'OK to Board', 'VIOK'],
      68,
      array['Ok to Board', 'OK to Board', 'Visa', 'UAE Travel Shops'],
      array['OKTB', 'ok to board', 'visa ok', 'travel document']
    ),

    -- meal: Ancillary Service.
    -- Exact meal cut-off/fee left blank pending source review.
    (
      'Meal',
      'meal',
      'Ancillary',
      'MEAL',
      'Ancillary Service',
      jsonb_build_array('Contact Centre', 'Website', 'Mobile App', 'Airport where source allows'),
      null::text,
      jsonb_build_array('Contact Centre agent', 'Passenger self-service where available'),
      jsonb_build_array('Booking reference', 'Passenger name', 'Flight/date', 'Meal type or SSR code', 'Passenger dietary requirement'),
      jsonb_build_array('Retrieve booking.', 'Identify requested meal type/SSR code.', 'Check whether meal request is available for the flight and booking scenario in source.', 'Add or guide passenger to the eligible channel.', 'Update comments where required.'),
      jsonb_build_array('Advise that meal availability depends on route, timing, and source rules.', 'Advise passenger to request the meal through eligible channels before the applicable cut-off once verified.'),
      jsonb_build_array('Special meal requests may be supported where source and flight conditions allow.'),
      jsonb_build_array('Do not guarantee meal availability without checking source/system availability.'),
      jsonb_build_array('Escalate unclear meal SSR or exception requests to supervisor.'),
      null::text,
      array['meal', 'SPML', 'AVML', 'CHML', 'VGML', 'BBML', 'KSML'],
      array['meal', 'special meal', 'SPML', 'AVML', 'CHML', 'VGML'],
      55,
      array['Meal', 'Meals', 'Special Meal'],
      array['SPML', 'AVML', 'CHML', 'VGML', 'meal']
    ),

    -- pregnancy: Medical / Travel Eligibility Reference.
    -- Deadlines/medical certificate thresholds left blank until source review confirms exact weeks/timing.
    (
      'Pregnancy',
      'pregnancy',
      'Medical',
      'PREG',
      'Medical / Travel Eligibility Reference',
      jsonb_build_array('Contact Centre', 'Airport', 'Medical review channel where source requires'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Airport / medical review where documentation is required'),
      jsonb_build_array('Booking reference if available', 'Passenger pregnancy week/stage', 'Expected delivery date where applicable', 'Route/date of travel', 'Medical certificate details if required by source'),
      jsonb_build_array('Identify pregnancy stage and travel date.', 'Check source chapter for travel eligibility and documentation requirement.', 'Advise passenger to carry required medical certificate where source applies.', 'Escalate unclear or high-risk cases.'),
      jsonb_build_array('Advise passenger that acceptance depends on pregnancy stage, route, documentation, and source rules.', 'Advise passenger to carry required medical documents where applicable.'),
      jsonb_build_array('Pregnant passengers may travel where source eligibility and documentation rules are satisfied.'),
      jsonb_build_array('Do not confirm travel acceptance if source documentation/eligibility is not met.', 'Do not provide medical advice beyond source travel eligibility guidance.'),
      jsonb_build_array('Escalate unclear pregnancy eligibility or document cases to supervisor or medical review channel.'),
      null::text,
      array['pregnancy', 'pregnant passenger', 'medical certificate'],
      array['pregnancy', 'pregnant', 'medical certificate'],
      60,
      array['Pregnancy', 'Medical'],
      array['pregnancy', 'pregnant', 'medical certificate']
    ),

    -- meda: Medical Assistance Service.
    -- Exact MEDA cut-off/form timing left blank until reviewed in source.
    (
      'MEDA Medical Assistance',
      'meda',
      'Medical',
      'MEDA',
      'Medical Assistance Service',
      jsonb_build_array('Contact Centre', 'Medical review channel', 'Airport where source requires'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance/intake', 'Medical review team where approval is required', 'Airport team for day-of-travel handling'),
      jsonb_build_array('Booking reference', 'Passenger name', 'Medical condition summary', 'Required assistance/service', 'Medical documents/forms where source requires', 'Flight/date'),
      jsonb_build_array('Retrieve booking if available.', 'Identify the medical assistance request.', 'Check source chapter for required MEDA documentation and approval flow.', 'Collect required information and direct/escalate to medical review where source requires.', 'Record case notes in SPRINT/Salesforce where required.'),
      jsonb_build_array('Advise passenger that travel/assistance approval depends on medical documentation and source process.', 'Advise passenger not to travel without required approval/documents where source applies.'),
      jsonb_build_array('MEDA assistance can be handled where required documents and approvals meet source rules.'),
      jsonb_build_array('Do not confirm medical acceptance without required approval.', 'Do not provide medical advice beyond documented travel process.'),
      jsonb_build_array('Escalate MEDA cases to the source-designated medical/supervisor channel.'),
      null::text,
      array['MEDA', 'medical assistance', 'fit to fly'],
      array['MEDA', 'medical', 'fit to fly'],
      66,
      array['MEDA', 'Medical'],
      array['MEDA', 'medical assistance', 'fit to fly']
    ),

    -- dpna: Special Assistance Service.
    -- Exact cut-off left blank until source review confirms timing.
    (
      'DPNA Assistance',
      'dpna',
      'Special Assistance',
      'DPNA',
      'Special Assistance Service',
      jsonb_build_array('Contact Centre', 'Airport', 'Special assistance channel where source requires'),
      null::text,
      jsonb_build_array('Contact Centre agent', 'Airport / special assistance team where source requires'),
      jsonb_build_array('Booking reference', 'Passenger name', 'Assistance requirement', 'Companion/helper details where applicable', 'Relevant documents where source requires'),
      jsonb_build_array('Retrieve booking.', 'Confirm assistance requirement and whether DPNA applies.', 'Check source chapter for eligibility, documents, and handling channel.', 'Add/request SSR where source allows.', 'Update comments.'),
      jsonb_build_array('Advise passenger that assistance is subject to source eligibility and airport handling.', 'Advise passenger to arrive with required documents and companion where source requires.'),
      jsonb_build_array('DPNA/special assistance can be supported where source criteria are met.'),
      jsonb_build_array('Do not confirm unsupported assistance or medical acceptance without source approval.'),
      jsonb_build_array('Escalate unclear DPNA/special assistance cases to supervisor or source-designated channel.'),
      null::text,
      array['DPNA', 'disabled passenger', 'special assistance'],
      array['DPNA', 'special assistance'],
      64,
      array['Special Assistance', 'Wheelchair', 'Medical'],
      array['DPNA', 'disabled passenger', 'special assistance']
    ),

    -- payment: Payment Process.
    -- Fee/cut-off left blank; payment failure handling depends on source/system scenario.
    (
      'Payment',
      'payment',
      'Payment',
      'CCHK',
      'Payment Process',
      jsonb_build_array('Contact Centre', 'Website', 'Mobile App', 'Payment gateway / system channel'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Supervisor / payment support where source requires'),
      jsonb_build_array('Booking reference', 'Passenger name', 'Payment amount', 'Payment status/error', 'Card/payment method details allowed by policy', 'Transaction/reference details where available'),
      jsonb_build_array('Identify payment scenario and booking status.', 'Check source chapter for payment failure, card verification, or payment-link handling.', 'Do not collect or store sensitive card data beyond approved process.', 'Guide customer through eligible payment channel or escalate where source requires.', 'Update SPRINT/Salesforce notes.'),
      jsonb_build_array('Advise customer according to the source-supported payment status and next action.', 'Advise customer not to share full sensitive payment details outside approved secure channels.'),
      jsonb_build_array('Payment support can be provided through approved source/system channels.'),
      jsonb_build_array('Do not request or store full card details in notes.', 'Do not confirm ticketing/service until payment status is confirmed.'),
      jsonb_build_array('Escalate unresolved payment errors or card verification issues to supervisor/payment support as source requires.'),
      null::text,
      array['payment', 'CCHK', 'card verification', 'payment failure'],
      array['payment', 'CCHK', 'card check', 'payment failure'],
      72,
      array['Payment', 'Card', 'CCHK'],
      array['payment', 'CCHK', 'card verification', 'payment failure']
    ),

    -- voucher-refund: Refund / Voucher Process.
    -- Exact eligibility and timeline left blank until reviewed against refund chapter.
    (
      'Voucher / Refund',
      'voucher-refund',
      'Refund',
      'RFND / VCHR',
      'Refund / Voucher Process',
      jsonb_build_array('Contact Centre', 'Manage Booking where eligible', 'Supervisor / Refund support'),
      null::text,
      jsonb_build_array('Contact Centre agent', 'Supervisor / refund support for exceptions'),
      jsonb_build_array('Booking reference', 'Passenger name', 'Ticket/payment details', 'Reason for refund/voucher', 'Disruption/voluntary scenario', 'Original form of payment'),
      jsonb_build_array('Retrieve booking and identify refund/voucher scenario.', 'Check source refund rules and any zone/FOP/voucher restrictions.', 'Confirm whether passenger request is voluntary, involuntary, or disruption-related.', 'Apply source-supported guidance or escalate where required.', 'Update case notes.'),
      jsonb_build_array('Advise passenger according to the source refund/voucher eligibility.', 'Advise that bank processing timelines may vary where source script applies.', 'Advise that refund/voucher outcome depends on fare, reason, payment method, and source policy.'),
      jsonb_build_array('Refund/voucher handling may be available where source policy allows.'),
      jsonb_build_array('Do not promise original FOP refund or fee waiver unless source policy confirms it.', 'Do not process restricted refund scenarios without supervisor/source guidance.'),
      jsonb_build_array('Escalate refund exceptions, disruption zone cases, and original-FOP insistence cases to supervisor/refund support.'),
      null::text,
      array['refund', 'voucher', 'FOP', 'refund request'],
      array['refund', 'voucher', 'VCHR', 'RFND'],
      74,
      array['Refund', 'Voucher', 'Flight Disruption'],
      array['refund', 'voucher', 'FOP', 'credit card statement']
    ),

    -- check-in-olci: Check-in Reference.
    -- Exact check-in opening/closure windows left blank unless source reviewed.
    (
      'Check-in / OLCI',
      'check-in-olci',
      'Check-in',
      'OLCI',
      'Check-in Reference',
      jsonb_build_array('Website', 'Mobile App', 'Airport check-in', 'Contact Centre for guidance'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Airport check-in team for airport handling'),
      jsonb_build_array('Booking reference', 'Passenger name', 'Flight/date', 'Check-in status', 'Error message if OLCI failed', 'SSR/document status where relevant'),
      jsonb_build_array('Identify check-in scenario and whether OLCI or airport check-in applies.', 'Check source chapter for online check-in rules and exceptions.', 'Advise passenger on eligible channel or airport handling.', 'Escalate technical or restricted cases where source requires.'),
      jsonb_build_array('Advise passenger to use eligible check-in channel according to source rules.', 'For OLCI issues, advise passenger according to source-supported troubleshooting or airport handling.'),
      jsonb_build_array('Online or airport check-in may be available depending on source rules, booking status, and passenger/route conditions.'),
      jsonb_build_array('Do not guarantee online check-in when route, document, SSR, booking status, or source restriction blocks it.'),
      jsonb_build_array('Escalate unresolved OLCI/check-in technical or restricted cases to supervisor/support channel.'),
      null::text,
      array['OLCI', 'online check-in', 'check-in', 'DCS'],
      array['OLCI', 'DCS', 'online check-in'],
      78,
      array['Ways to Check-in', 'Check-in', 'Online Check-in'],
      array['OLCI', 'online check-in', 'DCS', 'check-in']
    ),

    -- interline-connection: Interline Reference.
    -- Builds on existing interline card if present; exact baggage/fee rules stay in source/MCT cards.
    (
      'Interline / Connection',
      'interline-connection',
      'Interline',
      'OAL / APIS',
      'Interline Reference',
      jsonb_build_array('Contact Centre', 'Airport transfer desk', 'Partner airline / ticket issuer where source requires'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Airport transfer desk / partner airline for operational handling', 'Supervisor for unclear interline/codeshare cases'),
      jsonb_build_array('Booking reference', 'Ticket issuer', 'Operating carriers', 'Connection details', 'Terminal routing', 'Baggage tag/status', 'Passenger documents'),
      jsonb_build_array('Check whether booking is interline/codeshare and identify ticket issuer.', 'Check connection/transfer rules and baggage handling source.', 'Advise passenger based on one-ticket/separate-ticket and terminal/carrier scenario.', 'Escalate unclear OAL/codeshare handling before committing.'),
      jsonb_build_array('Advise passenger to carry onward ticket/booking confirmation and valid documents.', 'Advise passenger where ticket issuer or partner airline must handle the request.'),
      jsonb_build_array('Interline/connection handling may apply where source rules and carrier/ticketing conditions support it.'),
      jsonb_build_array('Do not commit partner airline rebooking/refund/baggage handling unless source policy supports it.', 'Do not override ticket issuer responsibility.'),
      jsonb_build_array('Escalate unclear interline/codeshare cases to supervisor or source-designated support team.'),
      null::text,
      array['interline', 'connection', 'transfer', 'codeshare', 'OAL', 'APIS'],
      array['interline', 'connection', 'transfer', 'OAL', 'APIS'],
      85,
      array['Interline', 'Connection and Transfers'],
      array['interline', 'connection', 'transfer', 'OAL', 'APIS', 'codeshare']
    ),

    -- government-deals: Booking Process.
    -- Exact eligibility and codes must be reviewed from source.
    (
      'Government Deals',
      'government-deals',
      'Booking',
      'GOV',
      'Booking Process',
      jsonb_build_array('Contact Centre', 'Website / booking flow where eligible', 'Government deal channel where source requires'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Supervisor for eligibility exceptions'),
      jsonb_build_array('Booking reference if available', 'Deal/program name', 'Passenger eligibility detail', 'Promo/deal code where applicable', 'Travel dates and route'),
      jsonb_build_array('Identify government deal/program requested.', 'Check source chapter for eligibility and booking process.', 'Verify required eligibility details before advising.', 'Guide passenger to eligible booking/channel or escalate.'),
      jsonb_build_array('Advise passenger that government deal eligibility depends on source rules and required proof/code.', 'Advise passenger to keep eligibility documents if source requires.'),
      jsonb_build_array('Government deals may be used where source eligibility and booking conditions are met.'),
      jsonb_build_array('Do not apply or promise government deal eligibility without source criteria.', 'Do not bypass required proof/code/channel.'),
      jsonb_build_array('Escalate unclear government deal eligibility or booking exceptions to supervisor.'),
      null::text,
      array['government deals', 'ESAAD', 'ALSAADA', 'GDRFA'],
      array['government deals', 'ESAAD', 'ALSAADA', 'GDRFA'],
      75,
      array['Government Deals'],
      array['ESAAD', 'ALSAADA', 'GDRFA', 'government deals']
    ),

    -- gds: GDS Reference.
    -- Exact GDS command/process must be drafted after source review.
    (
      'GDS',
      'gds',
      'GDS',
      'GDS',
      'GDS Reference',
      jsonb_build_array('GDS', 'Contact Centre', 'GDS support'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'GDS support for system/booking assistance'),
      jsonb_build_array('GDS booking reference', 'PNR', 'Ticket/document number', 'Request type', 'Error/message where applicable'),
      jsonb_build_array('Identify the GDS scenario.', 'Check source chapter for supported action and restrictions.', 'Avoid unsupported direct changes where source requires GDS support or separate process.', 'Escalate to GDS support when required.'),
      jsonb_build_array('Advise passenger/agent according to source-supported GDS handling and responsibility.'),
      jsonb_build_array('GDS handling is supported where source process and ownership allow it.'),
      jsonb_build_array('Do not perform unsupported GDS changes directly.', 'Do not override GDS/ticketing ownership rules.'),
      jsonb_build_array('Escalate unsupported or unclear GDS cases to GDS support or supervisor.'),
      null::text,
      array['GDS', 'ticketing', 'document', 'PNR'],
      array['GDS', 'PNR', 'ticketing'],
      62,
      array['GDS', 'E-Ticketing Viewer'],
      array['GDS', 'PNR', 'ticketing', 'document number']
    ),

    -- fare-types: Fare Reference.
    -- Exact fare rules/fees remain blank for reviewer to draft from source.
    (
      'Fare Types',
      'fare-types',
      'Fares',
      'FARE',
      'Fare Reference',
      jsonb_build_array('Contact Centre', 'Website', 'Travel Shop'),
      null::text,
      jsonb_build_array('Contact Centre agent for fare guidance', 'Supervisor for unclear fare-rule exceptions'),
      jsonb_build_array('Booking reference if available', 'Fare brand/type', 'Route/date', 'Customer request: change, refund, baggage, seat, or service'),
      jsonb_build_array('Identify fare type/brand.', 'Check source fare type chapter for included services and restrictions.', 'Advise passenger according to fare conditions.', 'Escalate unclear fare-rule exceptions.'),
      jsonb_build_array('Advise passenger that fare conditions determine included services, changes, refund, and optional extras.'),
      jsonb_build_array('Fare rules apply according to source fare type/brand.'),
      jsonb_build_array('Do not promise change/refund/service benefits without checking fare type source rule.'),
      jsonb_build_array('Escalate unclear fare-rule exception requests to supervisor.'),
      null::text,
      array['fare types', 'fare brand', 'rules', 'auto split'],
      array['fare types', 'fare brand', 'fare rules'],
      58,
      array['Fare Types'],
      array['fare types', 'fare brand', 'fare rules', 'auto split']
    ),

    -- staff-tickets: Staff Travel Reference.
    -- Exact staff-ticket eligibility/fees left blank pending source review.
    (
      'Staff Tickets',
      'staff-tickets',
      'Staff Travel',
      'ID50 / ID90',
      'Staff Travel Reference',
      jsonb_build_array('Contact Centre', 'Staff travel channel where source requires', 'Airport where source requires'),
      null::text,
      jsonb_build_array('Contact Centre agent for guidance', 'Staff travel / supervisor channel for eligibility exceptions'),
      jsonb_build_array('Booking reference if available', 'Staff ticket type', 'Passenger/staff eligibility detail', 'Travel date/route', 'Request type'),
      jsonb_build_array('Identify staff ticket type and request.', 'Check source chapter for staff travel eligibility and restrictions.', 'Guide passenger/staff to source-supported channel.', 'Escalate exceptions.'),
      jsonb_build_array('Advise that staff ticket handling depends on staff travel rules and eligibility.', 'Advise passenger/staff to follow source-supported staff travel channel where required.'),
      jsonb_build_array('Staff ticket handling may be supported where source eligibility and process allow.'),
      jsonb_build_array('Do not treat staff tickets as standard commercial bookings without checking source rules.', 'Do not override staff travel eligibility restrictions.'),
      jsonb_build_array('Escalate unclear staff travel eligibility or exception cases to supervisor/staff travel channel.'),
      null::text,
      array['staff tickets', 'ID50', 'ID90', 'staff travel'],
      array['staff tickets', 'ID50', 'ID90', 'staff travel'],
      57,
      array['Staff Tickets', 'Staff Travel'],
      array['staff tickets', 'ID50', 'ID90', 'staff travel']
    ),

    -- insurance: Ancillary Service.
    -- Exact sales/refund/cut-off left blank except source-backed non-refundable warning from baggage optional extras extraction.
    (
      'Insurance',
      'insurance',
      'Ancillary',
      'INS',
      'Ancillary Service',
      jsonb_build_array('Website', 'Contact Centre for eligible new booking exception', 'Eligible servicing channels'),
      null::text,
      jsonb_build_array('Contact Centre agent for eligible guidance', 'Supervisor for modified/new booking exception where source requires'),
      jsonb_build_array('Booking reference', 'Passenger name', 'Insurance request/status', 'Booking creation/modification timing', 'Route/date'),
      jsonb_build_array('Retrieve booking.', 'Check source rules for insurance eligibility and whether request is linked to new booking/optional extras.', 'Confirm whether insurance can be added through eligible channel.', 'Advise passenger on non-refundable restriction where source applies.'),
      jsonb_build_array('Advise that insurance availability depends on booking/channel/source rules.', 'Advise that insurance is non-refundable where source states.'),
      jsonb_build_array('Insurance may be available through eligible booking/servicing channels where source allows.'),
      jsonb_build_array('Insurance is non-refundable according to source optional-extras rule.', 'Do not add insurance where source/channel does not support it.'),
      jsonb_build_array('Escalate unclear insurance optional-extra cases to supervisor.'),
      null::text,
      array['insurance', 'optional extras', 'non-refundable'],
      array['insurance', 'optional extras'],
      56,
      array['Insurance', 'Baggage', 'Optional Extras'],
      array['insurance', 'optional extras', 'non-refundable']
    ),

    -- seat-assignment: Seat Service.
    -- Exact seat-fee/cut-off left blank pending source review.
    (
      'Seat Assignment',
      'seat-assignment',
      'Seats',
      'SEAT',
      'Seat Service',
      jsonb_build_array('Contact Centre', 'Website', 'Mobile App', 'Airport where source allows'),
      null::text,
      jsonb_build_array('Contact Centre agent', 'Airport team for airport-handled seating', 'Supervisor for exception/SSR-related seating'),
      jsonb_build_array('Booking reference', 'Passenger name', 'Seat request', 'Passenger SSR/special assistance status', 'Fare/booking status', 'Flight/date'),
      jsonb_build_array('Retrieve booking.', 'Check requested seat and passenger eligibility/restrictions.', 'Check source seat rules, chargeability, and SSR-related seating conditions.', 'Assign or guide passenger to eligible channel where source allows.', 'Escalate exceptions.'),
      jsonb_build_array('Advise passenger that seat assignment is subject to availability, fare/service rules, and restrictions.', 'Advise that some seats may be chargeable or restricted.'),
      jsonb_build_array('Seat assignment may be available where source rules and availability allow.'),
      jsonb_build_array('Do not assign restricted seats to ineligible passengers.', 'Do not promise specific seats without confirming availability and source restrictions.'),
      jsonb_build_array('Escalate SSR-related seating, restricted seat, or exception cases to supervisor/airport team where source requires.'),
      null::text,
      array['seat', 'seat assignment', 'SEAT', 'extra legroom'],
      array['SEAT', 'seat assignment', 'seat'],
      65,
      array['Seat', 'Seats'],
      array['seat assignment', 'seat', 'extra legroom', 'SEAT']
    )
),
resolved as (
  select
    seed.*,
    chapter.id as chapter_id,
    chapter.page_start,
    chapter.page_end,
    chapter.source_version,
    chapter.updated_at as source_updated_at
  from seed
  left join lateral (
    select
      chapters.id,
      chapters.page_start,
      chapters.page_end,
      chapters.source_version,
      chapters.updated_at
    from chapters
    where
      exists (
        select 1
        from unnest(seed.title_patterns) as pattern
        where chapters.title ilike '%' || pattern || '%'
      )
      or exists (
        select 1
        from unnest(seed.body_patterns) as pattern
        where
          chapters.body_text ilike '%' || pattern || '%'
          or array_to_string(chapters.search_keywords, ' ') ilike '%' || pattern || '%'
      )
    order by
      case
        when exists (
          select 1
          from unnest(seed.title_patterns) as pattern
          where chapters.title ilike '%' || pattern || '%'
        )
        then 0
        else 1
      end,
      chapters.chapter_number
    limit 1
  ) as chapter on true
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
  where chapter_id is not null
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
  slug,
  category,
  service_code,
  service_type,
  'Draft operational card linked to source chapter for quality review.',
  'Use this card after quality review to guide agents from the source-backed operational chapter.',
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
