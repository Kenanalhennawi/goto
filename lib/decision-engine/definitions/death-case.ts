// Death Case decision tree (Phase J-D Batch 4).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 43 "Medical & Death cases", pages 260-263.
//
// Kept separate from MEDA because eligibility, documents and fare treatment
// differ. This tree NEVER auto-approves or auto-refunds; Customer Service
// validates the documents and only SUP/FS action the change. Conservative
// outcomes only: Requires document / Requires supervisor / Insufficient
// information.

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const DEATH_CASE_DEFINITION: DecisionDefinition = {
  procedureSlug: "death-case",
  procedureTitle: "Death Case",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "43. Medical & Death cases",
  sourcePages: [260, 261, 262, 263],
  questions: QUESTION_SETS["death-case"],
  rules: [
    {
      id: "dc-relationship-unclear",
      conditions: [{ questionId: "relationship", equals: "Other or unrelated" }],
      outcome: "Insufficient information",
      explanation:
        "A death exception is documented only for the passenger, immediate family, or a second-degree relative; other relationships are not covered.",
      nextAction:
        "Advise the passenger to email Let's Talk so Customer Service can determine eligibility. Do not confirm any exception.",
      sourcePages: [260],
      sourceField: "Death-exception eligible relationships",
    },
    {
      id: "dc-no-docs",
      conditions: [{ questionId: "has_docs", equals: false }],
      outcome: "Requires document",
      explanation:
        "A death exception needs the death certificate, a copy of the deceased passenger's passport, and proof of relationship.",
      nextAction:
        "Advise the passenger to email Let's Talk with the death certificate, deceased passport copy, and proof of relationship. The request is subject to approval.",
      sourcePages: [262],
      sourceField: "Death-case document requirement",
    },
    {
      id: "dc-not-validated",
      conditions: [
        { questionId: "has_docs", equals: true },
        { questionId: "docs_validated", equals: "Not yet validated" },
      ],
      outcome: "Requires supervisor",
      explanation: "Documents are not yet validated and options have not been provided by Customer Service.",
      nextAction: "Escalate the case to a Supervisor for Customer Service follow-up and update SPRINT.",
      sourcePages: [262],
      sourceField: "Unvalidated-document escalation",
    },
    {
      id: "dc-validated",
      conditions: [
        { questionId: "has_docs", equals: true },
        { questionId: "docs_validated", equals: "Customer Service validated and shared options" },
      ],
      outcome: "Requires supervisor",
      explanation:
        "Once Customer Service has validated the documents and shared options, only Floor Support / a Supervisor may action the change or refund.",
      nextAction:
        "Confirm the customer's preferred option and coordinate with Floor Support / a Supervisor to proceed. There is no automatic refund. Update SPRINT.",
      sourcePages: [260, 261, 262],
      sourceField: "Validated-case action via SUP/FS",
    },
  ],
  notes: [
    "Death exceptions cover the passenger, immediate family (proof of relationship), or a second-degree relative (proof of relationship).",
    "There is no automatic refund: Customer Service validates the documents and only SUP/FS action the change or refund.",
    "Immediate family refunds are to form of payment with proof of relationship; second-degree relatives receive a voucher with a penalty.",
  ],
};
