// Pregnancy decision tree.
// Source of truth: The GO TO document v81.7 (30-Jul-2026),
// chapter 43 "Pregnancy", page 257. Rules transcribed verbatim:
//   Single uncomplicated:  0-28 no certificate | 29-36 certificate | 37+ not allowed
//   Multiple uncomplicated: 0-28 no certificate | 29-32 certificate | 33+ not allowed
// Medical and airport authority decisions always stand.
//
// UPD-1 metadata-only alignment: the v81.7 chapter body is byte-identical to
// the previously verified text — the only differences are the chapter number
// (42 -> 43, from the ch.34 Accessibility insertion) and the page (259 -> 257,
// the -2 shift). No question, rule, outcome, explanation or next action was
// changed.

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const PREGNANCY_DEFINITION: DecisionDefinition = {
  procedureSlug: "pregnancy",
  procedureTitle: "Pregnancy",
  version: 1,
  sourceVersion: "81.7 (30-Jul-2026)",
  sourceChapter: "43. Pregnancy",
  sourcePages: [257],
  questions: QUESTION_SETS["pregnancy"],
  rules: [
    {
      id: "single-to-28",
      conditions: [
        { questionId: "pregnancy_type", equals: "Single" },
        { questionId: "pregnancy_week", max: 28 },
      ],
      outcome: "Can proceed",
      explanation:
        "Single uncomplicated pregnancy up to the end of week 28: accepted for travel without a medical certificate.",
    },
    {
      id: "single-29-36",
      conditions: [
        { questionId: "pregnancy_type", equals: "Single" },
        { questionId: "pregnancy_week", min: 29, max: 36 },
      ],
      outcome: "Requires document",
      explanation:
        "Single uncomplicated pregnancy, weeks 29 to 36 inclusive: a medical certificate is required.",
      nextAction:
        "Advise the passenger of the certificate requirements; only the original certificate is accepted at the check-in desk.",
    },
    {
      id: "single-37-plus",
      conditions: [
        { questionId: "pregnancy_type", equals: "Single" },
        { questionId: "pregnancy_week", min: 37 },
      ],
      outcome: "Not permitted",
      explanation: "Single pregnancy from week 37 onwards: not allowed to travel.",
    },
    {
      id: "multiple-to-28",
      conditions: [
        { questionId: "pregnancy_type", equals: "Multiple" },
        { questionId: "pregnancy_week", max: 28 },
      ],
      outcome: "Can proceed",
      explanation:
        "Multiple uncomplicated pregnancy up to the end of week 28: accepted for travel without a medical certificate.",
    },
    {
      id: "multiple-29-32",
      conditions: [
        { questionId: "pregnancy_type", equals: "Multiple" },
        { questionId: "pregnancy_week", min: 29, max: 32 },
      ],
      outcome: "Requires document",
      explanation:
        "Multiple uncomplicated pregnancy, weeks 29 to 32 inclusive: a medical certificate is required.",
      nextAction:
        "Advise the passenger of the certificate requirements; only the original certificate is accepted at the check-in desk.",
    },
    {
      id: "multiple-33-plus",
      conditions: [
        { questionId: "pregnancy_type", equals: "Multiple" },
        { questionId: "pregnancy_week", min: 33 },
      ],
      outcome: "Not permitted",
      explanation: "Multiple pregnancy from week 33 onwards: not allowed to travel.",
    },
  ],
  notes: [
    "The certificate must state weeks of pregnancy, expected delivery date, single or multiple pregnancy, that the pregnancy is normal, and fitness to fly; signed and stamped, valid 3 weeks from issue, on the flydubai form or a clinic/hospital letterhead.",
    "Only the original medical certificate is accepted at the check-in desk.",
    "This guidance covers uncomplicated pregnancies; medical and airport authority decisions always stand.",
  ],
};
