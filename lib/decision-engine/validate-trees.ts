// Structural validation for decision trees (Phase J).
// Pure and dependency-free so it can run during build (via scripts/validate-trees.mjs
// and inside check-decision.mjs). It detects the failure modes that a flat,
// first-match rule engine can actually have:
//   - missing source pages / version (weakens the source guard)
//   - a rule referencing a question that does not exist (broken/dead condition)
//   - a single_choice equals value outside the question's options (dead end:
//     the rule can never match)
//   - duplicate rule ids within a workflow
//   - empty question set / empty rule set
// Loops are structurally impossible (rules do not branch to other nodes), and
// duplicate outcome *kinds* are legitimate (many rules share an outcome), so
// those are not flagged. Unused questions are reported as warnings only.

import type { DecisionDefinition } from "./evaluator.ts";
import type { DecisionQuestion } from "./types.ts";

export type TreeIssue = { slug: string; level: "error" | "warning"; message: string };

export function validateTree(definition: DecisionDefinition): TreeIssue[] {
  const issues: TreeIssue[] = [];
  const slug = definition.procedureSlug;
  const err = (message: string) => issues.push({ slug, level: "error", message });
  const warn = (message: string) => issues.push({ slug, level: "warning", message });

  if (!definition.sourceVersion || !definition.sourceVersion.trim()) {
    err("missing sourceVersion");
  }
  if (!Array.isArray(definition.sourcePages) || definition.sourcePages.length === 0) {
    err("missing definition sourcePages");
  }
  if (!Array.isArray(definition.questions) || definition.questions.length === 0) {
    err("no questions defined");
  }
  if (!Array.isArray(definition.rules) || definition.rules.length === 0) {
    err("no rules defined");
  }

  const questionsById = new Map<string, DecisionQuestion>();
  for (const question of definition.questions ?? []) questionsById.set(question.id, question);

  const referenced = new Set<string>();
  const seenRuleIds = new Set<string>();

  for (const rule of definition.rules ?? []) {
    if (!rule.id) {
      err("a rule is missing an id");
    } else if (seenRuleIds.has(rule.id)) {
      err(`duplicate rule id: ${rule.id}`);
    } else {
      seenRuleIds.add(rule.id);
    }

    const rulePages = rule.sourcePages ?? definition.sourcePages;
    if (!Array.isArray(rulePages) || rulePages.length === 0) {
      err(`rule ${rule.id ?? "?"} has no source pages`);
    }

    for (const condition of rule.conditions ?? []) {
      referenced.add(condition.questionId);
      const question = questionsById.get(condition.questionId);
      if (!question) {
        err(`rule ${rule.id ?? "?"} references unknown question "${condition.questionId}"`);
        continue;
      }
      // A single_choice equals value that is not an allowed option is a dead
      // condition — the rule can never fire.
      if (
        condition.equals !== undefined &&
        typeof condition.equals === "string" &&
        question.answerType === "single_choice" &&
        Array.isArray(question.options) &&
        !question.options.includes(condition.equals)
      ) {
        err(
          `rule ${rule.id ?? "?"} tests "${condition.questionId}" = "${condition.equals}", which is not an option`
        );
      }
      if (
        condition.min !== undefined &&
        condition.max !== undefined &&
        condition.min > condition.max
      ) {
        warn(`rule ${rule.id ?? "?"} has min > max on "${condition.questionId}"`);
      }
    }
  }

  for (const question of definition.questions ?? []) {
    if (!referenced.has(question.id)) {
      // Optional context questions (e.g. that only shape advice text) are allowed;
      // flag as a warning so they are visible without failing the build.
      warn(`question "${question.id}" is not used by any rule`);
    }
  }

  return issues;
}

export function validateAllTrees(
  definitions: Record<string, DecisionDefinition>
): TreeIssue[] {
  return Object.values(definitions).flatMap((definition) => validateTree(definition));
}

export function treeErrors(issues: TreeIssue[]): TreeIssue[] {
  return issues.filter((issue) => issue.level === "error");
}
