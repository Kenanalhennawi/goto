// DPNA decision tree (Phase J-D Batch 4).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 35 "Disabled Passenger with Intellectual or Developmental Disability
// Needs Assistance (DPNA)", pages 172-173.
//
// A travel companion in the same cabin is mandatory. This tree encodes the
// documented SSR/seating handling; additional airport assistance is decided at
// check-in and is never committed here.

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const DPNA_DEFINITION: DecisionDefinition = {
  procedureSlug: "dpna",
  procedureTitle: "DPNA Assistance",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "35. DPNA",
  sourcePages: [172, 173],
  questions: QUESTION_SETS["dpna"],
  rules: [
    {
      id: "dpna-no-companion",
      conditions: [{ questionId: "companion_same_cabin", equals: false }],
      outcome: "Not permitted",
      explanation:
        "A DPNA passenger must travel with a companion in the same cabin for constant supervision and support; without one the booking cannot be accepted as DPNA.",
      nextAction:
        "Advise that a travel companion in the same cabin is mandatory before DPNA assistance can be arranged.",
      sourcePages: [172],
      sourceField: "Mandatory same-cabin companion",
    },
    {
      id: "dpna-non-inclusive-fare",
      conditions: [
        { questionId: "companion_same_cabin", equals: true },
        { questionId: "seat_fare", equals: "Non-inclusive seat fare" },
      ],
      outcome: "Requires supervisor",
      explanation:
        "On a non-inclusive seat fare, waiving the seat charge (rows 29-31) and assigning the seats requires SUP/FS approval.",
      nextAction:
        "Add SSR DPNA (up to D-12) and escalate the seat assignment/waiver to Floor Support / a Supervisor. Assign only window or middle seats for the DPNA passenger, excluding emergency-exit rows.",
      sourcePages: [172, 173],
      sourceField: "Non-inclusive fare seat-waiver escalation",
    },
    {
      id: "dpna-inclusive-fare",
      conditions: [
        { questionId: "companion_same_cabin", equals: true },
        { questionId: "seat_fare", equals: "Seat-inclusive fare" },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "On a seat-inclusive fare, adjoining seats can be assigned for the DPNA passenger and companion under the documented conditions.",
      nextAction:
        "Add SSR DPNA up to 12 hours before departure and assign adjoining window/middle seats for the DPNA passenger (excluding emergency-exit rows). Priority check-in, boarding and wheelchair are provided at DXB; additional airport assistance is subject to approval at check-in (do not commit).",
      sourcePages: [172, 173],
      sourceField: "Seat-inclusive fare adjoining-seat assignment",
    },
  ],
  notes: [
    "A travel companion in the same cabin is mandatory for a DPNA passenger.",
    "SSR DPNA is added up to 12 hours before departure; only window or middle seats for the DPNA passenger, never emergency-exit rows.",
    "Rows 29-31 may be free on a non-inclusive fare after SUP/FS approval; additional airport assistance is decided at check-in.",
  ],
};
