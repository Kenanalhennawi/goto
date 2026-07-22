// MEDA / Medical Travel Exception decision tree (Phase J-D Batch 4).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 43 "Medical & Death cases", pages 260-263.
//
// This tree covers the medical travel-exception workflow only (medical-clearance
// and unfit-to-travel are the same MEDA process and are handled here). It NEVER
// approves a medical exception, never confirms fitness to fly, and never offers a
// fee-free change before Customer Service validates the documents. Conservative
// outcomes only: Requires document / Requires supervisor / Not permitted /
// Insufficient information.

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const MEDA_DEFINITION: DecisionDefinition = {
  procedureSlug: "meda",
  procedureTitle: "MEDA / Medical Travel Exception",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "43. Medical & Death cases",
  sourcePages: [260, 261, 262, 263],
  questions: QUESTION_SETS["meda"],
  rules: [
    {
      id: "meda-ta-block",
      conditions: [{ questionId: "ta_block_fare", equals: true }],
      outcome: "Not permitted",
      explanation:
        "TA block-fare bookings are not eligible for a medical exception (only death cases are, subject to approval).",
      nextAction: "Refer the passenger to the issuing travel agent; a TA should contact the Agency Support Team.",
      sourcePages: [260, 261],
      sourceField: "TA block-fare medical-exception exclusion",
    },
    {
      id: "meda-no-cert",
      conditions: [{ questionId: "has_medical_cert", equals: false }],
      outcome: "Requires document",
      explanation:
        "A medical exception needs a medical certificate stating the passenger was unfit to travel by air on the scheduled flight date.",
      nextAction:
        "Advise the passenger to email Let's Talk with the medical certificate (and proof of relationship if an immediate family member). The request is subject to validation and approval.",
      sourcePages: [260, 262],
      sourceField: "Medical certificate requirement",
    },
    {
      id: "meda-not-validated",
      conditions: [
        { questionId: "has_medical_cert", equals: true },
        { questionId: "docs_validated", equals: "Not yet validated" },
      ],
      outcome: "Requires supervisor",
      explanation:
        "Documents are not yet validated and options have not been provided by Customer Service.",
      nextAction:
        "Escalate the Let's Talk case to a Supervisor for Customer Service follow-up and update SPRINT. Do not confirm any outcome.",
      sourcePages: [262],
      sourceField: "Unvalidated-document escalation",
    },
    {
      id: "meda-validated",
      conditions: [
        { questionId: "has_medical_cert", equals: true },
        { questionId: "docs_validated", equals: "Customer Service validated and shared options" },
      ],
      outcome: "Requires supervisor",
      explanation:
        "Once Customer Service has validated the documents and shared options, only Floor Support / a Supervisor may action the change.",
      nextAction:
        "Confirm the customer's preferred option (within 4 days; approvals valid 30 days) and coordinate with Floor Support / a Supervisor to proceed. Update SPRINT.",
      sourcePages: [260, 262],
      sourceField: "Validated-case action via SUP/FS",
    },
  ],
  notes: [
    "This is the MEDA medical-exception workflow; medical clearance and unfit-to-travel are the same process.",
    "A medical exception is never auto-approved: Customer Service validates the certificate and shares options, and only SUP/FS action the change.",
    "TA block-fare bookings are not eligible for a medical exception (death cases only, via the issuing agent / Let's Talk).",
  ],
};
