// Auto Split OD decision tree (Phase J-D Batch 1).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 11 "Fare Types" - "Auto Split One-Direction (OD) for FZ-FZ
// connection booking", pages 49-50. Verified rules:
//   - Applies only to FZ-FZ connection bookings (Lite/Value/Flex/Business).
//     Interline/codeshare and circular flights are excluded (pp.49-50).
//   - An OD Split occurs only when the two legs have DIFFERENT statuses
//     (boarded / no-show) after flight closure (p.49).
//   - Leg 1 boarded, Leg 2 no-show: the no-show leg may be modified per fare
//     rules; cancellation of the no-show segment must be completed by SUP/FS in
//     charge; the unused sector is not refundable (pp.49-50).
//   - Leg 1 no-show, Leg 2 boarded: modification/cancellation is not permitted
//     (pp.49-50).

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const AUTO_SPLIT_OD_DEFINITION: DecisionDefinition = {
  procedureSlug: "auto-split-od",
  procedureTitle: "Auto Split OD",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "11. Fare Types — Auto Split OD (FZ-FZ)",
  sourcePages: [49, 50],
  questions: QUESTION_SETS["auto-split-od"],
  rules: [
    {
      id: "auto-split-excluded",
      conditions: [{ questionId: "fz_connection", equals: false }],
      outcome: "Insufficient information",
      explanation:
        "Auto Split OD does not apply to interline, codeshare, circular, or otherwise excluded itineraries.",
      nextAction: "Handle under the applicable standard modification and fare rules.",
      sourcePages: [50],
      sourceField: "Auto Split OD exclusions",
    },
    {
      id: "auto-split-other-status",
      conditions: [
        { questionId: "fz_connection", equals: true },
        { questionId: "leg_pattern", equals: "Other or both same status" },
      ],
      outcome: "Insufficient information",
      explanation:
        "An OD Split occurs only when the two legs have different documented statuses: boarded and no-show.",
      nextAction: "Do not apply the Auto Split OD matrix to this pattern.",
      sourcePages: [49, 50],
      sourceField: "OD Split status trigger",
    },
    {
      id: "auto-split-noshow-first",
      conditions: [
        { questionId: "fz_connection", equals: true },
        { questionId: "leg_pattern", equals: "Leg 1 no-show, Leg 2 boarded" },
      ],
      outcome: "Not permitted",
      explanation:
        "Modification or cancellation is not permitted for this status pattern under the Auto Split OD matrix.",
      nextAction: "Do not process the requested modification or cancellation under Auto Split OD.",
      sourcePages: [49, 50],
      sourceField: "Auto Split OD restriction matrix",
    },
    {
      id: "auto-split-cancel",
      conditions: [
        { questionId: "fz_connection", equals: true },
        { questionId: "leg_pattern", equals: "Leg 1 boarded, Leg 2 no-show" },
        { questionId: "request", equals: "Cancel the affected leg" },
      ],
      outcome: "Requires supervisor",
      explanation:
        "Cancellation of the no-show segment must be completed by Supervisor/Floor Support in charge, under the applicable fare rules.",
      nextAction: "Escalate to SUP/FS. The unused sector is not refundable.",
      sourcePages: [49, 50],
      sourceField: "Auto Split OD cancellation matrix",
    },
    {
      id: "auto-split-modify",
      conditions: [
        { questionId: "fz_connection", equals: true },
        { questionId: "leg_pattern", equals: "Leg 1 boarded, Leg 2 no-show" },
        { questionId: "request", equals: "Modify the affected leg" },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "The no-show leg may be modified under the documented fare rules using one-way fare logic.",
      nextAction: "Modify the affected leg according to applicable fare rules and verify the recalculated itinerary.",
      sourcePages: [49, 50],
      sourceField: "Auto Split OD modification matrix",
    },
  ],
  notes: [
    "Auto Split OD applies only to FZ-FZ connection bookings; interline/codeshare and circular flights are excluded.",
    "An OD Split is triggered automatically after flight closure only when the two legs have different statuses.",
    "There is no out-of-sequence check; the unused sector is not refunded.",
  ],
};
