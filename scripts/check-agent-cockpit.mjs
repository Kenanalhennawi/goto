// OPS-1 — Conversation-driven Agent Cockpit guardrails.
// Static source assertions + a runtime check of the classification inputs.
// Run with: node scripts/check-agent-cockpit.mjs
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));

const page = read("app/page.tsx");
const cockpit = read("components/agent/AgentCockpit.tsx");
const search = read("components/agent/CockpitSearch.tsx");
const suggestions = read("components/agent/CockpitSuggestions.tsx");
const answer = read("components/agent/CockpitAnswer.tsx");
const guided = read("components/agent/CockpitGuidedFlow.tsx");
const api = read("app/api/search/route.ts");
const all = page + cockpit + search + suggestions + answer + guided;

// ---- Mounting & heading ----
assert.ok(page.includes("<AgentCockpit"), "AgentCockpit must mount on /");
assert.ok(page.includes("What is the customer asking about?"), "single h1 must remain on the page");
assert.ok(!cockpit.includes("<h1"), "AgentCockpit must not add a second h1");

// ---- State model ----
for (const stage of ['"idle"', '"suggestions"', '"answer"', '"decision"']) {
  assert.ok(cockpit.includes(`stage: ${stage}`), `state model missing stage ${stage}`);
}
assert.ok(!cockpit.includes('stage: "outcome"'), "QuestionFlow owns the outcome — no outcome stage");

// ---- Search behaviour ----
assert.ok(search.includes("/api/search?q="), "Cockpit search must use the existing /api/search");
assert.ok(search.includes("/search?q=${encodeURIComponent"), "Search all results must hand off to /search?q=");
assert.ok(search.includes("Search all results"), "'Search all results' action missing");
assert.ok(suggestions.includes("Search all results"), "suggestions panels must keep Search all results");
// No raw-scenario persistence anywhere in the cockpit.
assert.ok(!/localStorage|sessionStorage/.test(cockpit + search + suggestions + answer + guided), "cockpit must not persist the scenario");

// ---- API additive change ----
assert.ok(api.includes('"chapters(slug)"'), "API select must include chapters(slug)");
assert.ok(api.includes("chapter_slug"), "API must expose a normalized chapter_slug");
assert.ok(api.includes('.eq("is_published", true)') && api.includes('.eq("review_status", "approved")'), "published+approved filter must remain");

// ---- Answer reuse & gating ----
assert.ok(answer.includes("deriveOperationalAnswer"), "CockpitAnswer must reuse deriveOperationalAnswer");
assert.ok(answer.includes("getWorkflowAvailability"), "guided start must be availability-gated");
assert.ok(answer.includes("availability.available") && answer.includes("Start guided questions"), "guided action must be shown only when available");
assert.ok(answer.includes("Need more certainty?"), "'Need more certainty?' prompt missing");
assert.ok(!answer.includes("/decision?procedure="), "cockpit must not route to /decision?procedure=");
assert.ok(answer.includes("/procedure/${result.slug}"), "full-procedure link must use /procedure/<slug>");
assert.ok(answer.includes("/chapter/${encodeURIComponent(result.chapterSlug)}"), "source link must use /chapter/<slug>");
assert.ok(answer.includes("Source reference is not linked yet."), "quiet no-source text missing");
// No internal metadata rendered.
for (const banned of ["review_status", "source_version}", "rank", "score", "matchedConceptIds"]) {
  assert.ok(!answer.includes(`{${banned}`), `CockpitAnswer must not render internal '${banned}'`);
}

// ---- Ambiguity / unsafe / multi-topic / fallback ----
assert.ok(cockpit.includes('startsWith("unsafe_")'), "unsafe queries must use OI safety");
assert.ok(cockpit.includes("resolveOperationalIntelligence"), "classification must use the OI resolver");
assert.ok(suggestions.includes("Multiple topics detected"), "multi-topic heading missing");
assert.ok(suggestions.includes("Possible matches"), "ambiguous heading missing");
assert.ok(suggestions.includes("No reviewed operational answer was found."), "no-match fallback missing");
assert.ok(suggestions.includes("Open source reference"), "source fallback link missing");
assert.ok(cockpit.includes('kind: "network-failure"'), "network-failure state missing");
assert.ok(suggestions.includes("/chapter/${encodeURIComponent(variant.firstChapterSlug)}"), "fallback source link must use a real chapter slug");

// ---- Lazy guided flow ----
assert.ok(cockpit.includes('dynamic(() => import("./CockpitGuidedFlow")'), "QuestionFlow must be lazy-loaded");
assert.ok(cockpit.includes('dynamic(() => import("./CockpitAnswer")'), "answer chunk (availability/registry) must be lazy-loaded");
// Inspect real import statements (comments may mention module names).
const initialImports = [cockpit, search, suggestions]
  .flatMap((src) => src.match(/^import[^;]+;$/gm) ?? [])
  .join("\n");
