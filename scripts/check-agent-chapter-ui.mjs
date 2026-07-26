// Agent chapter-page UI guardrails (UX-R1E). Static assertions.
// Run with: node scripts/check-agent-chapter-ui.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/chapter/[slug]/page.tsx", import.meta.url), "utf8");
const manual = readFileSync(new URL("../components/chapter/CollapsibleManualContent.tsx", import.meta.url), "utf8");

// Related operational guidance appears BEFORE the manual source.
assert.ok(page.includes("Related operational guidance"), "related guidance section missing");
assert.ok(page.includes("CollapsibleManualContent"), "manual content missing");
assert.ok(
  page.indexOf("Related operational guidance") < page.indexOf("<CollapsibleManualContent"),
  "related guidance must precede the source manual"
);

// Full source manual collapsed by default (opens only on a ?section deep-link).
assert.ok(page.includes("defaultOpen={Boolean(section)}"), "manual must be collapsed unless a section is requested");
assert.ok(!/<details[^>]*\bopen\b(?!=)/.test(manual), "manual disclosure must not be force-open");

// Agent top area: no source version / review status / chapter number badge / old chrome.
assert.ok(page.includes("Source reference"), "'Source reference' explanation missing");
assert.ok(!page.includes("Back to chapters"), "'Back to chapters' must be gone");
assert.ok(!page.includes("Agent operational guide"), "old hero label must be gone");
assert.ok(
  page.indexOf("Source version") > page.indexOf("Related operational guidance"),
  "source version must not appear above the related guidance"
);

// Source fidelity preserved (tabbed content + collapsible manual).
assert.ok(page.includes("ChapterTabbedContent"), "tabbed source content must be preserved");

// Reviewer details are role-gated.
assert.ok(page.includes("canReviewCards ?"), "source details must be role-gated");
assert.ok(page.includes("Source details (reviewers only)"), "reviewer source-details section missing");

// Helpful empty state when nothing is linked.
assert.ok(
  page.includes("No reviewed operational guidance is linked to this source yet."),
  "no-related empty state missing"
);

console.log("Agent chapter UI checks passed.");
