// Homepage live-usability guardrails (UX-R1G). Static assertions.
// Run with: node scripts/check-agent-home-live-ui.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const page = read("app/page.tsx");
// OPS-1: the homepage search-ahead now lives in the Cockpit search component
// with identical behaviour (same API, bounds, debounce, semantics).
const primary = read("components/agent/CockpitSearch.tsx");
const workspace = read("components/AgentWorkspace.tsx");
const css = read("app/globals.css");
const agentPage = read("components/agent/AgentPage.tsx");

// ---- Wide homepage layout; reading pages keep the default ----
assert.ok(agentPage.includes('width?: "reading" | "wide"'), "AgentPage must expose a width variant");
assert.ok(page.includes('<AgentPage width="wide">'), "homepage must use the wide layout");
for (const f of [
  "app/search/page.tsx",
  "app/procedure/[slug]/page.tsx",
  "app/decision/page.tsx",
  "app/services/page.tsx",
  "app/chapter/[slug]/page.tsx",
]) {
  assert.ok(!read(f).includes('width="wide"'), `${f} must keep the default reading width`);
}
assert.ok(page.includes("lg:grid-cols-4"), "wide task grid (4 cols) missing");

// ---- "What you'll get" reassurance (OPS-1: lives in the Cockpit idle state) ----
const cockpit = read("components/agent/AgentCockpit.tsx");
assert.ok(cockpit.includes("What you"), "'What you'll get' reassurance missing");
for (const item of ["Quick operational answer", "Guided questions when needed", "Original source available"]) {
  assert.ok(cockpit.includes(item), `reassurance item '${item}' missing`);
}

// ---- Common tasks: exactly the 8 approved, no Government deals, safe routing ----
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
// (The word may appear in an explanatory comment; assert it is not a task label.)
assert.ok(!page.includes('label: "Government deals"'), "Government deals must not be a homepage task");
assert.ok(!page.includes("/decision?procedure="), "homepage tasks must never deep-link a guided workflow");
for (const bad of ["/undefined", "/null", "q=undefined", "q=null"]) {
  assert.ok(!page.includes(bad), `homepage contains a broken href fragment '${bad}'`);
}
assert.ok(
  page.includes('.eq("is_published", true)') && page.includes('.eq("review_status", "approved")'),
  "task procedure deep-links must be gated on published+approved"
);

// ---- Adaptive workspace: renders empty message instead of null ----
assert.ok(
  workspace.includes("Your recent procedures and favorites will appear here."),
  "adaptive workspace empty message missing"
);

// ---- Search-ahead behavior ----
assert.ok(primary.includes("/api/search?q="), "search-ahead must use the existing /api/search endpoint");
assert.ok(primary.includes("MIN_CHARS = 3") && primary.includes("< MIN_CHARS"), "minimum-character guard missing");
assert.ok(primary.includes("MAX_SUGGESTIONS = 3") && primary.includes("slice(0, MAX_SUGGESTIONS)"), "3-suggestion limit missing");
assert.ok(primary.includes("setTimeout") && primary.includes("300"), "debounce missing");
assert.ok(primary.includes('event.key === "Escape"') && primary.includes("setOpen(false)"), "Escape-closes behavior missing");
assert.ok(primary.includes('action="/search"') && primary.includes('method="get"'), "normal GET search form must remain");
assert.ok(primary.includes('r.type === "operational_card"'), "preview must use published operational cards only (no chapters)");
assert.ok(!/localStorage|sessionStorage/.test(primary), "search-ahead must not persist the typed scenario");
assert.ok(primary.includes('role="combobox"') && primary.includes('role="listbox"'), "combobox/listbox semantics missing");

// ---- No old metadata panels return to the homepage ----
for (const banned of ["MetaStrip", "ChapterDirectory", "DecisionFlow", "Featured Operational Cards", "source_version", "chapter_number", "Manual / chapter browser"]) {
  assert.ok(!page.includes(banned), `homepage must not reintroduce '${banned}'`);
}

// ---- Sidebar width + content offset consistent ----
assert.ok(css.includes("width: 212px") && css.includes("padding-left: 212px"), "sidebar width and content offset must match");

// ---- Signed-out access explicitly documented (not silently changed) ----
assert.ok(page.includes("SIGNED-OUT ACCESS"), "signed-out access must be documented in the homepage");

console.log("Agent home live UI checks passed.");
