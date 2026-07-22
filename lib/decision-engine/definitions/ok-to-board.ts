// OK to Board (OKTB) decision tree (Phase J-D Batch 2).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 50 "Ok to Board (OKTB)", pages 272-274. Verified:
//   - For the current OKTB policy the source directs users to the official
//     flydubai OKTB website; it does not state OKTB eligibility rules (p.272).
//   - The manual OKTB-add on EK* flights is "for Floor support & Supervisors
//     usage only": take control, Add services, Carrier EK*, Category UAE VISIT
//     VISA, select OKTB, Add, update the PNR comments, release control
//     (pp.272-274).
// This tree never decides passenger OKTB eligibility; policy questions defer to
// the official website.

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const OK_TO_BOARD_DEFINITION: DecisionDefinition = {
  procedureSlug: "ok-to-board",
  procedureTitle: "OK to Board (OKTB)",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "50. Ok to Board (OKTB)",
  sourcePages: [272, 273, 274],
  questions: QUESTION_SETS["ok-to-board"],
  rules: [
    {
      id: "oktb-policy-reference",
      conditions: [{ questionId: "request", equals: "General OKTB policy or eligibility question" }],
      outcome: "Insufficient information",
      explanation:
        "The source does not state OKTB eligibility rules; it directs users to the official flydubai OKTB website for the current policy.",
      nextAction:
        "Refer to the official flydubai OKTB website for the current policy. Do not decide passenger OKTB eligibility.",
      sourcePages: [272],
      sourceField: "OKTB official website reference",
    },
    {
      id: "oktb-ek-manual-not-fs",
      conditions: [
        { questionId: "request", equals: "Add OKTB manually on an EK* flight" },
        { questionId: "actioning_role", equals: "Contact Centre agent" },
      ],
      outcome: "Requires supervisor",
      explanation:
        "The EK* manual OKTB-add process is documented for Floor Support and Supervisors only.",
      nextAction: "Escalate to Floor Support or a Supervisor to perform the EK* manual OKTB-add.",
      sourcePages: [272],
      sourceField: "EK* manual-add restricted to Floor Support/Supervisor",
    },
    {
      id: "oktb-ek-manual-fs",
      conditions: [
        { questionId: "request", equals: "Add OKTB manually on an EK* flight" },
        { questionId: "actioning_role", equals: "Floor Support or Supervisor" },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "Floor Support and Supervisors may add OKTB on EK* flights using the documented steps.",
      nextAction:
        "Take control of the booking, open Add services, select carrier EK*, category UAE Visit Visa, then OKTB and add. Update the PNR comments with the action taken and release control.",
      sourcePages: [272, 273, 274],
      sourceField: "EK* manual OKTB-add steps",
    },
  ],
  notes: [
    "For the current OKTB policy, refer to the official flydubai OKTB website; this workflow does not decide OKTB eligibility.",
    "The EK* manual-add process is restricted in the source to Floor Support and Supervisors.",
  ],
};
