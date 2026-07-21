// Extra Seat (EXST) / Cabin Baggage seat (CBBG) decision tree (Phase D).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 33 "Seat" — "Extra Seat EXST / CBBG - Process", pages 160-163.
// Rules verified verbatim:
//   - EXST/CBBG cannot be purchased as an interline/codeshare document;
//     FZ prime booked flights only (p.160 §1).
//   - GDS: extra seat cannot be added directly; a separate PNR is created
//     on an available fare with EXST/CBBG remarks (p.160 §3).
//   - Business Class: EXST allowed (p.160 §6); CBBG not available (p.160 §7).
//   - EXST not in emergency exit rows 15/16; CBBG not in rows 14-17
//     (p.160 §9-10).
//   - Max two EXST per passenger; only one CBBG per passenger (p.161 §16).
//   - Blocked-seat baggage max 75 kg; height within the seat headrest
//     (max 55x45x40 cm; musical instruments up to 140 cm with belt securing);
//     items that cannot be secured may not be accepted (p.161 §18-21).
//   - MEDA cases require medical approval (p.161 §22).
//   - Request at least 2 hours before departure (p.161 §23); later requests
//     are airport go-show only, DXB T2 departures, subject to capacity and
//     approval, at go-show fares (p.161 §28).
//   - No-show EXST/CBBG with boarded passenger: contact floor in charge
//     (p.161 §25).
//   - Checked-in restriction verified in ch.55: extra-seat requests are not
//     eligible for OLCI (p.283 §5) and offload requests to add SSRs are not
//     honored (p.285).

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const EXTRA_SEAT_CBBG_DEFINITION: DecisionDefinition = {
  procedureSlug: "extra-seat-cbbg",
  procedureTitle: "Extra Seat EXST / CBBG",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "33. Seat — Extra Seat EXST / CBBG",
  sourcePages: [160, 161, 162, 163],
  questions: QUESTION_SETS["extra-seat-cbbg"],
  rules: [
    {
      id: "interline-not-permitted",
      conditions: [{ questionId: "booking_channel", equals: "Interline or codeshare" }],
      outcome: "Not permitted",
      explanation:
        "EXST/CBBG cannot be purchased as an interline/codeshare document; the service is only available on FZ prime booked flights.",
      sourcePages: [160],
      sourceField: "not_allowed",
    },
    {
      id: "deadline-missed-goshow",
      conditions: [{ questionId: "hours_before_departure", max: 1 }],
      outcome: "Can proceed with conditions",
      explanation:
        "The pre-booking deadline is missed: requests must be made at least 2 hours before departure. Additional seats may still be booked at the airport at go-show fares — DXB T2 departures only, handled in the airport only, subject to capacity restrictions and approval.",
      sourcePages: [161],
      sourceField: "cut_off_time / escalation_points",
    },
    {
      id: "already-checked-in",
      conditions: [{ questionId: "checkin_status", equals: "Checked in" }],
      outcome: "Not permitted",
      explanation:
        "An extra seat cannot be added after check-in through the Contact Centre: extra-seat requests are excluded from online check-in eligibility and offload requests to add SSRs are not honored (Ways to Check-in, ch.55).",
      nextAction: "Refer the passenger to the airport team for any airport-handled options.",
      sourcePages: [283, 285],
      sourceField: "not_allowed (ch.55)",
    },
    {
      id: "cbbg-business-block",
      conditions: [
        { questionId: "seat_request", equals: "CBBG (cabin baggage seat)" },
        { questionId: "cabin_class", equals: "Business" },
      ],
      outcome: "Not permitted",
      explanation: "Booking an extra seat for cabin baggage (CBBG) is not available for Business Class passengers.",
      sourcePages: [160],
      sourceField: "not_allowed",
    },
    {
      id: "exst-quantity-limit",
      conditions: [
        { questionId: "seat_request", equals: "EXST (comfort)" },
        { questionId: "seat_count", min: 3 },
      ],
      outcome: "Not permitted",
      explanation: "Passengers are permitted to purchase a maximum of two extra seats (EXST) per passenger.",
      sourcePages: [161],
      sourceField: "allowed",
    },
    {
      id: "cbbg-quantity-limit",
      conditions: [
        { questionId: "seat_request", equals: "CBBG (cabin baggage seat)" },
        { questionId: "seat_count", min: 2 },
      ],
      outcome: "Not permitted",
      explanation: "Only one CBBG seat is allowed for each passenger.",
      sourcePages: [161],
      sourceField: "allowed",
    },
    {
      id: "cbbg-over-75kg",
      conditions: [
        { questionId: "seat_request", equals: "CBBG (cabin baggage seat)" },
        { questionId: "item_weight_kg", min: 76 },
      ],
      outcome: "Not permitted",
      explanation: "The maximum weight of the baggage on the blocked seat must not exceed 75 kg.",
      sourcePages: [161],
      sourceField: "not_allowed",
    },
    {
      id: "cbbg-cannot-secure",
      conditions: [
        { questionId: "seat_request", equals: "CBBG (cabin baggage seat)" },
        { questionId: "can_secure", equals: false },
      ],
      outcome: "Not permitted",
      explanation:
        "Baggage on the seat must be of a size and shape that can be secured with the seat belt or extension belt and within the headrest height (max 55×45×40 cm; musical instruments up to 140 cm). An article too large to be properly secured may not be accepted.",
      sourcePages: [161],
      sourceField: "not_allowed",
    },
    {
      id: "exst-emergency-exit-block",
      conditions: [
        { questionId: "seat_request", equals: "EXST (comfort)" },
        { questionId: "seat_rows", equals: "Emergency exit / restricted rows (14-17)" },
      ],
      outcome: "Not permitted",
      explanation: "EXST must not be allocated in emergency exit rows 15 or 16.",
      nextAction: "Assign standard adjoining rows instead (window and middle).",
      sourcePages: [160],
      sourceField: "not_allowed",
    },
    {
      id: "cbbg-restricted-rows-block",
      conditions: [
        { questionId: "seat_request", equals: "CBBG (cabin baggage seat)" },
        { questionId: "seat_rows", equals: "Emergency exit / restricted rows (14-17)" },
      ],
      outcome: "Not permitted",
      explanation: "CBBG must not be allocated in rows 14, 15, 16 or 17.",
      nextAction: "Assign standard adjoining rows instead (window and middle).",
      sourcePages: [160],
      sourceField: "not_allowed",
    },
    {
      id: "meda-approval",
      conditions: [{ questionId: "meda_case", equals: true }],
      outcome: "Requires document",
      explanation: "Medical approval will be required for MEDA (medical) cases before the extra seat can be confirmed.",
      sourcePages: [161],
      sourceField: "required_information",
    },
    {
      id: "gds-separate-pnr",
      conditions: [{ questionId: "booking_channel", equals: "GDS" }],
      outcome: "Can proceed with conditions",
      explanation:
        "GDS handling required: the extra seat cannot be added directly to a GDS booking. Create a separate PNR for the extra seat on an available fare, add the zero-value EXST/CBBG SSR to the passenger requesting the seat (in the GDS booking), keep seat assignments together, and update remarks in both bookings.",
      nextAction: "FS/SUP may contact the GDS support team for assistance, if required.",
      sourcePages: [160, 162, 163],
      sourceField: "system_steps",
    },
    {
      id: "exst-proceed",
      conditions: [{ questionId: "seat_request", equals: "EXST (comfort)" }],
      outcome: "Can proceed",
      explanation:
        "EXST can proceed: add an adult passenger named 'EXST <passenger last name>', add the zero-value SSR EXST to the requesting passenger, and manually pre-assign adjoining seats (window and middle) for both — both seats chargeable as per standard rates and booked in the same fare option/brand.",
      nextAction:
        "If window seats are not available, refer to the supervisor in charge. Seats must be manually assigned to any modified segment. Standard penalty charges on modification apply to both seats.",
      sourcePages: [160, 161, 162],
      sourceField: "system_steps",
    },
    {
      id: "cbbg-proceed",
      conditions: [{ questionId: "seat_request", equals: "CBBG (cabin baggage seat)" }],
      outcome: "Can proceed",
      explanation:
        "CBBG can proceed: add an adult passenger named 'CBBG <passenger last name>', add the zero-value SSR CBBG to the requesting passenger, and manually pre-assign adjoining seats (window and middle) for both — both seats chargeable as per standard rates.",
      nextAction:
        "Comment the booking with the type of cabin baggage. Passengers with CBBG are not eligible for extra checked-in baggage allowance; hand luggage entitlement is per passenger, not per seat.",
      sourcePages: [160, 161, 162],
      sourceField: "system_steps",
    },
  ],
  notes: [
    "Hand luggage entitlement is per passenger, not per seat: 1 x 7 kg in Economy, 2 x 7 kg in Business.",
    "For comfort EXST, checked baggage allowance applies for the passenger and the extra seat as per the booked fare.",
    "When EXST/CBBG is no-show and the linked passenger is boarded, cancellation or modification is not permitted — approach the floor in charge for guidance.",
    "Musical instruments taller than 55 cm and up to 140 cm may travel in the cabin on a purchased seat if they can be secured (max 140×45×40 cm, 75 kg).",
    "May also need: Check-in / OLCI — extra-seat bookings are not eligible for online check-in.",
  ],
};
