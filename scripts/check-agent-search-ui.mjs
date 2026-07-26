// Lightweight Agent search UI guardrails (UX-R1B). Static source assertions +
// a runtime test of the operational-answer helper. Run with:
//   node scripts/check-agent-search-ui.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const page = read("app/search/page.tsx");
const answer = read("components/agent/OperationalAnswer.tsx");
const related = read("components/agent/RelatedProcedures.tsx");
const source = read("components/agent/SourceReferences.tsx");

// ---- Hierarchy: operational answer before source/manual ----
assert.ok(answer.includes("Best operational match"), "'Best operational match' label missing");
assert.ok(page.includes("<OperationalAnswer"), "OperationalAnswer not rendered on search page");
assert.ok(page.includes("<SourceReferences"), "SourceReferences not rendered on search page");
assert.ok(
  page.indexOf("<OperationalAnswer") < page.indexOf("<SourceReferences refs={sources} />"),
  "operational answer must render before the source references section"
);

// ---- No PDF/document-first chrome ----
assert.ok(!page.includes("Back to chapters"), "'Back to chapters' must be gone");
assert.ok(page.includes("Back to Home"), "'Back to Home' link missing");
assert.ok(page.includes("Showing the most relevant operational guidance first."), "supporting copy missing");

// ---- Source references collapsed + last ----
assert.ok(source.includes('id="source-references"'), "source anchor id missing");
assert.ok(source.includes("Source manual references"), "source section title missing");
assert.ok(!/<details[^>]*\bopen\b/.test(source), "source references must be collapsed by default");

// ---- No internal metadata rendered to ordinary agents ----
for (const [name, src] of [
  ["OperationalAnswer", answer],
  ["RelatedProcedures", related],
  ["SourceReferences", source],
]) {
  // Underscore-form DB metadata must never be rendered to ordinary agents.
  for (const banned of ["source_version", "review_status", "is_published", "source_confidence"]) {
    assert.ok(!src.includes(banned), `${name} must not render '${banned}'`);
  }
}

// ---- Related limited initially; best not duplicated ----
assert.ok(page.includes("slice(1, 4)"), "related must be results 2–4 (best excluded)");
assert.ok(page.includes("slice(4)"), "remaining results must go behind 'more'");
assert.ok(related.includes("Show more results"), "'Show more results' disclosure missing");

// ---- Guided action gated by availability; never active when unavailable ----
assert.ok(page.includes("getWorkflowAvailability"), "guided availability must use getWorkflowAvailability");
assert.ok(answer.includes("guided.available ?"), "best match guided button must be availability-gated");
assert.ok(
  answer.includes("Guided questions are not currently available"),
  "quiet unavailable message missing"
);
assert.ok(related.includes("item.guidedAvailable ?"), "related guided link must be availability-gated");

// ---- Empty / no-op states with useful examples ----
for (const ex of [
  "passenger has a plaster cast",
  "wrong name on the booking",
  "customer missed the flight",
  "passenger needs oxygen",
]) {
  assert.ok(page.includes(ex), `example search '${ex}' missing`);
}
assert.ok(page.includes("No reviewed operational answer was found"), "no-operational-match state missing");
assert.ok(page.includes("We couldn"), "no-results state missing");

// ---- Runtime: operational-answer helper is null/string/array safe ----
const { deriveOperationalAnswer } = await import("../lib/operational-answer.ts");

const empty = deriveOperationalAnswer({ title: "Empty Card" });
assert.equal(empty.title, "Empty Card");
assert.equal(empty.summary, null);
assert.equal(empty.deadline, null);
assert.equal(empty.handler, null);
assert.equal(empty.criticalBlocker, null);
assert.equal(empty.canAction, "Review the conditions below.");
assert.deepEqual(empty.notAllowed, []);
assert.equal(empty.hasDetails, false);

const full = deriveOperationalAnswer({
  title: "Full Card",
  summary: "  Fix a name  ",
  cut_off_time: "More than 6 hours before departure; other rule",
  who_can_action: ["Contact Centre agent"],
  not_allowed: [{ label: "No-show" }, "Name swap"],
  system_steps: ["Verify the correction type"],
  allowed: ["Permitted with conditions"],
  passenger_advice: ["Advise the passenger"],
  escalation_points: [],
  fees_charges: "   ",
});
assert.equal(full.summary, "Fix a name", "whitespace-trimmed summary");
assert.equal(full.deadline, "More than 6 hours before departure", "first meaningful deadline line");
assert.equal(full.handler, "Contact Centre agent");
assert.equal(full.criticalBlocker, "No-show", "JSON-object array item resolved");
assert.equal(full.canAction, "Yes, subject to the conditions below.");
assert.equal(full.primaryAction, "Verify the correction type");
assert.equal(full.fees, null, "whitespace-only fees omitted");
assert.equal(full.hasDetails, true);

console.log("Agent search UI checks passed.");