for (const heavy of ["decision-engine/definitions", "decision-engine/questions", "decision-engine/evaluator", "decision-engine/availability", "components/decision/QuestionFlow"]) {
  assert.ok(!initialImports.includes(heavy), `initial cockpit bundle must not import ${heavy}`);
}
assert.ok(guided.includes("QuestionFlow") && guided.includes("QUESTION_SETS"), "guided wrapper must reuse QuestionFlow + QUESTION_SETS");
assert.ok(guided.includes("key={result.slug}"), "QuestionFlow must be keyed by slug");
for (const prop of ["procedureSlug", "procedureTitle", "questions", "cardSourceVersion", "cardChapterSlug", "onClose"]) {
  assert.ok(guided.includes(prop), `guided wrapper missing QuestionFlow prop ${prop}`);
}
// Guided mounts only in the decision stage (explicit user action).
assert.ok(cockpit.includes('state.stage === "decision" ?') || cockpit.includes('{state.stage === "decision"'), "guided flow must mount only in the decision stage");
// Closing guided returns to the answer, not idle.
assert.ok(cockpit.includes('onClose={() => setState({ ...state, stage: "answer" })}'), "closing guided must return to the answer");

// ---- Search another issue ----
assert.ok(cockpit.includes("Search another issue") || suggestions.includes("Search another issue") || answer.includes("Search another issue"), "'Search another issue' missing");
assert.ok(cockpit.includes('setState({ stage: "idle" })'), "reset must clear cockpit state");
assert.ok(cockpit.includes("inputRef.current?.focus()"), "reset must focus the scenario input");

// ---- Standalone routes still exist ----
for (const route of ["app/search/page.tsx", "app/procedure/[slug]/page.tsx", "app/decision/page.tsx", "app/chapter/[slug]/page.tsx", "app/services/page.tsx"]) {
  assert.ok(exists(route), `standalone route ${route} must remain`);
}

// ---- No Call Summary / CRM / customer fields / AI ----
for (const banned of ["Call summary", "Call Summary", "CRM", "callSummary", "passenger name", "passportNumber", "ticket number", 'name="pnr"', 'name="email"', 'name="phone"', "openai", "anthropic", "embedding"]) {
  assert.ok(!all.includes(banned), `cockpit must not contain '${banned}'`);
}

// ---- No old dashboard metadata ----
for (const banned of ["MetaStrip", "ChapterDirectory", "Featured Operational Cards", "chapter_number", "source_confidence"]) {
  assert.ok(!all.includes(banned), `old dashboard element '${banned}' must not return`);
}

// ---- Accessibility & mobile ----
assert.ok(search.includes('role="combobox"') && search.includes('role="listbox"'), "combobox/listbox semantics missing");
assert.ok(all.includes("touch-target"), "44px touch targets missing");
assert.ok(all.includes('aria-live="polite"'), "aria-live status missing");
assert.ok(answer.includes("tabIndex={-1}") && answer.includes("headingRef"), "answer heading focus missing");
assert.ok(search.includes('event.key === "Escape"'), "Escape must close suggestions");
assert.ok(/sm:flex-row|sm:grid-cols/.test(search + answer), "mobile-first stacking classes missing");

// ---- STAB-1 hook safety carried over ----
assert.ok(search.includes("if (trimmed.length < MIN_CHARS) return;"), "no synchronous short-query reset inside the effect");
assert.ok(search.includes("const belowMin ="), "derived belowMin guard missing");
assert.ok(!all.includes("eslint-disable"), "no eslint-disable in cockpit files");

// ---- Runtime: classification inputs behave (OI resolver contract) ----
const { resolveOperationalIntelligence } = await import("../lib/operational-intelligence/resolve.ts");
const unsafe = resolveOperationalIntelligence("can passenger enter uae");
assert.ok(unsafe.safety.startsWith("unsafe_") && unsafe.safeMessage, "unsafe query must carry a safe message");
const multi = resolveOperationalIntelligence("pregnant and needs wheelchair");
assert.ok(multi.ambiguity && multi.candidateSlugs.length > 1, "multi-topic query must yield multiple candidates");
assert.ok(multi.matchedConceptIds.length > 1, "multi-topic query must match multiple concepts");
const ambiguous = resolveOperationalIntelligence("visa");
assert.ok(ambiguous.ambiguity && ambiguous.matchedConceptIds.length === 1, "'visa' must be single-concept ambiguous");
const strong = resolveOperationalIntelligence("broken leg");
assert.equal(strong.safety, "safe", "'broken leg' must remain a safe single route");

console.log("Agent cockpit checks passed.");
