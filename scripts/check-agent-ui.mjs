// Lightweight Agent Mode UI guardrails (UX-R1A).
// Static source assertions — no browser or new test framework. Run with:
//   node scripts/check-agent-ui.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const header = read("components/SiteHeader.tsx");
const page = read("app/page.tsx");
const css = read("app/globals.css");
const primarySearch = read("components/agent/PrimarySearch.tsx");

// ---- Navigation: plain-language agent labels ----
for (const label of ['label: "Home"', 'label: "Search"', 'label: "Guided decision"', 'label: "Browse services"']) {
  assert.ok(header.includes(label), `SiteHeader missing agent nav ${label}`);
}
// Old confusing labels are gone from Agent Mode nav.
assert.ok(!header.includes('label: "Command center"'), "old 'Command center' label still present");
assert.ok(!header.includes('label: "Decision"'), "old 'Decision' label still present");
// Files is no longer a primary agent nav item.
assert.ok(!header.includes('href: "/files"'), "'/files' should not be a primary agent nav item");

// ---- Admin entry: single, role-gated ----
assert.ok(header.includes("canAccessAdmin"), "admin gating helper missing");
assert.ok(header.includes("showAdmin"), "showAdmin gate missing");
assert.ok(header.includes('label: "Admin"'), "single Admin entry missing");
// Admin sub-destinations must not appear in the ordinary agent sidebar arrays.
assert.ok(!header.includes('label: "Procedures"'), "Procedures should not be in agent nav");
assert.ok(!header.includes('label: "Quality"'), "Quality should not be in agent nav");

// ---- Homepage: search-first, no internal metadata ----
assert.ok(page.includes("What is the customer asking about?"), "primary search heading missing");
assert.ok(page.includes("PrimarySearch"), "PrimarySearch not rendered on homepage");
for (const banned of [
  "MetaStrip",
  "ChapterDirectory",
  "DecisionFlow",
  "Featured Operational Cards",
  "source_version",
  "chapter_number",
  "Manual / chapter browser",
]) {
  assert.ok(!page.includes(banned), `homepage still references '${banned}'`);
}
// No guided workflow is deep-linked from the homepage, so nothing unavailable
// can be started here.
assert.ok(!page.includes("/decision?procedure="), "homepage must not deep-link a guided workflow");

// ---- Common tasks: valid, plain-language, safe destinations ----
assert.ok(page.includes("COMMON_TASKS"), "COMMON_TASKS missing");
// Common-task set (kept in sync with app/page.tsx; updated in UX-R1G).
for (const label of [
  "Name correction",
  "Change or cancel a flight",
  "Refund and voucher",
  "Baggage",
  "Check-in",
  "Wheelchair and medical assistance",
  "Travel documents",
  "Flight disruption",
]) {
  assert.ok(page.includes(label), `common task '${label}' missing`);
}
// Task destinations resolve only to a published procedure or a search query.
assert.ok(page.includes("/procedure/${task.slug}"), "task should link to a published procedure");
assert.ok(page.includes("/search?q=${encodeURIComponent(task.query)}"), "task should fall back to search");
assert.ok(
  page.includes('.eq("is_published", true)') && page.includes('.eq("review_status", "approved")'),
  "homepage must gate procedure deep-links on published+approved"
);

// ---- Primary search reuses the existing search route via a real GET form ----
assert.ok(primarySearch.includes('action="/search"') && primarySearch.includes('method="get"'), "PrimarySearch must GET /search");
assert.ok(primarySearch.includes('name="q"'), "PrimarySearch input must be named q");
assert.ok(primarySearch.includes('href="/decision"') || primarySearch.includes('href={"/decision"}') || primarySearch.includes("/decision"), "guided decision secondary action missing");
assert.ok(primarySearch.includes("prefers-reduced-motion"), "PrimarySearch must respect reduced motion");

// ---- Design-system foundations ----
assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"), "reduced-motion CSS missing");
assert.ok(css.includes(".touch-target"), "touch-target utility missing");
assert.ok(css.includes("--color-primary"), "agent primary token missing");

console.log("Agent UI checks passed.");
