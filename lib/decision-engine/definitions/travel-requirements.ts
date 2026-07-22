// Travel Requirements (UAE residency) decision tree (Phase J-D Batch 2).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 49 "Travel Requirements to travel from UAE", page 272. Verified:
//   - UAE authorities no longer issue resident-visa stickers; the Emirates ID
//     is accepted as proof of UAE residency. The ORIGINAL Emirates ID must be
//     with the passenger when departing Dubai so it can be used as proof of
//     UAE residency on return (p.272).
//   - Travel requirements change without prior notice; the passenger must check
//     with the relevant authorities before travel (p.272).
// This tree is deliberately narrow. It never confirms admissibility to any
// country and defers every non-UAE-residency requirement to the authorities.

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const TRAVEL_REQUIREMENTS_DEFINITION: DecisionDefinition = {
  procedureSlug: "travel-requirements",
  procedureTitle: "Travel Requirements (UAE Residency)",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "49. Travel Requirements to travel from UAE",
  sourcePages: [272],
  questions: QUESTION_SETS["travel-requirements"],
  rules: [
    {
      id: "tr-other-requirement",
      conditions: [{ questionId: "scenario", equals: "Other entry or exit requirement" }],
      outcome: "Insufficient information",
      explanation:
        "Entry and exit requirements depend on nationality, destination and current authority rules that are not modeled here and can change without notice.",
      nextAction:
        "Advise the passenger to check with the relevant authorities for the latest entry and exit requirements before travel. Do not confirm admissibility.",
      sourcePages: [272],
      sourceField: "Travel requirements disclaimer",
    },
    {
      id: "tr-uae-resident-no-eid",
      conditions: [
        { questionId: "scenario", equals: "UAE resident departing Dubai and returning to the UAE" },
        { questionId: "eid_present", equals: false },
      ],
      outcome: "Requires document",
      explanation:
        "The original Emirates ID is the accepted proof of UAE residency for the return journey; a resident-visa sticker is no longer issued.",
      nextAction:
        "Advise the passenger to carry the original Emirates ID when departing Dubai. Without it they may be unable to prove UAE residency on return.",
      sourcePages: [272],
      sourceField: "Emirates ID as proof of UAE residency",
    },
    {
      id: "tr-uae-resident-eid",
      conditions: [
        { questionId: "scenario", equals: "UAE resident departing Dubai and returning to the UAE" },
        { questionId: "eid_present", equals: true },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "The original Emirates ID is accepted as proof of UAE residency for this return-travel scenario.",
      nextAction:
        "Confirm the passenger carries the original Emirates ID, and advise them to verify the latest entry and exit requirements with the relevant authorities before travel.",
      sourcePages: [272],
      sourceField: "Emirates ID as proof of UAE residency",
    },
  ],
  notes: [
    "Travel requirements are subject to change without prior notice; the passenger must confirm the latest entry/exit requirements with the relevant authorities.",
    "This workflow covers only the documented UAE-residency return-travel scenario. It never confirms admissibility to any destination.",
  ],
};
