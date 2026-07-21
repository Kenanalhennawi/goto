// Deterministic rule evaluator (Phase C). First matching rule wins;
// missing required answers always yield Insufficient information.
// No outcome can exist without an explicit, source-cited rule.

import { missingRequired } from "./session.ts";
import type { AnswerValue, DecisionAnswers, DecisionQuestion } from "./types.ts";

export type RuleCondition = {
  questionId: string;
  equals?: AnswerValue;
  min?: number;
  max?: number;
};

export type DecisionOutcomeKind =
  | "Can proceed"
  | "Can proceed with conditions"
  | "Requires document"
  | "Requires supervisor"
  | "Not permitted"
  | "Insufficient information";

export type DecisionRule = {
  id: string;
  conditions: RuleCondition[];
  outcome: DecisionOutcomeKind;
  explanation: string;
  nextAction?: string;
  /** Source pages backing this specific rule (falls back to definition pages). */
  sourcePages?: number[];
  /** Operational card field that supports the rule (audit aid). */
  sourceField?: string;
};

export type DecisionDefinition = {
  procedureSlug: string;
  procedureTitle: string;
  version: number;
  sourceVersion: string;
  sourceChapter: string;
  sourcePages: number[];
  questions: DecisionQuestion[];
  rules: DecisionRule[];
  notes: string[];
  /** Optional deterministic derivation shown with the outcome (e.g. MCT difference in minutes). */
  derive?: (answers: DecisionAnswers) => string | null;
};

export type EvaluationResult = {
  outcome: DecisionOutcomeKind;
  explanation: string;
  nextAction: string | null;
  matchedRuleId: string | null;
  /** Pages backing the matched rule (rule-level if present, else definition-level). */
  rulePages: number[] | null;
  /** Deterministic derived detail (definition.derive), never generated text. */
  derived: string | null;
  confidence: "High confidence" | "Conditional" | "Insufficient information";
  missing: string[];
};

export function evaluate(definition: DecisionDefinition, answers: DecisionAnswers): EvaluationResult {
  const missing = missingRequired(definition.questions, answers).map((question) => question.label);
  if (missing.length > 0) {
    return {
      outcome: "Insufficient information",
      explanation: "Required questions are unanswered.",
      nextAction: null,
      matchedRuleId: null,
      rulePages: null,
      derived: null,
      confidence: "Insufficient information",
      missing,
    };
  }

  for (const rule of definition.rules) {
    if (rule.conditions.every((condition) => matches(condition, answers))) {
      return {
        outcome: rule.outcome,
        explanation: rule.explanation,
        nextAction: rule.nextAction ?? null,
        matchedRuleId: rule.id,
        rulePages: rule.sourcePages ?? definition.sourcePages,
        derived: definition.derive ? definition.derive(answers) : null,
        confidence:
          rule.outcome === "Requires document" ||
          rule.outcome === "Requires supervisor" ||
          rule.outcome === "Can proceed with conditions"
            ? "Conditional"
            : rule.outcome === "Insufficient information"
              ? "Insufficient information"
              : "High confidence",
        missing: [],
      };
    }
  }

  return {
    outcome: "Insufficient information",
    explanation: "No verified rule covers this combination of answers.",
    nextAction: "Open the full procedure card and verify against the source.",
    matchedRuleId: null,
    rulePages: null,
    derived: null,
    confidence: "Insufficient information",
    missing: [],
  };
}

function matches(condition: RuleCondition, answers: DecisionAnswers) {
  const value = answers[condition.questionId];
  if (value === undefined) return false;
  if (condition.equals !== undefined && value !== condition.equals) return false;
  if (condition.min !== undefined && (typeof value !== "number" || value < condition.min)) return false;
  if (condition.max !== undefined && (typeof value !== "number" || value > condition.max)) return false;
  return true;
}
