// Falcon Handling decision tree (Phase H).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 27 "Falcon Handling", pages 119-124. Verified rules:
//   - Booking must be submitted more than 48h before departure to obtain
//     mandatory airline approval; create an unpaid booking and escalate to
//     SUP -> RSU (pp.120, 124).
//   - More than 15 falcons on a flight requires higher-authority (CCO) approval
//     (p.121).
//   - No falcons on seats/perches in Business Class; perches not permitted
//     (p.122). DXB/DWC arrivals must be carried in a box (p.122).
//   - DMM not allowed; ULH/MED via the naama site; SPX/HBE/DBB need Egypt
//     import approval (pp.122-123).
//   - flydubai cannot accept falcons on behalf of interline/codeshare carriers;
//     the passenger books with the operating carrier and flydubai handles the
//     FZ sector only (p.123).
//   - AED 1500 per falcon per direction, non-refundable; 1 seat per falcon plus
//     the handler; no baggage allowance; refund <24h/no-show/rejected not
//     refundable (pp.121-122).

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const FALCON_HANDLING_DEFINITION: DecisionDefinition = {
  procedureSlug: "falcon-handling",
  procedureTitle: "Falcon Handling",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "27. Falcon Handling",
  sourcePages: [119, 120, 121, 122, 123, 124],
  questions: QUESTION_SETS["falcon-handling"],
  rules: [
    {
      id: "falcon-dmm",
      conditions: [{ questionId: "destination_restriction", equals: "DMM" }],
      outcome: "Not permitted",
      explanation: "Falcons are not allowed in DMM.",
      sourcePages: [122],
      sourceField: "not_allowed",
    },
    {
      id: "falcon-interline",
      conditions: [{ questionId: "journey_type", equals: "Interline or codeshare" }],
      outcome: "Not permitted",
      explanation:
        "flydubai is not permitted to accept falcons on behalf of interline/codeshare carriers. The passenger must book directly with the operating carrier; flydubai handles the FZ sector only.",
      nextAction:
        "Advise the passenger to book with the interline/codeshare carrier and report for acceptance there. flydubai checks in only the FZ sector.",
      sourcePages: [123],
      sourceField: "not_allowed",
    },
    {
      id: "falcon-business",
      conditions: [{ questionId: "cabin_class", equals: "Business" }],
      outcome: "Not permitted",
      explanation:
        "Falcons cannot be carried on seats or perches in Business Class (there is no safe way to secure them). Boxes are accepted in Economy only (rows 18-31).",
      sourcePages: [122],
      sourceField: "not_allowed",
    },
    {
      id: "falcon-under-48h",
      conditions: [{ questionId: "hours_before_departure", max: 47 }],
      outcome: "Not permitted",
      explanation:
        "Falcon bookings must be submitted more than 48 hours before departure to obtain the required approval; there is insufficient notice for this flight.",
      nextAction: "For flights close to departure, FS/SUP may treat an existing request as priority, but a new booking cannot be created inside 48 hours.",
      sourcePages: [120, 124],
      sourceField: "cut_off_time",
    },
    {
      id: "falcon-saudi",
      conditions: [{ questionId: "destination_restriction", equals: "ULH or MED (Saudi)" }],
      outcome: "Requires document",
      explanation:
        "For ULH/MED the request must be submitted through the Saudi naama site with a vaccination record, health certificate and animal passport; the station is then notified at least 48 hours before departure.",
      nextAction: "Submit via https://naama.sa/ with the required documents before confirming carriage.",
      sourcePages: [122, 123],
      sourceField: "required_information",
    },
    {
      id: "falcon-egypt",
      conditions: [{ questionId: "destination_restriction", equals: "SPX, HBE or DBB (Egypt)" }],
      outcome: "Requires document",
      explanation:
        "Falcons into Egypt (SPX/HBE/DBB) require prior import approval from the General Authority for Veterinary Services; documentation must reach the station at least 24 hours before departure.",
      nextAction: "Obtain the Egypt import approval and share documents with the station before confirming carriage.",
      sourcePages: [123],
      sourceField: "required_information",
    },
    {
      id: "falcon-missing-details",
      conditions: [{ questionId: "required_details_available", equals: false }],
      outcome: "Requires document",
      explanation:
        "The falcon details table must be collected before the request can be escalated for approval.",
      nextAction:
        "Obtain: flights/dates/sectors, number of passengers and falcons, carriage manner (box or hand), boxes and dimensions (55x45x40 cm), handler's confirmation they can carry the boxes unaided, contact number and email, and the PETC/airport-handling-charge details.",
      sourcePages: [120, 124],
      sourceField: "required_information",
    },
    {
      id: "falcon-over-15",
      conditions: [{ questionId: "falcon_count", min: 16 }],
      outcome: "Requires supervisor",
      explanation:
        "More than 15 falcons on a flight requires approval from higher authority (CCO); allow enough time to obtain approvals.",
      nextAction: "Escalate to a supervisor for CCO approval before confirming.",
      sourcePages: [121],
      sourceField: "escalation_points",
    },
    {
      id: "falcon-not-approved",
      conditions: [{ questionId: "approval_obtained", equals: false }],
      outcome: "Requires supervisor",
      explanation:
        "Prior airline approval is mandatory. Create an unpaid booking (flight more than 48h away), collect the details, and escalate to Supervisor -> Reservations Support for approval.",
      nextAction:
        "Create the unpaid booking, escalate the Salesforce case to SUP; SUP emails allresteamleaders@ and reservationssupport@ for approval. Advise the caller to check back within 4 hours; a new approval is needed if the itinerary changes.",
      sourcePages: [120, 124],
      sourceField: "escalation_points",
    },
    {
      id: "falcon-approved",
      conditions: [{ questionId: "approval_obtained", equals: true }],
      outcome: "Can proceed with conditions",
      explanation:
        "Approved: add SSR PETC and collect AED 1500 per falcon per direction (non-refundable). One seat is blocked per falcon plus one for the handler; max 2 falcons per handler.",
      nextAction:
        "Collect the airport handling charge (AED 1500/falcon/direction), ensure a valid health certificate travels with each falcon, block Economy seats (rows 18-31), and note DXB/DWC arrivals must be carried in a box. No checked-baggage allowance applies (the falcon seat is treated as CBBG).",
      sourcePages: [121, 122],
      sourceField: "fees_charges",
    },
  ],
  notes: [
    "A maximum of 2 falcons per handler; a handler must travel in the same cabin as the falcons.",
    "Airport handling charges are non-refundable; tickets are non-refundable within 24 hours of departure, after no-show, or where authorities reject the falcons.",
    "Perches are no longer permitted; boxes must fit and be secured on the seat (55x45x40 cm).",
    "Go-show falcons may be accepted through the airport (Reservations for outstations, DXB Sales for DXB/DWC).",
    "May also need: Extra Seat / CBBG reference, since a falcon seat is charged as CBBG.",
  ],
};
