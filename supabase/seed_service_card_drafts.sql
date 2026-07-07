-- ============================================================
-- Seed: source-backed operational service card drafts
-- Run after supabase/migration_service_card_fields.sql.
--
-- Safety:
-- - Updates existing procedure_cards by slug only.
-- - Does not approve or publish anything.
-- - Skips cards that are already approved and published.
-- - All cards remain needs_review for quality/admin review before publish.
-- ============================================================

with draft_updates as (
  select *
  from (
    values
      (
        'extra-seat-cbbg',
        'EXST / CBBG',
        'Booking',
        jsonb_build_array('Contact Centre', 'GDS support when required', 'Airport for go-show handling'),
        'Request must be made at least 2 hours before departure time.',
        jsonb_build_array('Contact Centre agent', 'Supervisor / floor in charge when window seats are not available or no-show guidance is required', 'Airport team for go-show acceptance'),
        jsonb_build_array('Booking reference', 'Passenger name', 'Reason for extra seat: comfort EXST or cabin baggage CBBG', 'Fare brand', 'Seat availability for adjoining seats', 'Cabin baggage dimensions/weight when CBBG applies'),
        jsonb_build_array('Retrieve the booking.', 'Confirm whether the request is for comfort or carrying valuable/fragile cabin baggage.', 'Add an adult passenger using first name EXST or CBBG and the passenger last name.', 'Add SSR EXST or CBBG with zero value to the passenger requesting the extra seat, not to the extra seat passenger.', 'Pre-assign adjoining seats for passenger and extra seat; window and middle seats are referenced in the source process.', 'Collect applicable seat charges as per standard rates.', 'Add clear booking comments with the reason and SSR details.'),
        jsonb_build_array('Explain that EXST is for comfort and CBBG is for valuable or fragile cabin baggage that cannot be checked in.', 'Advise that seat assignment for the passenger and extra seat is mandatory.', 'Advise that standard penalty charges apply on booking modification and apply to both seats.', 'Advise that go-show acceptance is airport-handled and subject to capacity and approval.'),
        jsonb_build_array('EXST/CBBG is available on FZ prime booked flights.', 'Business Class passengers can book EXST for comfort.', 'Maximum two EXST seats are permitted per passenger.', 'Only one CBBG seat is allowed for each passenger.', 'For comfort EXST, checked baggage allowance applies for the passenger and extra seat as per booked fare.', 'Musical instruments taller than 55 cm and less than 140 cm may travel in cabin if a seat is purchased and the item can be secured.'),
        jsonb_build_array('EXST/CBBG cannot be purchased as interline/codeshare document.', 'Extra seat cannot be added directly to GDS bookings; a separate PNR can be created for the extra seat.', 'CBBG is not available for Business Class passengers.', 'EXST must not be allocated in emergency exit rows 15 or 16.', 'CBBG must not be allocated in rows 14, 15, 16, or 17.', 'Passengers with CBBG are not eligible for extra checked-in baggage allowance.', 'Hand luggage entitlement is per passenger, not per seat.', 'Blocked-seat baggage must not exceed 75 kg and must not exceed the seat/headrest dimensions stated in source.', 'If passenger is boarded and EXST/CBBG is no-show, cancellation or modification is not permitted without floor-in-charge guidance.'),
        jsonb_build_array('Refer to supervisor in charge if required adjoining/window seats are not available.', 'Approach floor in charge for no-show cancellation/modification guidance.', 'FS/SUP may contact GDS support for GDS booking assistance if required.'),
        'Pre-assigning seats for both passenger and extra seat is chargeable as per standard rates. Standard penalty charges apply on booking modification. Go-show fares apply for airport additional-seat handling.'
      ),
      (
        'sporting-equipment',
        'SPEQ / SPEX',
        'Baggage',
        jsonb_build_array('Contact Centre', 'Supervisor', 'Customer Service Group for firearms/ammunition approval', 'Airport check-in for checked baggage acceptance'),
        'Sporting equipment process requires verifying the flight is more than 24 hours prior to departure. Firearms/ammunition approval documents are required 4 working days before travel.',
        jsonb_build_array('Contact Centre agent for point-to-point requests', 'Supervisor for connecting, interline, or codeshare SSR handling', 'Customer Service Group / Security for firearms or ammunition approval'),
        jsonb_build_array('PNR', 'Passenger name', 'Flight details', 'Equipment type and dimensions', 'Whether itinerary is point-to-point, connecting, interline, or codeshare', 'For weapon/firearms: nationality, passport details/copy, weapon details, make/caliber/model, serial number, license copy, number of firearms, ammunition quantity/weight, purpose of carriage'),
        jsonb_build_array('Retrieve PNR and verify the flight is more than 24 hours prior to departure.', 'Advise customer on maximum dimensions, packing requirements, and charges per item.', 'For 160-189 cm, add SPEQ per leg.', 'For 190-350 cm, add SPEX per leg.', 'Collect payment where applicable.', 'Update SPRINT comments.', 'For connecting/interline/codeshare requests, escalate to Supervisor to add SSR and advise customer to call back for payment completion if any.'),
        jsonb_build_array('Advise that sporting equipment is subject to applicable fees and must be pre-booked.', 'Advise the customer on dimensions, packing requirements, and charges.', 'For weapons/firearms/ammunition, advise customer that carriage is subject to approval and documents/details must be provided.'),
        jsonb_build_array('Sporting equipment can be carried on flydubai flights subject to applicable fees and pre-booking.', 'SPEQ applies for equipment between 160-189 cm.', 'SPEX applies for equipment between 190-350 cm.', 'Cancelling SPEX/SPEQ is permitted up to 24 hours prior to departure with refund in voucher form.'),
        jsonb_build_array('Sporting weapon, firearms, or ammunition can be carried as checked-in baggage only.', 'Interline/codeshare partner charges may differ and partners cannot be charged if they do not charge currently.', 'Weapon/firearms approval is valid only for the approved flight/date/sector; a new approval is required if travel date changes.'),
        jsonb_build_array('Escalate connecting, interline, or codeshare requests to Supervisor for SSR handling.', 'Escalate SPEX/SPEQ cancellation request to Supervisor/FS in charge if applicable.', 'For firearms/ammunition, create and escalate case to Supervisor and Customer Service Group / Security approval flow.'),
        'Sporting equipment fees apply per item/leg as per source process. Firearms/ammunition: SSR WEAP AED 300 per passenger plus SSR SPEX charges per passenger per segment where applicable.'
      ),
      (
        'falcon-handling',
        'PETC / Falcon',
        'Special Assistance',
        jsonb_build_array('Contact Centre', 'Supervisor', 'Reservations Support', 'Airport / DXB Sales for go-show handling'),
        'Contact Centre process creates an unpaid booking only if the flight is more than 48 hours before departure. Refund request prior to 24 hours of departure follows fare rules.',
        jsonb_build_array('Contact Centre agent', 'Contact Centre supervisor', 'Reservations Support', 'Airport representative for accepted go-show falcons', 'DXB Sales team for DXB/DWC go-show bookings'),
        jsonb_build_array('PNR', 'Class of travel', 'Flight number/date/sector inbound and outbound', 'Number of passengers', 'Passenger names', 'Contact number', 'Email ID', 'Number of falcons', 'Manner of carriage: hand or box', 'Number of falcons per box', 'Number of boxes', 'Box dimensions', 'Airport handling charge collection status', 'Valid health certificate and required destination documents'),
        jsonb_build_array('Create an unpaid booking if the flight is more than 48 hours before departure.', 'Use first name falcon and primary passenger last name for falcon names in the booking.', 'Collect all required passenger, flight, falcon, carriage, contact, and charge details.', 'Inform customer that the information is not confirmation of carriage and prior approval is mandatory.', 'Create and escalate case in Salesforce to Supervisor.', 'Update SPRINT comments.', 'Supervisor sends details to allresteamleaders@flydubai.com and reservationssupport@flydubai.com for approvals and payment time limit extension.'),
        jsonb_build_array('Advise the customer that prior approval is mandatory and the request is not confirmed until approved.', 'Advise caller to contact back within 4 hours from request time to check approval status.', 'Advise that every falcon carried is charged one seat.', 'Advise that airport handling charges are non-refundable.', 'Advise that a valid health certificate and destination documents must be carried for and with the falcon.', 'Advise that any falcon arriving into DXB has to be carried in a box only.'),
        jsonb_build_array('Maximum 2 falcons per handler are allowed.', 'A maximum of 2 boxes with 1 falcon in each box can be carried by each handler.', 'A falcon may travel on the hand of a handler where allowed.', 'Baby falcons can be carried in cabin if they are in an AVI live animals box and secured to a seat.', 'Falcons must be accompanied by a handler in the same cabin.', 'Falcons may be accepted on go-show basis subject to airport process.'),
        jsonb_build_array('Perches are no longer permitted for falcon carriage.', 'No falcons can be carried in perches or on seats in Business Class.', 'Boxes are not provided by flydubai.', 'Falcons arriving into DXB/DWC must arrive in a box.', 'Passenger cannot use checked-in baggage allowance for falcons.', 'Tickets are non-refundable within 24 hours of departure, after no-show, or where falcons are rejected by authorities.', 'flydubai is not permitted to accept falcons on behalf of interline/codeshare carriers.', 'DMM does not allow falcons.'),
        jsonb_build_array('If number of falcons exceeds 15, higher authority CCO approval is required.', 'For flights close to departure, FS/SUP should treat the request as priority and follow up for approval.', 'Within 24 hours modification or after no-show requires approval.', 'If last-minute aircraft change prevents carriage, offer rebooking to next available flight or refund without penalty for unutilized portion as per source.', 'For no-show cancellation/modification where linked passenger boarded, contact floor in charge.'),
        'Airport handling charge is AED 1500 per falcon per direction. Seat block for falcons is charged at available fare at booking time. Airport handling charges are non-refundable.'
      ),
      (
        'lounge-access-during-olci',
        'LNGL / OLCI Lounge',
        'Check-in',
        jsonb_build_array('Website', 'Online Check-in', 'DXB Terminal 2 subject to availability'),
        'Available for purchase within 48 hours prior to departure, provided OLCI is open for the flight via flydubai website. Passenger can purchase 4-hour access.',
        jsonb_build_array('Passenger self-service during OLCI', 'Contact Centre for service guidance and classification', 'Shift in charge for manual SSR guidance scenarios'),
        jsonb_build_array('Booking reference', 'Passenger name', 'Flight/date', 'Booking status', 'Whether lounge was purchased during OLCI', 'Scenario: voluntary modification, cancellation, upgrade, FDIS, no-show, terminal change, payment/service issue'),
        jsonb_build_array('Identify whether the lounge access was purchased during OLCI.', 'Check booking status and customer scenario.', 'For voluntary modification, drop SSR as source scenario table indicates.', 'For voluntary cancellation or upgrade to J class, drop SSR and do not offer refund.', 'For FDIS re-accommodation, move SSR to the new flight.', 'For FDIS cancellation/refund, follow refund to FOP or voucher as applicable.', 'Use Online check-in Lounge classification for lounge sale cases during online check-in.'),
        jsonb_build_array('Advise that lounge purchase during OLCI is subject to dynamic pricing and availability.', 'Advise that successful purchase is reflected on the boarding pass.', 'If not purchased online, advise the service may still be available at Terminal 2 subject to availability.', 'Advise that all charges are non-refundable and non-transferable unless FDIS scenario in source applies.'),
        jsonb_build_array('Available to passengers travelling or connecting with flydubai from DXB Terminal 2 during OLCI via flydubai website.', 'Available for Economy passengers.', 'Available for passengers upgraded to J class via OLCI or Plusgrade.', 'Available for ID50 bookings in J and Y class.', 'Can be purchased for one or multiple passengers in the same booking during OLCI.', 'All forms of payment are applicable.', 'Infants receive complimentary access when accompanied by an eligible adult.'),
        jsonb_build_array('Group bookings are excluded from online lounge purchase.', 'Infant passengers cannot purchase lounge access separately.', 'Passengers already eligible for lounge access, such as Business Class passengers or loyalty tier entitlement, are restricted from purchase.', 'All charges are non-refundable and non-transferable except source FDIS handling scenarios.'),
        jsonb_build_array('Refer to shift in charge for reinstatement of flight, no-show change/cancel, or terminal change where manual SSR handling is required.', 'Use service recovery classification where access could not be provided due to peak hours, payment unsuccessful, or similar source examples.'),
        'Pricing is dynamic and subject to availability. Charges apply per passenger. All forms of payment are applicable. All charges are non-refundable and non-transferable except source-defined FDIS refund scenarios.'
      ),
      (
        'minimum-connection-time',
        'MCT',
        'Connection',
        jsonb_build_array('Contact Centre', 'Airport transfer desk', 'dnata transfer desk', 'Terminal 3 sales desk for T3 services'),
        'MCT table: T2-T2 FZ-FZ 60 mins; T2-T2 FZ-OA 120 mins; T3-T3 FZ-FZ 90 mins; T3-T3 FZ-OA 90 mins; T2-T3 FZ-FZ/FZ-OA 120 mins; T2/T3-T1 FZ-OA 180 mins; see source for OA exceptions.',
        jsonb_build_array('Contact Centre agent', 'Airport transfer desk / dnata transfer desk for transfer handling', 'Airport team for exact excess baggage rate at departure'),
        jsonb_build_array('Onward ticket or flydubai booking confirmation', 'Valid travel documents for final destination', 'Baggage tag if baggage was checked in at journey start', 'Terminal routing', 'Operating carrier combination', 'Whether booking is one ticket or separate tickets'),
        jsonb_build_array('Check itinerary terminal routing and operating carrier combination.', 'Apply the MCT table from source for FZ-FZ, FZ-OA, and OA exceptions.', 'Advise customer whether baggage transfer applies based on one ticket or separate tickets.', 'For separate tickets or baggage not tagged through, advise airport transfer baggage handling/fee may apply.', 'For exact interline excess baggage rate, advise customer to check with airport team at departure.'),
        jsonb_build_array('Advise passengers connecting in Dubai that they may transfer to another flydubai flight without collecting baggage and without UAE visa when using flydubai connect services.', 'Advise passenger to show onward booking/ticket and travel documents at transfer desk.', 'For Emirates/flydubai on one ticket, advise baggage can be picked up at final destination with no additional cost.', 'Advise that quoted excess baggage rates are approximate and exact rate should be checked with airport team at departure.'),
        jsonb_build_array('Passengers can transfer in Dubai to another flydubai flight without collecting baggage and without UAE visa using flydubai connect services.', 'Baggage will be transferred to final destination whether under one or two separate tickets, subject to source conditions.', 'Business class booking is offered only if business class is available on both flydubai connecting flights.', 'If connecting with other airlines under one ticket, baggage is transferred at no additional cost.'),
        jsonb_build_array('Without a UAE visa, passenger cannot leave the airport.', 'If business class is not available on one leg, a mixed business/economy connection is not offered and the journey is booked in economy.', 'Flight connections of more than 24 hours are excluded from the baggage transfer service condition in source.', 'If passenger is no-show on onward connected flight, baggage will be offloaded and not transferred to last destination.', 'Baggage transfer service is not available for arrivals on British Airways, Flydeal, Pegasus Airlines, Pobeda Airlines, or Wizz Air.'),
        jsonb_build_array('Refer missing interline excess baggage rates to shift in charge.', 'Use dnata transfer desk for connecting flight boarding pass where applicable.', 'Passenger must clear immigration and re-check in at DXB/DWC for excluded carrier arrivals listed in source.'),
        'Transfer Baggage Fee may apply for passengers holding two separate tickets. Interline excess baggage rates vary by journey/carrier; source says quoted rates are approximate and exact rate should be checked with airport team at departure.'
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
  service_code = draft_updates.service_code,
  service_type = draft_updates.service_type,
  channels = draft_updates.channels,
  cut_off_time = draft_updates.cut_off_time,
  who_can_action = draft_updates.who_can_action,
  required_information = draft_updates.required_information,
  system_steps = draft_updates.system_steps,
  passenger_advice = draft_updates.passenger_advice,
  allowed = draft_updates.allowed,
  not_allowed = draft_updates.not_allowed,
  escalation_points = draft_updates.escalation_points,
  fees_charges = draft_updates.fees_charges,
  source_confidence = 'source_backed',
  review_status = 'needs_review',
  is_published = false,
  updated_at = now()
from draft_updates
where procedure.slug = draft_updates.slug
  and not (procedure.review_status = 'approved' and procedure.is_published = true);
