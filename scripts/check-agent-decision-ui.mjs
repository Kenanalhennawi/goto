// Lightweight Agent guided-decision UI guardrails (UX-R1D). Static source
// assertions. Run with: node scripts/check-agent-decision-ui.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const count = (s, sub) => s.split(sub).length - 1;

const qf = read("components/decision/QuestionFlow.tsx");
const intake = read("components/decision/DecisionIntake.tsx");
const css = read("app/globals.css");

// ---- One question at a time + progress ----
assert.ok(qf.includes("nextQuestion(questions, answers)"), "must derive the single current question");
assert.ok(qf.includes("{current ? ("), "must branch on a single current question");
assert.ok(qf.includes("Question ${Math.min(done + 1, total)} of ${total}"), "progress label missing");

// ---- Keyboard: number keys guarded while typing; arrows; native buttons ----
assert.ok(qf.includes("const inField ="), "must detect typing context");
assert.ok(qf.includes("if (inField) return;"), "shortcuts must be guarded while typing");
assert.ok(qf.includes("/^[1-9]$/"), "number-key selection missing");
assert.ok(qf.includes('event.key === "ArrowDown"') && qf.includes('event.key === "ArrowUp"'), "arrow focus missing");
assert.ok(qf.includes('event.key === "Escape"'), "Escape close missing");
assert.ok(qf.includes("reopenLast"), "Back-to-previous behavior missing");

// ---- Options: native buttons, full-width, 48px touch target ----
assert.ok(qf.includes("min-h-[48px]") && qf.includes("w-full"), "options must be full-width 48px");
assert.ok(!/<div[^>]*onClick=/.test(qf), "options must be native buttons, not clickable divs");

// ---- Outcome order + collapsed source + no source version on agent screen ----
assert.ok(
  qf.indexOf("What this means") < qf.indexOf("Source &amp; reference"),
  "outcome explanation must precede source"
);
assert.ok(
  qf.indexOf("Source &amp; reference") < qf.indexOf("Start again"),
  "source must precede the outcome primary-actions block"
);
assert.ok(!/<details[^>]*\bopen\b/.test(qf), "outcome/source disclosures must be collapsed by default");
// The agent outcome source shows chapter/pages/field, not source version/freshness.
const sourceBlock = qf.slice(qf.indexOf("Source &amp; reference"), qf.indexOf("</details>", qf.indexOf("Source &amp; reference")));
assert.ok(!sourceBlock.includes("sourceVersion") && !sourceBlock.includes("Source version"), "no source version on outcome source block");

// ---- Insufficient information is helpful ----
assert.ok(qf.includes("More information is needed"), "insufficient-information heading missing");
assert.ok(qf.includes("Still needed"), "insufficient-information missing list absent");

// ---- Copy outcome summary excludes answers/personal data ----
assert.ok(qf.includes("Copy outcome summary"), "copy outcome summary action missing");
assert.ok(qf.includes("formatOutcomeSummary(summaryInput)"), "must reuse the safe outcome summary formatter");
const summaryInputBlock = qf.slice(qf.indexOf("const summaryInput"), qf.indexOf("const summary ="));
for (const banned of ["answers", "startedAt", "durationMs", "review_status", "is_published"]) {
  assert.ok(!summaryInputBlock.includes(banned), `copy summary input must not include '${banned}'`);
}

// ---- Session stability + start-again keeps startedAt ----
assert.ok(qf.includes("startedAt: session.startedAt"), "startedAt must persist stably");
assert.ok(qf.includes("answers: {} }))"), "Start again must clear answers only (keep startedAt)");

// ---- Analytics fired once each (no double-fire) ----
assert.equal(count(qf, 'type: "workflow_started"'), 1, "workflow_started must fire exactly once");
assert.equal(count(qf, 'type: "workflow_completed"'), 1, "workflow_completed must fire exactly once");

// ---- Landing / routed match presentation ----
assert.ok(intake.includes("This looks like"), "routed-match confirmation missing");
assert.ok(intake.includes("Possible guided topics"), "multi-match presentation missing");
assert.ok(intake.includes("We couldn"), "no-match state missing");
assert.ok(intake.includes("Browse guided topics"), "browse topics entry missing");
assert.ok(intake.includes("getWorkflowAvailability"), "landing must gate guided start on availability");
assert.ok(
  intake.includes("availability.available && hasQuestions"),
  "preselected workflow must require availability to start"
);
assert.ok(
  intake.includes("Guided questions are not currently available."),
  "quiet unavailable message missing on landing"
);
// No raw scores / technical match reasons surfaced.
assert.ok(!intake.includes(".score") && !intake.includes("viaIntent ?"), "must not surface raw match scores/reasons");

// ---- Reduced-motion support present (global guard) ----
assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"), "reduced-motion CSS missing");

console.log("Agent decision UI checks passed.");
