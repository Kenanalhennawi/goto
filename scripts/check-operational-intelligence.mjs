// OI-1 — deterministic Operational Intelligence checks.
// Run with: node scripts/check-operational-intelligence.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const { resolveOperationalIntelligence, conceptExpansionTerms, normalizeQuery } = await import(
  "../lib/operational-intelligence/resolve.ts"
);
const { conceptsForRouter, safeRoutableSlugs, OPERATIONAL_CONCEPTS } = await import(
  "../lib/operational-intelligence/concepts.ts"
);
const { routeIntent } = await import("../lib/decision-engine/router.ts");
const { scoreOperationalCard, buildSearchTerms } = await import("../lib/search.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const r = (q) => resolveOperationalIntelligence(q);
function hasSlug(q, slug) {
  return r(q).candidateSlugs.includes(slug);
}
function onlySlug(q, slug) {
  const res = r(q);
  return res.candidateSlugs.length === 1 && res.candidateSlugs[0] === slug;
}

// ---------------------------------------------------------------------------
// 1. Normalization
// ---------------------------------------------------------------------------
assert.equal(normalizeQuery("  Wheel-Chair  "), "wheel chair", "hyphen/space + collapse");
assert.equal(normalizeQuery("EK OKTB"), "ek oktb", "lowercase");
assert.equal(normalizeQuery("can’t walk"), "can t walk", "curly apostrophe normalized");

// ---------------------------------------------------------------------------
// 2. Safe single-slug synonyms / abbreviations / misspellings
// ---------------------------------------------------------------------------
const SAFE = [
  ["broken leg", "plaster-cast-leg-brace"],
  ["fractured leg", "plaster-cast-leg-brace"],
  ["cast on leg", "plaster-cast-leg-brace"],
  ["wheel chair", "wheelchair"],
  ["cannot walk", "wheelchair"],
  ["wheelchiar", "wheelchair"], // misspelling
  ["wchr", "wheelchair"], // abbreviation
  ["oxygen concentrator", "oxygen"],
  ["oxygen", "oxygen"],
  ["poc", "oxygen"], // abbreviation
  ["oxigen", "oxygen"], // misspelling
  ["wife pregnant", "pregnancy"],
  ["pregnant", "pregnancy"],
  ["service dog", "service-animal"],
  ["guide dog", "service-animal"],
  ["emotional support animal", "service-animal"],
  ["intellectual disability", "dpna"],
  ["lost bag", "worldtracer"],
  ["delayed luggage", "worldtracer"],
  ["baggage protection", "blue-ribbon-bags"],
  ["brb", "blue-ribbon-bags"],
  ["bicycle", "sporting-equipment"],
  ["sporting weapon", "sporting-equipment"],
  ["emirates id", "travel-requirements"],
  ["visa change", "visa-change"],
  ["ok to board", "ok-to-board"],
  ["oktb", "ok-to-board"],
  ["online check in", "check-in-olci"],
  ["masd", "meet-assist"],
  ["business lounge", "business-lounge"],
  ["mct", "minimum-connection-time"],
  ["connection time", "minimum-connection-time"],
  ["booked twice", "duplicate-booking"],
  ["government deal", "government-deals"],
  ["auto split od", "auto-split-od"],
  ["falcon", "falcon-handling"],
  ["death certificate", "death-case"],
  ["human remains", "human-remains"],
  ["meda", "meda"],
  ["extra seat", "extra-seat-cbbg"],
  ["wrong passenger name", "name-correction"],
  ["missed flight", "flight-disruption"],
];
for (const [q, slug] of SAFE) {
  const res = r(q);
  assert.equal(res.safety, "safe", `"${q}" should be safe (got ${res.safety})`);
  assert.ok(onlySlug(q, slug), `"${q}" should resolve only to ${slug} (got ${res.candidateSlugs})`);
  assert.equal(res.ambiguity, false, `"${q}" must not be ambiguous`);
}

// ---------------------------------------------------------------------------
// 3. Ambiguous — multiple candidates, never forced
// ---------------------------------------------------------------------------
const AMBIG = [
  ["visa", ["travel-requirements", "visa-change", "ok-to-board"]],
  ["doctor certificate", ["pregnancy", "meda", "plaster-cast-leg-brace"]],
  ["medical certificate", ["pregnancy", "meda", "plaster-cast-leg-brace"]],
  ["missed connection", ["minimum-connection-time", "flight-disruption"]],
];
for (const [q, slugs] of AMBIG) {
  const res = r(q);
  assert.equal(res.safety, "ambiguous", `"${q}" should be ambiguous`);
  assert.equal(res.ambiguity, true, `"${q}" ambiguity flag`);
  assert.ok(res.candidateSlugs.length > 1, `"${q}" must have multiple candidates`);
  for (const s of slugs) assert.ok(res.candidateSlugs.includes(s), `"${q}" should include ${s}`);
}

// ---------------------------------------------------------------------------
// 4. Unsafe — never route, carries a safe message
// ---------------------------------------------------------------------------
for (const q of ["can passenger enter uae", "can passenger enter dubai", "visa advice", "passenger eligible to enter uae"]) {
  const res = r(q);
  assert.equal(res.safety, "unsafe_immigration", `"${q}" immigration-unsafe`);
  assert.equal(res.candidateSlugs.length, 0, `"${q}" must not route`);
  assert.ok(res.safeMessage && res.safeMessage.length > 0, `"${q}" safe message`);
  assert.equal(conceptExpansionTerms(q).length, 0, `"${q}" no expansion terms`);
}
for (const q of ["is passenger fit to fly", "fit to fly", "medically fit to travel"]) {
  const res = r(q);
  assert.equal(res.safety, "unsafe_medical", `"${q}" medical-unsafe`);
  assert.equal(res.candidateSlugs.length, 0, `"${q}" must not route`);
  assert.ok(res.safeMessage && res.safeMessage.length > 0, `"${q}" safe message`);
}

// ---------------------------------------------------------------------------
// 5. Mandatory NEGATIVE safety cases
// ---------------------------------------------------------------------------
const NO_ROUTE = ["wife", "dog", "cash", "cancel", "medical", "bag", "airport", "broken", "name", "flight", "passenger", "customer", "lounge"];
for (const q of NO_ROUTE) {
  const res = r(q);
  assert.notEqual(res.safety, "safe", `"${q}" must never be a safe single route (got ${res.safety}, ${res.candidateSlugs})`);
  assert.equal(res.candidateSlugs.length, 0, `"${q}" must not produce candidate slugs`);
}
// Explicit false-positive guards
assert.ok(!hasSlug("wife", "pregnancy"), "'wife' must not route to pregnancy");
assert.ok(!hasSlug("dog", "service-animal"), "'dog' must not route to service-animal");
assert.ok(!hasSlug("cash", "worldtracer"), "'cash' must not route to a refund/baggage workflow");
assert.ok(!hasSlug("broken", "plaster-cast-leg-brace"), "'broken' must not route to plaster");
assert.ok(!hasSlug("name", "name-correction"), "'name' must not route to name-correction");
// 'visa' alone is ambiguous, not a single safe route
assert.equal(r("visa").safety, "ambiguous", "'visa' alone must be ambiguous");
// 'oxygen' alone IS allowed
assert.ok(onlySlug("oxygen", "oxygen"), "'oxygen' alone is allowed");

// ---------------------------------------------------------------------------
// 6. Bounded expansion, deduped, no generic tokens
// ---------------------------------------------------------------------------
for (const [q] of [...SAFE, ...AMBIG]) {
  const terms = conceptExpansionTerms(q);
  assert.ok(terms.length <= 8, `"${q}" expansion bounded ≤8`);
  assert.equal(new Set(terms).size, terms.length, `"${q}" expansion deduped`);
  for (const generic of ["wife", "dog", "cash", "bag", "airport", "flight", "passenger", "customer"]) {
    assert.ok(!terms.includes(generic), `"${q}" expansion must not contain generic token '${generic}'`);
  }
}

// ---------------------------------------------------------------------------
// 7. All 26 single-safe workflow concepts are reachable
// ---------------------------------------------------------------------------
const EXPECTED_26 = [
  "name-correction", "duplicate-booking", "auto-split-od", "government-deals", "flight-disruption",
  "wheelchair", "plaster-cast-leg-brace", "oxygen", "pregnancy", "meda", "service-animal", "dpna",
  "death-case", "human-remains", "falcon-handling", "worldtracer", "blue-ribbon-bags", "sporting-equipment",
  "travel-requirements", "visa-change", "ok-to-board", "check-in-olci", "business-lounge", "meet-assist",
  "minimum-connection-time", "extra-seat-cbbg",
];
const routable = safeRoutableSlugs();
assert.equal(EXPECTED_26.length, 26, "expected 26 workflows");
for (const slug of EXPECTED_26) {
  assert.ok(routable.includes(slug), `single-safe concept missing for ${slug}`);
}
// Router intents include every safe slug plus the ambiguous multi-slug concepts.
const routerIntents = conceptsForRouter();
for (const slug of EXPECTED_26) {
  assert.ok(routerIntents.some((i) => i.slugs.includes(slug)), `router intent missing for ${slug}`);
}
// No broad/unsafe concept ever leaks into router intents.
const routerIds = new Set(routerIntents.map((i) => i.intent));
for (const c of OPERATIONAL_CONCEPTS) {
  if (c.safety === "broad" || c.safety.startsWith("unsafe_")) {
    assert.ok(!routerIds.has(c.id), `${c.id} (${c.safety}) must not be a router intent`);
  }
}

// ---------------------------------------------------------------------------
// 8. Router fixtures preserved (defense-in-depth; check-decision.mjs is authority)
// ---------------------------------------------------------------------------
const cards = [
  card("wheelchair", "Wheelchair", "WCHR", ["wheelchair", "wchr"]),
  card("pregnancy", "Pregnancy", null, ["pregnancy", "pregnant"]),
  card("name-correction", "Name Correction", null, ["name correction", "ncfe"]),
  card("sporting-equipment", "Sporting Equipment", "SPEQ", ["speq", "sports"]),
  card("flight-disruption", "Flight Disruption", "FDIS", ["fdis", "disruption"]),
  card("check-in-olci", "Check-in / OLCI", "OLCI", ["olci", "check-in"]),
  card("extra-seat-cbbg", "Extra Seat EXST / CBBG", "EXST", ["exst", "cbbg"]),
  card("falcon-handling", "Falcon Handling", null, ["falcon"]),
  card("minimum-connection-time", "Minimum Connection Time", "MCT", ["mct", "connection"]),
  card("ok-to-board", "OK to Board", "OKTB", ["oktb"]),
];
function card(slug, title, code, keywords) {
  return { id: slug, title, slug, category: "Test", service_code: code, service_type: null, summary: null, keywords, aliases: [], priority: 0 };
}
const primarySlug = (q) => routeIntent(q, cards).primary?.slug ?? null;
assert.equal(primarySlug("passenger cannot walk"), "wheelchair");
assert.equal(primarySlug("pregnant customer"), "pregnancy");
assert.equal(primarySlug("wrong passenger name"), "name-correction");
assert.equal(primarySlug("sporting weapon"), "sporting-equipment");
assert.equal(primarySlug("needs falcon"), "falcon-handling");
assert.equal(primarySlug("connection time"), "minimum-connection-time");
assert.equal(primarySlug("EK OKTB"), "ok-to-board");
assert.equal(primarySlug("wheelchair with battery"), "wheelchair");
assert.equal(routeIntent("passenger cannot walk", cards).confidence, "High confidence");
const missed = routeIntent("customer missed flight after online check-in", cards);
assert.equal(missed.needsClarification, true);
assert.equal(missed.confidence, "Possible workflows");
const gibberish = routeIntent("completely unrelated gibberish zzz", []);
assert.equal(gibberish.primary, null);
assert.equal(gibberish.confidence, "Insufficient verified guidance");

// ---------------------------------------------------------------------------
// 9. Router: unsafe never auto-routes; ambiguous asks to clarify
// ---------------------------------------------------------------------------
const docCards = [
  card("travel-requirements", "Travel Requirements", null, ["emirates id", "residence"]),
  card("visa-change", "Visa Change", null, ["visa change"]),
  card("ok-to-board", "OK to Board", "OKTB", ["oktb"]),
];
const visaRoute = routeIntent("visa", docCards);
assert.equal(visaRoute.needsClarification, true, "'visa' asks to clarify");
const enterUae = routeIntent("can passenger enter uae", docCards);
assert.ok(
  enterUae.matchedConcepts.length === 0,
  "'can passenger enter uae' matches no guided intent (never auto-routes)"
);

// ---------------------------------------------------------------------------
// 10. Search: exact beats synonym; synonym still lifts the intended card
// ---------------------------------------------------------------------------
const plaster = card("plaster-cast-leg-brace", "Plaster Cast and Leg Brace", null, ["plaster cast", "leg brace"]);
const baggage = card("baggage", "Baggage", null, ["baggage"]);
const exactScore = scoreOperationalCard(plaster, "Plaster Cast and Leg Brace");
const synonymScore = scoreOperationalCard(plaster, "fractured leg");
assert.ok(exactScore > synonymScore, "exact title beats synonym for the same card");
// A pure synonym (not in the legacy alias table) still ranks the intended card above an unrelated one.
assert.ok(
  scoreOperationalCard(plaster, "fractured leg") > scoreOperationalCard(baggage, "fractured leg"),
  "synonym lifts the intended card above an unrelated card"
);
// buildSearchTerms stays non-empty and additive for a synonym query.
assert.ok(buildSearchTerms("fractured leg").length > 0, "synonym query yields search terms");

// ---------------------------------------------------------------------------
// 11. Draft/unpublished filters remain enforced (structural)
// ---------------------------------------------------------------------------
const searchPage = read("app/search/page.tsx");
assert.ok(
  searchPage.includes('.eq("is_published", true)') && searchPage.includes('.eq("review_status", "approved")'),
  "search must keep published+approved filtering"
);
// Operational answer still renders before the source references (cards above chapters).
assert.ok(
  searchPage.indexOf("<OperationalAnswer") < searchPage.indexOf("<SourceReferences refs={sources} />"),
  "operational cards render above source chapters"
);
// Safe-message plumbing present. The banner renders only guidance.message (a
// plain sentence) — internal IDs / candidate slugs / scores are never placed in JSX.
assert.ok(searchPage.includes("searchGuidance"), "safe-message guidance wired in");
assert.ok(searchPage.includes("{guidance.message}"), "banner renders the plain guidance message");
for (const leaked of ["{guidance.tone}", "candidateSlugs}", "matchedConceptIds}", "{intel."]) {
  assert.ok(!searchPage.includes(leaked), `search page must not render internal '${leaked}'`);
}

console.log("Operational intelligence checks passed.");
