// Agent action / link guardrails (UX-R1F). Static assertions that every agent
// action points at a real route and no dead source fragment remains.
// Run with: node scripts/check-agent-actions.mjs
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const url = (p) => new URL(`../${p}`, import.meta.url);

const search = read("app/search/page.tsx");
const answer = read("components/agent/OperationalAnswer.tsx");
const procedure = read("app/procedure/[slug]/page.tsx");

// ---- Source access repaired ----
assert.ok(search.includes('"chapters(slug)"'), "search must select chapters(slug)");
assert.ok(answer.includes("sourceChapterSlug"), "OperationalAnswer must accept sourceChapterSlug");
assert.ok(
  answer.includes("/chapter/${encodeURIComponent(sourceChapterSlug)}"),
  "best-result View source must link to /chapter/<slug>"
);
assert.ok(!answer.includes("#source-references"), "OperationalAnswer must not use the #source-references fragment");
assert.ok(search.includes("/chapter/${encodeURIComponent(sources[0].slug)}"), "no-match source action must use a real chapter route");
assert.ok(!/href="#source-references"/.test(search), "search must not use #source-references as a link action");
assert.ok(
  answer.includes("Source reference is not linked yet.") && procedure.includes("Source reference is not linked yet."),
  "unlinked-source fallback message required on best answer and procedure"
);

// ---- Correct route shapes ----
assert.ok(answer.includes("/procedure/${slug}"), "procedure links must use /procedure/<slug>");
assert.ok(answer.includes("/decision?procedure=${encodeURIComponent(slug)}"), "guided links must use /decision?procedure=<slug>");
for (const f of [search, procedure]) {
  assert.ok(f.includes("/chapter/"), "chapter links must use /chapter/<slug>");
}

// ---- No undefined/null in generated hrefs across agent surfaces ----
const AGENT_FILES = [
  "app/page.tsx",
  "app/search/page.tsx",
  "app/procedure/[slug]/page.tsx",
  "app/decision/page.tsx",
  "app/services/page.tsx",
  "app/chapter/[slug]/page.tsx",
  "components/agent/OperationalAnswer.tsx",
  "components/agent/RelatedProcedures.tsx",
  "components/agent/SourceReferences.tsx",
  "components/agent/ProcedureQuickAnswer.tsx",
  "components/agent/TaskShortcut.tsx",
  "components/decision/DecisionIntake.tsx",
  "components/decision/QuestionFlow.tsx",
  "components/SiteHeader.tsx",
];
for (const f of AGENT_FILES) {
  const src = read(f);
  for (const bad of ["/undefined", "/null", "procedure=undefined", "procedure=null", "chapter/undefined", "chapter/null"]) {
    assert.ok(!src.includes(bad), `${f} contains a broken href fragment '${bad}'`);
  }
}

// ---- Known agent routes exist under app/ ----
for (const route of [
  "app/page.tsx",
  "app/search/page.tsx",
  "app/procedure/[slug]/page.tsx",
  "app/chapter/[slug]/page.tsx",
  "app/decision/page.tsx",
  "app/services/page.tsx",
  "app/account/page.tsx",
  "app/admin/page.tsx",
]) {
  assert.ok(existsSync(url(route)), `missing route ${route}`);
}

console.log("Agent actions checks passed.");
