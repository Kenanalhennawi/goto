// Flight Disruption decision tree (Phase D). High-risk: intentionally kept
// to a practical set of branches; it does not encode the whole FDIS chapter.
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 71 "Flight Disruption", pages 329-340. Rules verified verbatim:
//   - Do not offer anything free of charge if there is no pop-up and the
//     options have not been validated (p.331).
//   - Pop-up available: modify/cancel using the pop-up options per the
//     SUP/FS/Outbound email (p.331). "Flight not cancelled Changes" pop-up:
//     strictly refer to FS/SUP in charge (p.331).
//   - Self-service: direct-channel and TA bookings (not GDS/G fares, not
//     travel shop) can re-accommodate via manage booking while the flight is
//     active and not online checked-in; default +/- 10 days (p.333).
//   - Zonal refunds: GREEN refund to original FOP or voucher; RED/AMBER
//     voucher only (INVC/Miles/TKNE/WBSP back to FOP); Amber/Red FOP
//     insistence -> consult on-floor supervisor (pp.334-335).
//   - TA refunds: FOP/invoice -> ticket issuer; voucher via "voucher flyer"
//     system option (p.335).
//   - Interline/codeshare (TA/OAL system), FZ leg disrupted: within 72h
//     Contact Centre honors rebooking (complimentary one-time, escalate to
//     supervisor); refunds -> ticket issuer. Outside 72h: ticket issuer for
//     both (pp.338-340). Always check OAL availability with Sup/FS before
//     committing (pp.338-339).

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

const GDS_CHANNEL = "GDS / interline / codeshare (TA or OAL system)";

