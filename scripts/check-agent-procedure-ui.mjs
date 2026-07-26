// Lightweight Agent procedure-page UI guardrails (UX-R1C). Static source
// assertions. Run with: node scripts/check-agent-procedure-ui.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const page = read("app/procedure/[slug]/page.tsx");
const quick = read("components/agent/ProcedureQuickAnswer.tsx");
const details = read("components/agent/FullOperationalDetails.tsx");
const copy = read("components/agent/CopySummaryButton.tsx");

// ---- Hierarchy: quick answer before source & review ----
assert.ok(page.includes("<ProcedureQuickAnswer"), "ProcedureQuickAnswer not rendered");
assert.ok(page.includes("<SourceReference"), "SourceReference not rendered");
assert.ok(
  page.indexOf("<ProcedureQuickAnswer") < page.indexOf("<SourceReference procedure={procedure} />"),
  "quick answer must render before the source section"
);
assert.ok(
  page.indexOf("<ProcedureQuickAnswer") < page.indexOf("<ReviewDetails"),
  "quick answer must render before review details"
);

// ---- Source section collapsed by default; nothing auto-open ----
assert.ok(!/<details[^>]*\bopen\b/.test(page), "no <details> on the procedure page may default to open");
assert.ok(page.includes("Source &amp; reference"), "'Source & reference' section missing");

// ---- No source metadata in the top header (only inside collapsed sections) ----
assert.ok(
  page.indexOf("Source version") > page.indexOf("<ProcedureQuickAnswer"),
  "source version must not appear above the quick answer"
);
assert.ok(
  page.indexOf('label="Review status"') > page.indexOf("<ProcedureQuickAnswer"),
  "review status must not be rendered above the quick answer"
);

// ---- Shared helper reused (no second derivation) ----
assert.ok(page.includes("deriveOperationalAnswer"), "must reuse deriveOperationalAnswer");
assert.ok(quick.includes('from "@/lib/operational-answer"'), "quick answer must use the shared helper type");
assert.ok(!quick.includes("readableJsonItems"), "quick answer must not re-derive from raw fields");

// ---- Guided action gated by availability; unavailable is not active ----
assert.ok(page.includes("getWorkflowAvailability"), "guided must use getWorkflowAvailability");
assert.ok(page.includes("availability.available ?"), "guided button must be availability-gated");
assert.ok(
  page.includes("Guided questions are not currently available."),
  "quiet unavailable message missing"
);

// ---- Copy summary excludes source/review metadata ----
assert.ok(page.includes("<CopySummaryButton"), "CopySummaryButton not rendered");
const summaryFn = page.slice(page.indexOf("function buildSummaryText"), page.indexOf("type RelatedProcedure"));
for (const banned of ["source_version", "review_status", "source_confidence", "chapters", "last_reviewed"]) {
  assert.ok(!summaryFn.includes(banned), `copy summary must not include '${banned}'`);
}
assert.ok(copy.includes("Quick summary copied"), "accessible copy feedback missing");
assert.ok(copy.includes('aria-live="polite"'), "copy feedback must use aria-live");

// ---- Empty sections omitted; no raw JSON ----
assert.ok(details.includes("if (!answer.hasDetails) return null;"), "details must omit when empty");
assert.ok(details.includes("if (items.length === 0) return null;"), "empty lists must be omitted");
for (const [name, src] of [["page", page], ["quick", quick], ["details", details]]) {
  assert.ok(!src.includes("JSON.stringify"), `${name} must not render raw JSON`);
}

// ---- Passenger advice + restriction labels ----
assert.ok(details.includes("What to tell the passenger"), "'What to tell the passenger' label missing");
assert.ok(quick.includes("Do not proceed when"), "'Do not proceed when' label missing in quick answer");
assert.ok(details.includes("Do not proceed when"), "'Do not proceed when' label missing in details");
assert.ok(details.includes("Applicable when"), "'Applicable when' label missing");

// ---- Review details role-gated; favorites + recent integrated ----
assert.ok(page.includes("canManage ? <ReviewDetails"), "review details must be role-gated by canManage");
assert.ok(page.includes("<FavoriteButton"), "FavoriteButton must remain integrated");
assert.ok(page.includes("<RecentTracker"), "RecentTracker must remain integrated");

// ---- Not-found state with useful actions ----
assert.ok(page.includes("We couldn"), "not-found state missing");
assert.ok(page.includes("Search for another procedure"), "not-found search action missing");

console.log("Agent procedure UI checks passed.");
