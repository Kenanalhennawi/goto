// Business Lounge - DXB T2 decision tree (Phase J-D Batch 3).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 64 "Business Lounge - DXB T2", page 314. Verified:
//   - Economy passengers may purchase T2 FZ lounge access (SSR LNGS 4h, LNGL
//     8h). Passengers travelling on FZ flights are eligible, including codeshare
//     and interline passengers travelling on FZ. Handled at the airport only.
//   - Payment is credit/debit card only via EZEtap; cash, miles, or other forms
//     of payment are not accepted.
//   - Adult and child (2-12) are charged; an infant with a paying adult is free.
//     Access is one-time and capacity-limited; lounge purchasers do not board
//     from the Business Class boarding gate (p.314).

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const BUSINESS_LOUNGE_DEFINITION: DecisionDefinition = {
  procedureSlug: "business-lounge",
  procedureTitle: "Business Lounge – DXB T2",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "64. Business Lounge – DXB T2",
  sourcePages: [314],
  questions: QUESTION_SETS["business-lounge"],
  rules: [
    {
      id: "bl-not-fz",
      conditions: [{ questionId: "fz_operated", equals: false }],
      outcome: "Not permitted",
      explanation:
        "Business Lounge access under this procedure is limited to eligible FZ-operated flights.",
      nextAction: "Do not sell access under this workflow.",
      sourcePages: [314],
      sourceField: "Business Lounge flight eligibility",
    },
    {
      id: "bl-cash",
      conditions: [
        { questionId: "fz_operated", equals: true },
        { questionId: "payment_method", equals: "Cash" },
      ],
      outcome: "Not permitted",
      explanation: "Cash is not accepted for this airport lounge purchase.",
      nextAction: "Use an accepted card payment method only.",
      sourcePages: [314],
      sourceField: "Business Lounge payment restrictions",
    },
    {
      id: "bl-miles",
      conditions: [
        { questionId: "fz_operated", equals: true },
        { questionId: "payment_method", equals: "Miles" },
      ],
      outcome: "Not permitted",
      explanation: "Miles are not accepted for this airport lounge purchase.",
      nextAction: "Use an accepted card payment method only.",
      sourcePages: [314],
      sourceField: "Business Lounge payment restrictions",
    },
    {
      id: "bl-other-pay",
      conditions: [
        { questionId: "fz_operated", equals: true },
        { questionId: "payment_method", equals: "Other" },
      ],
      outcome: "Not permitted",
      explanation: "Only the documented card payment method is accepted.",
      nextAction: "Use an accepted credit or debit card.",
      sourcePages: [314],
      sourceField: "Business Lounge payment restrictions",
    },
    {
      id: "bl-eligible",
      conditions: [
        { questionId: "fz_operated", equals: true },
        { questionId: "payment_method", equals: "Credit or debit card" },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "Eligible passengers may purchase DXB T2 Business Lounge access at the airport using card payment.",
      nextAction:
        "Use EZEtap card payment at the airport. Apply the documented LNGS 4-hour or LNGL 8-hour option. Adult and child passengers are charged; an infant is free with a paying adult. Access is one-time and subject to capacity. Lounge purchasers do not board through the Business Class gate.",
      sourcePages: [314],
      sourceField: "Business Lounge purchase and use conditions",
    },
  ],
  notes: [
    "Business Lounge access at DXB T2 is purchased at the airport only, on eligible FZ-operated flights.",
    "Payment is credit/debit card only via EZEtap; cash, miles, and other forms of payment are not accepted.",
    "Adult and child (2-12) are charged; an infant is free with a paying adult; lounge purchasers do not board from the Business Class gate.",
  ],
};
