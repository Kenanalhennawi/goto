// STAB-1 — production-stabilization guardrails.
// Static source assertions + a runtime tree-warning check. Run with:
//   node scripts/check-stabilization.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const primary = read("components/agent/PrimarySearch.tsx");
const questionFlow = read("components/decision/QuestionFlow.tsx");
const simulator = read("components/WorkflowSimulator.tsx");
const questions = read("lib/decision-engine/questions.ts");

// ---- PrimarySearch: no synchronous short-query reset inside the effect ----
assert.ok(
  primary.includes("if (trimmed.length < MIN_CHARS) return;"),
  "PrimarySearch effect must early-return on short query (no setState in effect)"
);
// The below-min guard is derived, and the reset happens in the change handler.
assert.ok(primary.includes("const belowMin ="), "PrimarySearch must derive belowMin");
assert.ok(primary.includes("!belowMin"), "showList must exclude short queries via belowMin");
assert.ok(
  primary.includes("if (value.trim().length < MIN_CHARS)"),
  "input change handler must clear the preview on short query"
);
// The old synchronous three-setter reset block must be gone from the effect.
assert.ok(
  !/if \(trimmed\.length < MIN_CHARS\) \{\s*setSuggestions/.test(primary),
  "old synchronous short-query reset block must be removed from the effect"
);
// Behaviour preserved (also covered by check-agent-home-live-ui).
for (const token of ['MIN_CHARS = 3', 'MAX_SUGGESTIONS = 3', 'slice(0, MAX_SUGGESTIONS)', '300', 'event.key === "Escape"', 'action="/search"', 'r.type === "operational_card"']) {
  assert.ok(primary.includes(token), `PrimarySearch must preserve '${token}'`);
}

// ---- QuestionFlow: refs are never mutated during render ----
assert.ok(!primary.includes("eslint-disable"), "PrimarySearch must not add eslint-disable");
assert.ok(
  !questionFlow.includes("optionRefs.current = [];"),
  "QuestionFlow must not reset optionRefs during render"
);
assert.ok(
  questionFlow.includes("optionRefs.current.length = optionList.length"),
  "QuestionFlow must truncate stale option refs in an effect"
);
// No NEW eslint-disable: the two pre-existing exhaustive-deps suppressions
// (keydown + outcome effects) predate STAB-1 and are unchanged. Crucially,
// none of the fixed rules (refs / set-state-in-effect) is suppressed.
assert.equal(
  (questionFlow.match(/eslint-disable/g) ?? []).length,
  2,
  "QuestionFlow must keep exactly the two pre-existing eslint-disable lines, none added"
);
assert.ok(!/eslint-disable[^\n]*react-hooks\/refs/.test(questionFlow), "react-hooks/refs must not be suppressed");
assert.ok(
  !/eslint-disable[^\n]*set-state-in-effect/.test(primary + questionFlow + simulator),
  "set-state-in-effect must not be suppressed"
);

// ---- WorkflowSimulator: questions are a stable dependency ----
assert.ok(
  simulator.includes("useMemo(() => QUESTION_SETS[slug] ?? [], [slug])"),
  "WorkflowSimulator must memoize questions by slug"
);
assert.ok(!simulator.includes("eslint-disable"), "WorkflowSimulator must not add eslint-disable");

// ---- Dead decision questions removed (kept the engine simple, no flag) ----
assert.ok(!questions.includes('id: "certificate_available"'), "certificate_available question must be removed");
assert.ok(!questions.includes('id: "battery_type"'), "battery_type question must be removed");
// The rule-referenced medical certificate question must remain untouched.
assert.ok(questions.includes('id: "medical_certificate_available"'), "medical_certificate_available must remain");

// ---- Tree validator: no unused-question warnings remain ----
const { DECISION_DEFINITIONS } = await import("../lib/decision-engine/definitions/index.ts");
const { validateAllTrees } = await import("../lib/decision-engine/validate-trees.ts");
const issues = validateAllTrees(DECISION_DEFINITIONS);
const warnings = issues.filter((i) => i.level === "warning");
const errors = issues.filter((i) => i.level === "error");
assert.equal(errors.length, 0, `tree errors must be zero (got ${errors.map((e) => `${e.slug}:${e.message}`).join("; ")})`);
assert.equal(
  warnings.length,
  0,
  `tree warnings must be zero for v1.0 (got ${warnings.map((w) => `${w.slug}:${w.message}`).join("; ")})`
);
// Explicitly: neither removed question is referenced anywhere in a warning.
for (const w of warnings) {
  assert.ok(!/certificate_available|battery_type/.test(w.message), "removed questions must not appear in warnings");
}

console.log("Stabilization checks passed.");