export const FLIGHT_DISRUPTION_DEFINITION: DecisionDefinition = {
  procedureSlug: "flight-disruption",
  procedureTitle: "Flight Disruption",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "71. Flight Disruption",
  sourcePages: [329, 330, 331, 333, 334, 335, 338, 339, 340],
  questions: QUESTION_SETS["flight-disruption"],
  rules: [
    {
      id: "popup-available",
      conditions: [{ questionId: "fdis_popup", equals: "Disruption pop-up available" }],
      outcome: "Can proceed with conditions",
      explanation:
        "Follow the FDIS pop-up: modify or cancel the booking using the options available in the pop-up, based on the email received from SUP/FS/Outbound.",
      nextAction:
        "Before using the pop-up, check services in the booking: if non-refundable SSRs such as name-change SSRs (NCFE/NCFA/NCFB) are present, seek Sup/FS assistance first.",
      sourcePages: [331, 335],
      sourceField: "system_steps",
    },
    {
      id: "popup-flight-not-cancelled",
      conditions: [{ questionId: "fdis_popup", equals: "'Flight not cancelled Changes' pop-up" }],
      outcome: "Requires supervisor",
      explanation:
        "A 'Flight not cancelled Changes' pop-up requires strict referral to FS/SUP in charge for clear instructions before any action.",
      sourcePages: [331],
      sourceField: "escalation_points",
    },
    {
      id: "interline-rebooking-within-72h",
      conditions: [
        { questionId: "fdis_popup", equals: "No pop-up" },
        { questionId: "booking_channel", equals: GDS_CHANNEL },
        { questionId: "request", equals: "Rebooking" },
        { questionId: "hours_to_departure", max: 72 },
      ],
      outcome: "Requires supervisor",
      explanation:
        "FZ leg disrupted on an interline/codeshare TA/OAL-system booking within 72 hours of departure: Contact Centre honors rebooking requests regardless of booking channel. Rebooking is complimentary one-time only.",
      nextAction:
        "Capture the request, escalate the Salesforce case to Supervisor, and always refer to Sup/FS in charge to check availability on the OAL leg before committing anything to the caller.",
      sourcePages: [338, 339, 340],
      sourceField: "system_steps / escalation_points",
    },
    {
      id: "interline-rebooking-outside-72h",
      conditions: [
        { questionId: "fdis_popup", equals: "No pop-up" },
        { questionId: "booking_channel", equals: GDS_CHANNEL },
        { questionId: "request", equals: "Rebooking" },
        { questionId: "hours_to_departure", min: 73 },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "Outside 72 hours of departure the ticket issuer must handle rebooking for interline/codeshare TA/OAL-system bookings.",
      nextAction:
        "Refer the passenger to the ticket issuer. If the passenger cannot reach the issuer, escalate to Supervisor to check options with Reservations Support.",
      sourcePages: [339, 340],
      sourceField: "not_allowed / escalation_points",
    },
    {
      id: "interline-refund-ticket-issuer",
      conditions: [
        { questionId: "fdis_popup", equals: "No pop-up" },
        { questionId: "booking_channel", equals: GDS_CHANNEL },
        { questionId: "request", equals: "Refund or voucher" },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "For interline/codeshare TA/OAL-system bookings, refund requests are handled by the ticket issuer — inside or outside the 72-hour window.",
      nextAction: "Refer the caller to the ticket issuer for the refund.",
      sourcePages: [338, 339, 340],
      sourceField: "not_allowed",
    },
    {
      id: "direct-self-service",
      conditions: [
        { questionId: "fdis_popup", equals: "No pop-up" },
        { questionId: "booking_channel", equals: "Direct flydubai channel" },
        { questionId: "request", equals: "Rebooking" },
        { questionId: "olci_done", equals: false },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "Self-service re-accommodation is available: while the flight status is active and not online checked-in, the passenger can re-accommodate free of charge according to policy (default +/- 10 days from the affected flight), accept the re-accommodated flight, choose new flights, or request a refund per policy through manage booking.",
      nextAction:
        "Do not offer anything free of charge beyond the validated options; refer to the SUP/FS/Outbound email for the available options.",
      sourcePages: [331, 333],
      sourceField: "allowed / system_steps",
    },
    {
      id: "ta-portal-self-service",
      conditions: [
        { questionId: "fdis_popup", equals: "No pop-up" },
        { questionId: "booking_channel", equals: "TA portal" },
        { questionId: "request", equals: "Rebooking" },
        { questionId: "olci_done", equals: false },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "TA bookings (not GDS/G fares) can re-accommodate via the flydubai website, contact centre, or travel shops during disruption, while the flight status is active and not online checked-in.",
      nextAction:
        "Do not offer anything free of charge beyond the validated options; refer to the SUP/FS/Outbound email for the available options.",
      sourcePages: [331, 333],
      sourceField: "allowed",
    },
    {
      id: "rebooking-after-olci-validate",
      conditions: [
        { questionId: "fdis_popup", equals: "No pop-up" },
        { questionId: "booking_channel", equals: "Direct flydubai channel" },
        { questionId: "request", equals: "Rebooking" },
        { questionId: "olci_done", equals: true },
      ],
      outcome: "Requires supervisor",
      explanation:
        "Self-service is not available once online check-in is completed. With no pop-up, refer to the email received from SUP/FS/Outbound for the available options; a free-of-charge action is not validated without it.",
      nextAction:
        "If free-of-cost modification/cancellation is an available option in the validated guidance, escalate the case to SUP/FS for action.",
      sourcePages: [331, 333],
      sourceField: "system_steps / escalation_points",
    },
    {
      id: "travel-shop-rebooking-validate",
      conditions: [
        { questionId: "fdis_popup", equals: "No pop-up" },
        { questionId: "booking_channel", equals: "Travel shop" },
        { questionId: "request", equals: "Rebooking" },
      ],
      outcome: "Requires supervisor",
      explanation:
        "Travel shop bookings do not have the online manage-booking option. With no pop-up, follow the options in the SUP/FS/Outbound email; do not offer anything free of charge without validated guidance.",
      sourcePages: [331, 333],
      sourceField: "not_allowed / system_steps",
    },
    {
      id: "ta-refund-paths",
      conditions: [
        { questionId: "fdis_popup", equals: "No pop-up" },
        { questionId: "booking_channel", equals: "TA portal" },
        { questionId: "request", equals: "Refund or voucher" },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "TA booking (not GDS/G fare) refund: for a refund to the original form of payment (payment is invoice), refer the customer to the ticket issuer regardless of origin. For a voucher refund, change the 'system default' option to 'voucher flyer'.",
      sourcePages: [335],
      sourceField: "system_steps",
    },
    {
      id: "refund-green-zone",
      conditions: [
        { questionId: "fdis_popup", equals: "No pop-up" },
        { questionId: "booking_channel", equals: "Direct flydubai channel" },
        { questionId: "request", equals: "Refund or voucher" },
        { questionId: "refund_zone", equals: "Green" },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "Green zone: refund to the original form of payment or voucher. Use the IRROPS flow with the system default option; INVC/Miles/TKNE/WBSP go back to FOP.",
      nextAction: "Double-check the payment details tab before saving changes.",
      sourcePages: [334, 335],
      sourceField: "fees_charges / system_steps",
    },
    {
      id: "refund-red-amber-zone",
      conditions: [
        { questionId: "fdis_popup", equals: "No pop-up" },
        { questionId: "booking_channel", equals: "Direct flydubai channel" },
        { questionId: "request", equals: "Refund or voucher" },
        { questionId: "refund_zone", equals: "Red or Amber" },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "Red/Amber zone: regardless of the method of payment, the customer receives a voucher refund through the Contact Centre (except INVC/Miles/TKNE/WBSP, which go back to FOP). No refund to the original FOP is guaranteed.",
      nextAction:
        "If the passenger insists on a refund to the original form of payment, consult the on-floor supervisor; subject to approval, inform the passenger accordingly.",
      sourcePages: [334, 335],
      sourceField: "not_allowed / escalation_points",
    },
    {
      id: "refund-zone-unknown",
      conditions: [
        { questionId: "fdis_popup", equals: "No pop-up" },
        { questionId: "request", equals: "Refund or voucher" },
        { questionId: "refund_zone", equals: "Not shown / unknown" },
      ],
      outcome: "Insufficient information",
      explanation:
        "The refund zone is not confirmed in SPRINT, so the verified zonal refund logic cannot be applied.",
      nextAction: "Verify the zone message on the booking in SPRINT before actioning any refund.",
      sourcePages: [334, 335],
      sourceField: "system_steps",
    },
  ],
  notes: [
    "No guaranteed refund and no guaranteed free rebooking: only pop-up options or validated SUP/FS/Outbound guidance may be offered.",
    "flydubai is not responsible if a passenger misses a connection when booked on two separate flydubai tickets, even if the first flight is delayed; fare rules apply for rebooking and cancellation.",
    "Refund processing time script: bank timelines vary; the passenger should review their subsequent credit card statement.",
    "Always refer to Sup/FS in charge to check OAL-leg availability before committing anything to the caller. If the OAL leg is disrupted, refer the passenger to the ticket issuer.",
  ],
};
