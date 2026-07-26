// Final Agent Mode regression guardrails (UX-R1E). Static, cross-page.
// Run with: node scripts/check-agent-regression-ui.mjs
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// In-use agent surfaces only (SearchBar is unused and intentionally left as-is).
const AGENT_FILES = [
  "app/page.tsx",
  "app/search/page.tsx",
  "app/procedure/[slug]/page.tsx",
  "app/decision/page.tsx",
  "app/services/page.tsx",
  "app/chapter/[slug]/page.tsx",
  "components/SiteHeader.tsx",
  "components/CommandPalette.tsx",
  "components/agent/AgentPage.tsx",
];
const sources = Object.fromEntries(AGENT_FILES.map((f) => [f, read(f)]));

// ---- Old / technical labels absent from Agent Mode ----
const BANNED = [
  "Back to chapters",
  "Command center",
  "Service Directory",
  "Open Decision Assistant",
  "Manual browser",
  "Workflow directory",
  "Agent operational guide",
];
for (const [file, src] of Object.entries(sources)) {
  for (const label of BANNED) {
    assert.ok(!src.includes(label), `${file} still contains banned label '${label}'`);
  }
}

// ---- Navigation wording is the new plain-language set ----
const header = sources["components/SiteHeader.tsx"];
for (const label of ['label: "Home"', 'label: "Search"', 'label: "Guided decision"', 'label: "Browse services"']) {
  assert.ok(header.includes(label), `nav missing ${label}`);
}
assert.ok(header.includes('label: "Admin"') && header.includes("canAccessAdmin"), "single gated Admin entry required");

// ---- Palette group labels cleaned ----
const palette = sources["components/CommandPalette.tsx"];
assert.ok(!palette.includes('"Operational cards"'), "palette group 'Operational cards' must be renamed");
assert.ok(!palette.includes('"Source chapters"'), "palette group 'Source chapters' must be renamed");

// ---- Guided actions availability-gated on every surface that offers them ----
for (const file of [
  "app/search/page.tsx",
  "app/procedure/[slug]/page.tsx",
  "app/services/page.tsx",
  "app/chapter/[slug]/page.tsx",
]) {
  assert.ok(sources[file].includes("getWorkflowAvailability"), `${file} must gate guided on availability`);
}

// ---- Required internal disclaimer remains ----
assert.ok(
  sources["components/agent/AgentPage.tsx"].includes("Internal flydubai Contact Centre reference"),
  "internal-use disclaimer must remain"
);

// ---- Design-system foundations remain ----
const css = read("app/globals.css");
assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"), "reduced-motion CSS missing");
assert.ok(css.includes(".touch-target"), "touch-target utility missing");

// ---- Admin tools untouched / still present ----
assert.ok(existsSync(new URL("../app/admin/workflows/page.tsx", import.meta.url)), "Admin Workflow QA must remain");
assert.ok(read("app/admin/workflows/page.tsx").includes("Decision workflow QA"), "Admin Workflow QA content must remain");

console.log("Agent regression UI checks passed.");
