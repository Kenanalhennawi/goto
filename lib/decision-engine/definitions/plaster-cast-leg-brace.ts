// Plaster Cast / Leg Brace decision tree (Phase J-D Batch 4).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 44 "Passengers with Medical Conditions Onboard - Travelling with
// Plaster Casts / Leg Braces", pages 264-266.
//
// This tree encodes the documented acceptance and seating conditions. It never
// determines medical fitness; a fresh cast requires a medical certificate, and
// unclear combinations return Insufficient information.

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const PLASTER_CAST_LEG_BRACE_DEFINITION: DecisionDefinition = {
  procedureSlug: "plaster-cast-leg-brace",
  procedureTitle: "Plaster Cast / Leg Brace",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "44. Passengers with Medical Conditions Onboard – Plaster Casts / Leg Braces",
  sourcePages: [264, 265, 266],
  questions: QUESTION_SETS["plaster-cast-leg-brace"],
  rules: [
    {
      id: "pc-both-legs",
      conditions: [{ questionId: "cast_type", equals: "Both legs in cast" }],
      outcome: "Not permitted",
      explanation: "flydubai will not accept a passenger travelling with both legs in cast.",
      nextAction: "Do not accept the passenger under this workflow.",
      sourcePages: [264],
      sourceField: "Both-legs-in-cast exclusion",
    },
    {
      id: "pc-fresh-cast",
      conditions: [{ questionId: "cast_age", equals: "48 hours or less (fresh)" }],
      outcome: "Requires document",
      explanation:
        "A cast applied within 48 hours must be split to accommodate swelling and requires a medical certificate, especially on flights over two hours.",
      nextAction:
        "Advise the passenger that a fresh cast must be split (a longitudinal cut along the full length) and that a medical certificate is required.",
      sourcePages: [265],
      sourceField: "Fresh-cast split and medical-certificate requirement",
    },
    {
      id: "pc-cannot-sit-move",
      conditions: [{ questionId: "can_sit_upright_and_move", equals: false }],
      outcome: "Requires supervisor",
      explanation:
        "A passenger who cannot sit upright for take-off/landing or move unaided in an emergency must be accompanied by an able-bodied person.",
      nextAction:
        "Arrange for an able-bodied companion in the same cabin and verify the seating with Floor Support / a Supervisor.",
      sourcePages: [264],
      sourceField: "Upright/mobility condition and companion requirement",
    },
    {
      id: "pc-leg-elevation",
      conditions: [{ questionId: "needs_leg_elevation", equals: true }],
      outcome: "Requires supervisor",
      explanation:
        "Leg elevation is restricted; an extra seat or XLGR in Economy may not be used to elevate a leg — only Business class.",
      nextAction:
        "Escalate to Floor Support / a Supervisor; leg elevation is only considered in Business class and must be verified.",
      sourcePages: [264, 265],
      sourceField: "Leg-elevation restriction",
    },
    {
      id: "pc-full-cast-economy",
      conditions: [
        { questionId: "cast_type", equals: "One full leg cast (including the knee)" },
        { questionId: "cabin", equals: "Economy" },
      ],
      outcome: "Requires supervisor",
      explanation:
        "A full leg cast including the knee is accepted only on a Business class window seat; it cannot be accommodated in Economy as booked.",
      nextAction:
        "A Business class window seat is required; arrange a Business upgrade with Floor Support / a Supervisor. The companion, if any, must travel in the same cabin.",
      sourcePages: [265],
      sourceField: "Full leg cast Business-only seating",
    },
    {
      id: "pc-full-cast-eligible",
      conditions: [
        { questionId: "cast_type", equals: "One full leg cast (including the knee)" },
        { questionId: "cabin", equals: "Business" },
        { questionId: "cast_age", equals: "More than 48 hours old" },
        { questionId: "can_sit_upright_and_move", equals: true },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "A full leg cast (over 48 hours) in Business class may be accepted when the passenger can sit upright and move unaided.",
      nextAction:
        "Assign a Business class window seat (not an emergency-exit row); the leg must not extend into the aisle. Record the cast details in the PNR.",
      sourcePages: [265, 266],
      sourceField: "Full leg cast Business window-seat acceptance",
    },
    {
      id: "pc-half-cast-eligible",
      conditions: [
        { questionId: "cast_type", equals: "Half cast below the knee (boot type)" },
        { questionId: "cast_age", equals: "More than 48 hours old" },
        { questionId: "can_sit_upright_and_move", equals: true },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "A half cast below the knee (over 48 hours) may be accepted when the passenger can sit upright and move unaided.",
      nextAction:
        "Assign an Economy window XLGR seat in the first row (standard seat charges) or a Business window seat; never an emergency-exit row, and not the aisle unless it is the only option with the leg kept out of the aisle. Record the cast details in the PNR.",
      sourcePages: [265, 266],
      sourceField: "Half cast (below knee) seating acceptance",
    },
  ],
  notes: [
    "A cast may be accepted without a medical certificate only when it is more than 48 hours old, the passenger can sit upright, and can move unaided in an emergency.",
    "A half cast below the knee may travel in Economy (window XLGR first row) or Business (window); a full leg cast is Business window only.",
    "Not accepted: both legs in cast, a need to elevate legs in Economy, or a leg that does not fit the booked-class legroom; never emergency-exit rows.",
  ],
};
