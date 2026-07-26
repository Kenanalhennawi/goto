// Browse services UI guardrails (UX-R1E). Static assertions.
// Run with: node scripts/check-agent-services-ui.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/services/page.tsx", import.meta.url), "utf8");

// Plain-language categories.
for (const group of [
  "Booking changes",
  "Baggage",
  "Check-in & airport",
  "Medical & assistance",
  "Travel documents",
  "Disruption",
  "Special services",
  "Payment & refunds",
]) {
  assert.ok(page.includes(group), `service group '${group}' missing`);
}

// Shared operational-answer helper reused (no re-derivation) and compact rows.
assert.ok(page.includes("deriveOperationalAnswer"), "must reuse the operational-answer helper");
assert.ok(page.includes("RelatedProcedureRow"), "must reuse the compact procedure row");

// Guided action availability-gated.
assert.ok(page.includes("getWorkflowAvailability"), "guided must be availability-gated");
assert.ok(page.includes("guidedAvailable: availability.available"), "guided flag must come from availability");

// No technical metadata / old chrome.
// (source_version is used only for availability computation, never rendered.)
for (const banned of ["Service Directory", "Back to guide", "service_code", "work area", "Agent services"]) {
  assert.ok(!page.includes(banned), `services page must not include '${banned}'`);
}

// Plain filter + category chips + clear empty state.
assert.ok(page.includes("Filter by name or topic"), "plain filter missing");
assert.ok(page.includes("CategoryChip"), "category filter chips missing");
assert.ok(page.includes("No services match yet"), "empty state missing");

console.log("Agent services UI checks passed.");
