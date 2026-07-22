// Service Animal decision tree (Phase J-D Batch 4).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 36 "Service animal", page 173.
//
// flydubai accepts only service dogs that assist with a vision, hearing, or other
// physical impairment, and does NOT accept Emotional Support Animals. Pre-approval
// from flydubai (via Let's Talk, at least 72 hours before departure) is required.
// This tree never grants the approval itself; it routes the documented handling.

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const SERVICE_ANIMAL_DEFINITION: DecisionDefinition = {
  procedureSlug: "service-animal",
  procedureTitle: "Service Animal",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "36. Service animal",
  sourcePages: [173],
  questions: QUESTION_SETS["service-animal"],
  rules: [
    {
      id: "sa-emotional",
      conditions: [{ questionId: "animal_type", equals: "Emotional support animal" }],
      outcome: "Not permitted",
      explanation: "flydubai does not accept Emotional Support Animals for carriage.",
      nextAction: "Confirm to the customer that Emotional Support Animals are not accepted for carriage.",
      sourcePages: [173],
      sourceField: "Emotional Support Animal exclusion",
    },
    {
      id: "sa-not-approved",
      conditions: [
        { questionId: "animal_type", equals: "Service dog (vision/hearing/physical impairment)" },
        { questionId: "approval_status", equals: "Not yet approved or documents pending" },
      ],
      outcome: "Requires document",
      explanation:
        "Carriage of a service dog requires pre-approval from flydubai via Let's Talk at least 72 hours before departure, with the documented records.",
      nextAction:
        "Refer the passenger to letstalk@flydubai.com with the passenger's medical condition, the animal's training certificate, and the vaccination record. Customer Service will advise any further documents.",
      sourcePages: [173],
      sourceField: "Service dog pre-approval and document requirement",
    },
    {
      id: "sa-approved",
      conditions: [
        { questionId: "animal_type", equals: "Service dog (vision/hearing/physical impairment)" },
        { questionId: "approval_status", equals: "Pre-approved via Let's Talk (72h) with documents" },
      ],
      outcome: "Requires supervisor",
      explanation:
        "Final acceptance of a service dog is completed through the Let's Talk / Customer Service approval; the agent should not self-authorise carriage.",
      nextAction:
        "Coordinate with the Let's Talk / Customer Service case to confirm the approval and add SSR SVAN (free of charge). Follow any further instructions from Customer Service.",
      sourcePages: [173],
      sourceField: "Service dog approval completion (SSR SVAN)",
    },
  ],
  notes: [
    "Only service dogs assisting with a vision, hearing, or other physical impairment are accepted; Emotional Support Animals are not.",
    "Pre-approval via Let's Talk is required at least 72 hours before departure, with the passenger's medical condition, the animal's training certificate, and the vaccination record.",
    "An accepted service dog is carried free of charge (SSR SVAN); the acceptance is completed by Customer Service, not the agent.",
  ],
};
