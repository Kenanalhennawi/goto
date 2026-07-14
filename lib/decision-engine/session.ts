// Session helpers (Phase B). Pure functions so they are testable in
// node. Persistence is sessionStorage-only and never stores personal
// passenger data; answers are limited to the modeled question values.

import type { AnswerValue, DecisionAnswers, DecisionQuestion } from "./types.ts";

export function nextQuestion(
  questions: DecisionQuestion[],
  answers: DecisionAnswers
): DecisionQuestion | null {
  return questions.find((question) => !(question.id in answers)) ?? null;
}

export function answeredCount(questions: DecisionQuestion[], answers: DecisionAnswers) {
  return questions.filter((question) => question.id in answers).length;
}

export function missingRequired(questions: DecisionQuestion[], answers: DecisionAnswers) {
  return questions.filter((question) => question.required && !(question.id in answers));
}

export function validateAnswer(question: DecisionQuestion, value: AnswerValue): string | null {
  switch (question.answerType) {
    case "yes_no":
      return typeof value === "boolean" ? null : "Answer yes or no.";
    case "single_choice":
      return typeof value === "string" && (question.options ?? []).includes(value)
        ? null
        : "Pick one of the listed options.";
    case "number": {
      if (typeof value !== "number" || Number.isNaN(value)) return "Enter a number.";
      if (question.min !== undefined && value < question.min) return `Minimum is ${question.min}.`;
      if (question.max !== undefined && value > question.max) return `Maximum is ${question.max}.`;
      return null;
    }
    default:
      return "Unsupported answer type.";
  }
}
