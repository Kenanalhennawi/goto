// Blue Ribbon Bags (BRB) decision tree (Phase J-D Batch 3).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 26 "Baggage" - "Blue Ribbon Bags (BRB)", page 119. Verified:
//   - Baggage Protection Service in partnership with BRB, for passengers on
//     flydubai-operated flights. AED 10 for up to two bags per passenger per
//     leg (SSR IBAG), added at check-in / T2 self-service kiosk. Extra bags
//     require separate purchases.
//   - Applies for onward connections only if all sectors are operated by
//     flydubai; it does not apply to OAL sectors (codeshare/interline).
//   - Claim: the passenger files a PIR with flydubai and submits a claim to BRB
//     within 24 hours of arrival; if the bag is unlocated after 96 hours, BRB
//     pays AED 2,000 per bag. Compensation is paid by BRB under its own
//     conditions. For any clarification, consult the shift-in-charge (p.119).
// This tree never implies flydubai directly guarantees compensation.

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const BLUE_RIBBON_BAGS_DEFINITION: DecisionDefinition = {
  procedureSlug: "blue-ribbon-bags",
  procedureTitle: "Blue Ribbon Bags",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "26. Baggage — Blue Ribbon Bags",
  sourcePages: [119],
  questions: QUESTION_SETS["blue-ribbon-bags"],
  rules: [
    {
      id: "brb-oal",
      conditions: [{ questionId: "all_sectors_fz", equals: false }],
      outcome: "Not permitted",
      explanation:
        "Blue Ribbon Bags protection under this procedure applies only when all journey sectors are operated by flydubai.",
      nextAction: "Do not sell BRB protection for an itinerary containing another operating carrier.",
      sourcePages: [119],
      sourceField: "BRB journey eligibility",
    },
    {
      id: "brb-claim",
      conditions: [
        { questionId: "all_sectors_fz", equals: true },
        { questionId: "request", equals: "Claim or compensation follow-up" },
      ],
      outcome: "Requires supervisor",
      explanation:
        "A BRB claim or compensation follow-up requires the documented claim handling and shift-in-charge support.",
      nextAction:
        "Confirm a PIR exists, advise the passenger to submit the claim to BRB within 24 hours of arrival, and consult the shift-in-charge for follow-up.",
      sourcePages: [119],
      sourceField: "BRB claim and compensation process",
    },
    {
      id: "brb-eligible",
      conditions: [
        { questionId: "all_sectors_fz", equals: true },
        { questionId: "request", equals: "Purchase BRB protection" },
      ],
      outcome: "Can proceed with conditions",
      explanation: "BRB protection may be purchased for eligible flydubai-only journeys.",
      nextAction:
        "Apply AED 10 for up to two bags per passenger per leg using SSR IBAG at check-in or the T2 self-service kiosk. Additional bags require separate purchases. Advise that the BRB claim must be filed within 24 hours with a PIR; compensation applies only under the documented BRB conditions if the bag remains unlocated after 96 hours.",
      sourcePages: [119],
      sourceField: "BRB purchase and coverage conditions",
    },
  ],
  notes: [
    "BRB protection applies only when all journey sectors are operated by flydubai; it does not apply to OAL (codeshare/interline) sectors.",
    "AED 10 covers up to two bags per passenger per leg (SSR IBAG); additional bags require separate purchases.",
    "Compensation is paid by Blue Ribbon Bags under its own conditions; flydubai does not directly guarantee compensation.",
  ],
};
