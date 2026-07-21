// Name Change / Correction decision tree (Phase H).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 52 "Name Change / Correction", pages 276-279. Verified rules:
//   - Not permitted within 6 hours of departure (p.276).
//   - Only on a fully active PNR; not after no-show / utilized sector (p.277).
//   - Title / space / up to 3 characters = free; name swap = USD30/AED110;
//     more than 3 characters / full name / add-delete / maiden->married =
//     USD100/AED367 (pp.276-277).
//   - Not for GDS / codeshare / TA block-fare bookings (p.276). Interline is a
//     supervisor exception: only FZ-direct-channel, fully-active bookings, and
//     system-issue cases (p.278).
//   - Not done if checked in / OLCI completed - handled at the airport, never
//     offloaded; airport-desk RES Support applies USD100 even for one character
//     (p.276).
//   - Always refer to Floor Support / Supervisor to confirm charges (p.276).

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const NAME_CORRECTION_DEFINITION: DecisionDefinition = {
  procedureSlug: "name-correction",
  procedureTitle: "Name Change / Correction",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "52. Name Change / Correction",
  sourcePages: [276, 277, 278, 279],
  questions: QUESTION_SETS["name-correction"],
  rules: [
    {
      id: "nc-within-6h",
      conditions: [{ questionId: "hours_before_departure", max: 5 }],
      outcome: "Not permitted",
      explanation: "Name correction is not permitted within 6 hours of flight departure.",
      sourcePages: [276],
      sourceField: "cut_off_time",
    },
    {
      id: "nc-no-show",
      conditions: [{ questionId: "no_show", equals: true }],
      outcome: "Not permitted",
      explanation:
        "Name correction is only done on a fully active PNR; it cannot be done after a no-show or a utilized sector.",
      nextAction:
        "The passenger may cancel under standard fare rules and follow voucher name-change policy instead.",
      sourcePages: [276, 277],
      sourceField: "not_allowed",
    },
    {
      id: "nc-airport-checkin",
      conditions: [{ questionId: "checkin_state", equals: "Airport checked in" }],
      outcome: "Requires supervisor",
      explanation:
        "For a passenger already checked in at the airport, the check-in desk handles the correction via RES Support, applying USD 100 even for a single character, title or space (name as per passport).",
      nextAction: "Direct the airport check-in desk to RES Support; USD 100 applies.",
      sourcePages: [276],
      sourceField: "escalation_points",
    },
    {
      id: "nc-olci-checkin",
      conditions: [{ questionId: "checkin_state", equals: "Online checked in" }],
      outcome: "Not permitted",
      explanation:
        "An online checked-in passenger must not be offloaded for a name or title correction; it is handled at the airport with applicable charges.",
      nextAction: "Advise the passenger to have the correction done at the airport.",
      sourcePages: [276],
      sourceField: "not_allowed",
    },
    {
      id: "nc-gds",
      conditions: [{ questionId: "booking_channel", equals: "GDS" }],
      outcome: "Not permitted",
      explanation: "Name corrections are not done for GDS bookings.",
      nextAction: "Refer the passenger to their booking agent.",
      sourcePages: [276],
      sourceField: "not_allowed",
    },
    {
      id: "nc-codeshare",
      conditions: [{ questionId: "booking_channel", equals: "Codeshare" }],
      outcome: "Not permitted",
      explanation: "Name corrections are not done for codeshare bookings.",
      nextAction: "Refer the passenger to their booking agent.",
      sourcePages: [276],
      sourceField: "not_allowed",
    },
    {
      id: "nc-ta-block",
      conditions: [{ questionId: "booking_channel", equals: "TA block fare" }],
      outcome: "Not permitted",
      explanation: "Name change is not permitted on TA block-fare bookings.",
      nextAction: "Refer the passenger to their travel agent.",
      sourcePages: [276],
      sourceField: "not_allowed",
    },
    {
      id: "nc-interline",
      conditions: [{ questionId: "booking_channel", equals: "Interline" }],
      outcome: "Requires supervisor",
      explanation:
        "Interline name correction is only handled on a booking created through the FZ direct channel that is fully active; system-issue cases are escalated to a supervisor.",
      nextAction: "Escalate to a supervisor to verify FZ-direct-channel and fully-active status before any change.",
      sourcePages: [276, 278],
      sourceField: "escalation_points",
    },
    {
      id: "nc-foc",
      conditions: [{ questionId: "correction_type", equals: "Title, space, or up to 3 characters" }],
      outcome: "Can proceed with conditions",
      explanation:
        "Title correction, space correction, and up to 3-character (or gender) corrections are free of charge. Title/space requests can be taken over the phone without document validation.",
      nextAction:
        "Refer to Floor Support / Supervisor to confirm; validate the passenger is not no-show; add any SSR on the outbound sector only.",
      sourcePages: [276, 277],
      sourceField: "fees_charges",
    },
    {
      id: "nc-swap",
      conditions: [{ questionId: "correction_type", equals: "Name swap (no spelling change)" }],
      outcome: "Can proceed with conditions",
      explanation:
        "A name swap that only changes name position without altering spelling is USD 30 / AED 110.",
      nextAction:
        "Refer to Floor Support / Supervisor to confirm the charge; collect the SSR on the outbound sector. If the swap also involves more than 3-character corrections, USD 100 applies.",
      sourcePages: [276, 277],
      sourceField: "fees_charges",
    },
    {
      id: "nc-major",
      conditions: [
        {
          questionId: "correction_type",
          equals: "More than 3 characters / full name / add or delete / maiden-to-married",
        },
      ],
      outcome: "Requires document",
      explanation:
        "More than 3-character corrections, complete first/middle/last name corrections, addition/deletion of names, and maiden-to-married changes are USD 100 / AED 367 and require documents.",
      nextAction:
        "Advise the passenger to write to letstalk@flydubai.com with the passport copy (and marriage/birth certificate if applicable). The request is subject to Supervisor/Floor Support approval; the fee is USD 100 / AED 367.",
      sourcePages: [276, 277],
      sourceField: "required_information",
    },
  ],
  notes: [
    "Name correction can be done only once per passenger and must be for genuine cases, never to change to a different passenger.",
    "Contact Centre agents must always refer to Floor Support / Supervisor to confirm charges and possibility.",
    "Charges do not apply to staff travel, winner/competition, rebate/discount, or corporate-discount tickets; group bookings follow group terms.",
    "SSR NCFB (2-character name-change fee) and NCFE (name-change fee) are used per the applicable charge.",
    "May also need: Voucher name-change policy when the passenger cancels a no-show/utilized booking.",
  ],
};
