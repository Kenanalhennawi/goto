// Duplicate Booking decision tree (Phase J-D Batch 1).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 47 "Duplicate booking", pages 268-270. Verified rules:
//   - A duplicate is an identical/semi-identical booking; details must match
//     exactly before it is treated as a duplicate (p.268).
//   - Contact Centre assists a refund only for fully active duplicates, and
//     every resolvable case is approval-gated (TL / CS / letstalk) - there is
//     no self-service "Can proceed" outcome.
//   - Exact duplicate, same fare: cancel the first, retain the latest (p.269-270).
//   - Exact duplicate, different fare: cancel the lower fare, keep the higher (p.269-270).
//   - No-show / used segment: direct to the CS team for an exception (p.269).
//   - One sector matches only: email letstalk, subject to approval (p.269).
//   - Non-refundable charges are not refunded on cancellation (pp.268, 270).

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const DUPLICATE_BOOKING_DEFINITION: DecisionDefinition = {
  procedureSlug: "duplicate-booking",
  procedureTitle: "Duplicate Booking",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "47. Duplicate booking",
  sourcePages: [268, 269, 270],
  questions: QUESTION_SETS["duplicate-booking"],
  rules: [
    {
      id: "dup-not-clear",
      conditions: [{ questionId: "match_level", equals: "Not clearly a duplicate" }],
      outcome: "Insufficient information",
      explanation:
        "The bookings must match the documented duplicate-booking criteria before the case can be handled as a duplicate.",
      nextAction:
        "Verify passenger/journey details, sector, cabin, issue date, booking channel, travel date, flight, fare and booking status.",
      sourcePages: [268],
      sourceField: "Duplicate-booking definition and exclusions",
    },
    {
      id: "dup-not-active",
      conditions: [{ questionId: "both_active", equals: false }],
      outcome: "Requires supervisor",
      explanation:
        "A booking containing a no-show, used, or inactive segment requires exception review.",
      nextAction: "Refer the case to the Customer Service / Supervisor process, subject to approval.",
      sourcePages: [269],
      sourceField: "Escalation and inactive-booking handling",
    },
    {
      id: "dup-partial",
      conditions: [{ questionId: "match_level", equals: "Only one sector matches" }],
      outcome: "Requires supervisor",
      explanation:
        "Partial duplicate itineraries require approval and customer confirmation of which booking should be cancelled.",
      nextAction:
        "Advise the customer to use Let's Talk and identify which booking they want cancelled, subject to approval.",
      sourcePages: [269],
      sourceField: "Partial duplicate handling",
    },
    {
      id: "dup-other-channel",
      conditions: [{ questionId: "other_channel", equals: true }],
      outcome: "Requires supervisor",
      explanation:
        "Duplicate bookings involving a travel agent or GDS require cross-channel handling and approval.",
      nextAction: "Escalate; the original issuing/booking agent may need to handle the affected booking.",
      sourcePages: [269],
      sourceField: "Travel agency / GDS duplicate handling",
    },
    {
      id: "dup-exact-same-fare",
      conditions: [
        { questionId: "match_level", equals: "Identical in every detail" },
        { questionId: "both_active", equals: true },
        { questionId: "fare_same", equals: true },
        { questionId: "other_channel", equals: false },
      ],
      outcome: "Requires supervisor",
      explanation:
        "For an exact duplicate with the same fare, the first booking is cancelled and the latest booking is retained, subject to approval.",
      nextAction: "Escalate to Team Leader / Supervisor for approval and cancellation handling.",
      sourcePages: [269, 270],
      sourceField: "Exact duplicate — same fare handling",
    },
    {
      id: "dup-exact-diff-fare",
      conditions: [
        { questionId: "match_level", equals: "Identical in every detail" },
        { questionId: "both_active", equals: true },
        { questionId: "fare_same", equals: false },
        { questionId: "other_channel", equals: false },
      ],
      outcome: "Requires supervisor",
      explanation:
        "For an exact duplicate with different fares, the lower-fare booking is cancelled and the higher-fare booking is retained, subject to approval.",
      nextAction: "Escalate to Team Leader / Supervisor and advise the customer before cancellation.",
      sourcePages: [269, 270],
      sourceField: "Exact duplicate — different fare handling",
    },
  ],
  notes: [
    "Non-refundable charges are not refunded during a duplicate-booking cancellation.",
    "Contact Centre assists a refund only for fully active duplicate bookings, and every case is subject to approval.",
    "When escalating, capture why the additional booking was created and any flydubai system error for the Salesforce case.",
  ],
};
