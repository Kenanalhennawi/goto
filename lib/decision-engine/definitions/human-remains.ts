// Human Remains guided-escalation workflow (Phase J-D Batch 4).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 32 "Cargo" - "Deceased Persons and Human Remains", pages 140-143.
//
// Classification: this is a GUIDED ESCALATION workflow. Human remains transport
// is handled by Cargo / dnata and acceptance is subject to destination approval;
// the Contact Centre informs the customer of the required documents and refers
// them to Cargo. Conservative outcomes only (Requires document / Requires
// supervisor / Insufficient information), plus the documented "ashes in cabin"
// allowance. It never confirms acceptance, cost, or destination clearance.

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const HUMAN_REMAINS_DEFINITION: DecisionDefinition = {
  procedureSlug: "human-remains",
  procedureTitle: "Human Remains",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "32. Cargo – Deceased Persons and Human Remains",
  sourcePages: [140, 141, 142, 143],
  questions: QUESTION_SETS["human-remains"],
  rules: [
    {
      id: "hr-transport-not-accompanying",
      conditions: [
        { questionId: "request", equals: "Transport human remains (as cargo)" },
        { questionId: "accompanying", equals: "No passenger accompanying" },
      ],
      outcome: "Requires document",
      explanation:
        "Human remains transport is handled by Cargo/dnata and is subject to destination approval; when no passenger accompanies, destination clearance confirmation is also required.",
      nextAction:
        "Advise the documents (cancelled passport copy, death certificate, police clearance, embassy/consulate certificate, embalming certificate — 7 copies in English, and Arabic for Islamic countries), plus destination clearance confirmation. Refer the customer to the flydubai Cargo office / dnata Cargo Export; do not confirm acceptance or cost.",
      sourcePages: [142, 143],
      sourceField: "Human remains documents – not accompanying",
    },
    {
      id: "hr-transport-accompanying",
      conditions: [
        { questionId: "request", equals: "Transport human remains (as cargo)" },
        { questionId: "accompanying", equals: "A passenger will accompany the remains" },
      ],
      outcome: "Requires document",
      explanation:
        "Human remains transport is handled by Cargo/dnata and is subject to destination approval; the documented certificates and ticket copies are required.",
      nextAction:
        "Advise the documents (cancelled passport copy, death certificate, police clearance, embassy/consulate certificate, embalming certificate, and two ticket copies — 7 copies in English, and Arabic for Islamic countries) and to reach the airport 6 hours prior. Refer the customer to the flydubai Cargo office / dnata Cargo Export; do not confirm acceptance or cost.",
      sourcePages: [142, 143],
      sourceField: "Human remains documents – accompanying",
    },
    {
      id: "hr-ashes",
      conditions: [{ questionId: "request", equals: "Carry ashes of the deceased in the cabin" }],
      outcome: "Can proceed with conditions",
      explanation:
        "Ashes of a deceased person may be carried in the cabin under the documented conditions.",
      nextAction:
        "The ashes must be in a sealed urn that fits under the seat or in the overhead bin (not on a seat or in direct view). A copy of the death certificate or a crematorium letter must be available for security.",
      sourcePages: [142],
      sourceField: "Ashes in cabin conditions",
    },
  ],
  notes: [
    "Human remains transport is handled by Cargo / dnata and is subject to destination approval; the Contact Centre informs the customer and refers them to Cargo.",
    "Required documents (7 copies, English and Arabic for Islamic countries): cancelled passport copy, death certificate, police clearance, embassy/consulate certificate, embalming certificate.",
    "Ashes may be carried in the cabin in a sealed urn with a death certificate or crematorium letter for security.",
  ],
};
