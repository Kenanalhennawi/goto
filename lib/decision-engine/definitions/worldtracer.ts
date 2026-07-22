// WorldTracer Baggage Handling decision tree (Phase J-D Batch 3).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 26.6-26.9 "WorldTracer", pages 115-118.
//
// Classification: WorldTracer is a GUIDED ESCALATION workflow, not a final
// eligibility/approval workflow. It therefore uses only conservative outcomes:
//   - Requires document
//   - Requires supervisor
//   - Insufficient information
// It never returns "Can proceed", "Can proceed with conditions", or
// "Not permitted", and never promises compensation, reimbursement, recovery
// time, or claim approval.
//
// Verified: delayed/damaged/lost baggage follow-up depends on a PIR reference;
// handling is via WorldTracer + Baggage Services with SPRINT escalation, and
// damaged/pilfered cases require documentary evidence to
// baggageservices@flydubai.com (pp.115-118).

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const WORLDTRACER_DEFINITION: DecisionDefinition = {
  procedureSlug: "worldtracer",
  procedureTitle: "WorldTracer Baggage Handling",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "26.6–26.9 WorldTracer",
  sourcePages: [115, 116, 117, 118],
  questions: QUESTION_SETS["worldtracer"],
  rules: [
    {
      id: "wt-no-pir",
      conditions: [{ questionId: "has_pir", equals: false }],
      outcome: "Requires supervisor",
      explanation:
        "The passenger does not yet have the PIR reference needed for the documented WorldTracer follow-up.",
      nextAction:
        "Guide the passenger to the applicable Baggage Services/airport reporting path and escalate according to the documented process. Do not promise a claim outcome.",
      sourcePages: [115, 116],
      sourceField: "WorldTracer PIR prerequisite and escalation",
    },
    {
      id: "wt-lost",
      conditions: [
        { questionId: "issue_type", equals: "Lost – over 21 days" },
        { questionId: "has_pir", equals: true },
      ],
      outcome: "Requires supervisor",
      explanation:
        "A baggage case treated as lost after the documented period requires Baggage Services escalation.",
      nextAction: "Collect the documented case details, update SPRINT, and transfer/escalate to Baggage Services.",
      sourcePages: [115],
      sourceField: "WorldTracer lost-baggage escalation",
    },
    {
      id: "wt-delayed-pir",
      conditions: [
        { questionId: "issue_type", equals: "Delayed baggage" },
        { questionId: "has_pir", equals: true },
      ],
      outcome: "Requires supervisor",
      explanation: "Delayed baggage with an existing PIR requires WorldTracer/Baggage Services follow-up.",
      nextAction:
        "Collect the PIR and documented details, update SPRINT, and transfer or escalate to Baggage Services.",
      sourcePages: [115, 116],
      sourceField: "WorldTracer delayed-baggage handling",
    },
    {
      id: "wt-damaged-pir",
      conditions: [
        { questionId: "issue_type", equals: "Damaged or pilfered baggage" },
        { questionId: "has_pir", equals: true },
      ],
      outcome: "Requires document",
      explanation:
        "Damaged or pilfered baggage follow-up requires the documented evidence and Baggage Services submission.",
      nextAction:
        "Advise the passenger to provide the required documents/evidence to baggageservices@flydubai.com and follow the documented process.",
      sourcePages: [116, 117],
      sourceField: "WorldTracer damaged/pilfered baggage documentation",
    },
  ],
  notes: [
    "WorldTracer is a guided escalation workflow, not a final eligibility or approval decision.",
    "A PIR reference is required for the documented follow-up; without it the case is escalated for reporting.",
    "This workflow never promises compensation, reimbursement, baggage recovery time, or claim approval.",
  ],
};
