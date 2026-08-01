// OPS-2 — deterministic operational intent resolution (resolver v2).
// Run with: node scripts/check-operational-intent.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const { resolveOperationalIntelligence, normalizeQuery } = await import(
  "../lib/operational-intelligence/resolve.ts"
);
const { OPERATIONAL_CONCEPTS, conceptsForRouter } = await import(
  "../lib/operational-intelligence/concepts.ts"
);
const { TIER_RANK } = await import("../lib/operational-intelligence/types.ts");

const r = (q) => resolveOperationalIntelligence(q);
const topicIds = (q) => r(q).topics.map((t) => t.conceptId);
const routableTopics = (q) => r(q).topics.filter((t) => t.candidateSlugs.length > 0);

// ---------------------------------------------------------------------------
// 1. NO AI / deterministic only
// ---------------------------------------------------------------------------
for (const f of [
  "lib/operational-intelligence/resolve.ts",
  "lib/operational-intelligence/concepts.ts",
  "lib/operational-intelligence/types.ts",
]) {
  // Inspect CODE only — comments may legitimately say "no embeddings".
  const code = read(f)
    .split("\n")
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
    .join("\n")
    .toLowerCase();
  for (const banned of ["openai", "anthropic", "gemini", "ollama", "embedding", "vector", "fetch(", "levenshtein", "http"]) {
    assert.ok(!code.includes(banned), `${f} must not contain '${banned}' in code`);
  }
}
// Same query, same answer (pure).
assert.deepEqual(r("pregnant passenger needs wheelchair"), r("pregnant passenger needs wheelchair"));

// ---------------------------------------------------------------------------
// 2. Priority ladder
// ---------------------------------------------------------------------------
assert.deepEqual(Object.keys(TIER_RANK), [
  "exact_phrase", "abbreviation", "alias", "synonym", "concept", "broad",
]);
assert.equal(r("visa").tier, "exact_phrase", "full-query phrase is the top tier");
assert.equal(r("wchr").tier, "exact_phrase");
assert.equal(r("customer is expecting").tier, "synonym", "synonym tier below concept phrases in-query");
assert.equal(r("passenger has a bicycle").tier, "concept");
assert.equal(r("bag").tier, "broad", "bare generic token is the lowest tier");
// A longer generic phrase must NOT erase a specific concept.
assert.ok(topicIds("lost bag and wheelchair").includes("wheelchair"), "specific topic survives a longer phrase");
// Exact full-query phrase wins outright over a weaker in-query match.
assert.deepEqual(topicIds("visa change"), ["visa-change"], "'visa change' must not stay ambiguous");

// ---------------------------------------------------------------------------
// 3. Single-topic fixtures (required)
// ---------------------------------------------------------------------------
const SINGLE = [
  ["passenger has a bicycle", "sporting-equipment", "sporting-equipment"],
  ["passenger has a firearm", "firearms-ammunition", "firearms-ammunition"],
  ["passenger carrying ammunition", "firearms-ammunition", "firearms-ammunition"],
  ["customer is expecting", "pregnancy", "pregnancy"],
  ["passenger has a plaster cast", "plaster-cast-leg-brace", "plaster-cast-leg-brace"],
  ["unable to check in online", "check-in-olci", "check-in-olci"],
];
for (const [q, concept, slug] of SINGLE) {
  const res = r(q);
  assert.equal(res.topics.length, 1, `"${q}" must be a single topic (got ${topicIds(q)})`);
  assert.equal(res.topics[0].conceptId, concept, `"${q}" concept`);
  assert.deepEqual(res.candidateSlugs, [slug], `"${q}" slug`);
  assert.equal(res.safety, "safe", `"${q}" safety`);
  assert.equal(res.ambiguity, false, `"${q}" must not be ambiguous`);
}
// Television is reference-only (no reviewed card exists): recognised, not routed.
const tv = r("customer carrying a television");
assert.deepEqual(topicIds("customer carrying a television"), ["television-carriage"]);
assert.equal(tv.candidateSlugs.length, 0, "television must not route to a workflow");
assert.equal(tv.safety, "broad");

// ---------------------------------------------------------------------------
// 4. Multi-topic fixtures (required) — never merged, never auto-chosen
// ---------------------------------------------------------------------------
const MULTI = [
  ["pregnant passenger needs wheelchair", ["pregnancy", "wheelchair"]],
  ["lost bag and wheelchair", ["worldtracer", "wheelchair"]],
  ["pregnant with extra seat", ["pregnancy", "extra-seat-cbbg"]],
  ["firearm and oversized baggage", ["firearms-ammunition", "out-of-gauge-baggage"]],
];
for (const [q, expected] of MULTI) {
  const res = r(q);
  assert.ok(res.topics.length >= 2, `"${q}" must detect multiple topics (got ${topicIds(q)})`);
  for (const id of expected) {
    assert.ok(topicIds(q).includes(id), `"${q}" must include topic ${id}`);
  }
  assert.equal(res.ambiguity, true, `"${q}" must be flagged ambiguous`);
  // Bounded + deterministic.
  assert.ok(res.topics.length <= 5, "topics bounded to 5");
  assert.ok(res.candidateSlugs.length <= 5, "candidate slugs bounded to 5");
  assert.deepEqual(topicIds(q), topicIds(q), "ordering is deterministic");
  // No merged outcome: each topic keeps its own slugs.
  for (const t of res.topics) assert.ok(t.candidateSlugs.length <= 5);
}
// Routable topics are ordered before reference-only ones.
assert.equal(r("firearm and oversized baggage").topics[0].conceptId, "firearms-ammunition");
// Two distinct workflows => cockpit shows multiple topics, never one answer.
assert.equal(routableTopics("pregnant passenger needs wheelchair").length, 2);

// ---------------------------------------------------------------------------
// 5. Ambiguous fixtures (required)
// ---------------------------------------------------------------------------
for (const [q, concept] of [
  ["visa", "visa"],
  ["doctor certificate", "medical-certificate"],
  ["missed connection", "missed-connection"],
  ["sporting weapon", "sporting-weapon"],
]) {
  const res = r(q);
  assert.equal(res.safety, "ambiguous", `"${q}" must be ambiguous`);
  assert.equal(res.ambiguity, true);
  assert.deepEqual(topicIds(q), [concept], `"${q}" concept`);
}
assert.equal(r("visa").candidateSlugs.length, 3, "'visa' spans three travel-document workflows");
// A sporting weapon spans ch.28/ch.29 but both are documented on one reviewed card.
assert.deepEqual(r("sporting weapon").candidateSlugs, ["sporting-equipment"]);

// ---------------------------------------------------------------------------
// 6. Unsafe + broad fixtures (required) — mandatory negative guards
// ---------------------------------------------------------------------------
for (const q of ["can passenger enter uae", "visa advice"]) {
  const res = r(q);
  assert.equal(res.safety, "unsafe_immigration", `"${q}" unsafe`);
  assert.equal(res.candidateSlugs.length, 0, `"${q}" must not route`);
  assert.ok(res.safeMessage, `"${q}" safe message`);
}
const fit = r("is passenger fit to fly");
assert.equal(fit.safety, "unsafe_medical");
assert.equal(fit.candidateSlugs.length, 0);

const NO_ROUTE = [
  "dog", "pet", "gate", "boarding", "passport", "connection", "cancel", "medical",
  "bag", "airport", "passenger", "customer", "wife", "cash", "broken", "name",
  "flight", "lounge", "seat", "transit", "interline", "tv", "gun", "ski", "golf", "ssr",
];
for (const q of NO_ROUTE) {
  const res = r(q);
  assert.equal(res.candidateSlugs.length, 0, `"${q}" must never produce candidate slugs`);
  assert.notEqual(res.safety, "safe", `"${q}" must never be a safe single route`);
  assert.equal(res.ambiguity, false, `"${q}" must not be presented as ambiguous`);
}
// Explicit false-positive guards.
assert.ok(!r("wife").candidateSlugs.includes("pregnancy"));
assert.ok(!r("dog").candidateSlugs.includes("service-animal"));
assert.ok(!r("broken").candidateSlugs.includes("plaster-cast-leg-brace"));
assert.ok(!r("name").candidateSlugs.includes("name-correction"));
// Whole-token matching: no substring false positives.
assert.equal(r("broadcast schedule").candidateSlugs.length, 0, "'broadcast' must not match 'cast'");
assert.equal(r("scan the document").candidateSlugs.length, 0, "'scan' must not match 'can'");

// ---------------------------------------------------------------------------
// 7. Abbreviations (required)
// ---------------------------------------------------------------------------
const ABBREV = [
  ["wchr", "wheelchair"], ["wchs", "wheelchair"], ["wchc", "wheelchair"],
  ["dpna", "dpna"], ["meda", "meda"], ["olci", "check-in-olci"],
  ["mct", "minimum-connection-time"], ["bike", "sporting-equipment"],
  ["weap", "firearms-ammunition"], ["brb", "blue-ribbon-bags"], ["maas", "meet-assist"],
];
for (const [abbr, slug] of ABBREV) {
  assert.deepEqual(r(abbr).candidateSlugs, [slug], `abbreviation ${abbr} → ${slug}`);
}
// Reference abbreviations are recognised but never routed (no reviewed card).
for (const [abbr, concept] of [["oogs", "out-of-gauge-baggage"], ["oogl", "out-of-gauge-baggage"], ["tvch", "television-carriage"]]) {
  assert.deepEqual(topicIds(abbr), [concept], `${abbr} recognised`);
  assert.equal(r(abbr).candidateSlugs.length, 0, `${abbr} must stay reference-only`);
}
// WEAP resolves through the Firearms concept, BIKE through sporting equipment.
assert.deepEqual(topicIds("weap"), ["firearms-ammunition"]);
assert.deepEqual(topicIds("bike"), ["sporting-equipment"]);

// ---------------------------------------------------------------------------
// 8. Synonym groups
// ---------------------------------------------------------------------------
for (const [q, concept] of [
  ["ammo", "firearms-ammunition"], ["rifle", "firearms-ammunition"], ["pistol", "firearms-ammunition"],
  ["cycle", "sporting-equipment"], ["push bike", "sporting-equipment"],
  ["expecting", "pregnancy"], ["expectant mother", "pregnancy"],
  ["wheel chair", "wheelchair"], ["wheelchair assistance", "wheelchair"],
  ["plaster", "plaster-cast-leg-brace"], ["cast", "plaster-cast-leg-brace"],
  ["led tv", "television-carriage"], ["flat screen", "television-carriage"],
]) {
  assert.ok(topicIds(q).includes(concept), `synonym "${q}" → ${concept} (got ${topicIds(q)})`);
}

// ---------------------------------------------------------------------------
// 9. Firearms / sporting separation
// ---------------------------------------------------------------------------
const sporting = OPERATIONAL_CONCEPTS.find((c) => c.id === "sporting-equipment");
const firearms = OPERATIONAL_CONCEPTS.find((c) => c.id === "firearms-ammunition");
assert.ok(firearms, "firearms-ammunition concept must exist");
// OPS-2.1: firearms open their own reviewed reference card (ch.29).
assert.deepEqual(firearms.targetSlugs, ["firearms-ammunition"], "firearms target their own reference card");
assert.ok(firearms.chapterHint.includes("29."), "firearms cites ch.29");

// ---- OPS-2.1 required routing fixtures ----
for (const q of ["firearm", "firearms", "ammunition", "ammo", "rifle", "pistol", "weap"]) {
  const res = r(q);
  assert.deepEqual(res.candidateSlugs, ["firearms-ammunition"], `"${q}" must open the Firearms card`);
  assert.deepEqual(topicIds(q), ["firearms-ammunition"], `"${q}" single firearms topic`);
  assert.equal(res.safety, "safe", `"${q}" safety`);
  assert.equal(res.ambiguity, false, `"${q}" must not be ambiguous`);
}
// "sporting weapon" behaviour is unchanged from OPS-2 (deliberately ambiguous).
const spWeapon = r("sporting weapon");
assert.equal(spWeapon.safety, "ambiguous", "'sporting weapon' stays ambiguous");
assert.deepEqual(spWeapon.candidateSlugs, ["sporting-equipment"], "'sporting weapon' target unchanged");
assert.deepEqual(topicIds("sporting weapon"), ["sporting-weapon"]);
// Sporting equipment routing is unchanged.
assert.deepEqual(r("sporting equipment").candidateSlugs, ["sporting-equipment"]);
assert.deepEqual(r("bicycle").candidateSlugs, ["sporting-equipment"]);
// The Firearms reference card carries no decision tree (content card only).
const { DECISION_DEFINITIONS } = await import("../lib/decision-engine/definitions/index.ts");
assert.ok(
  !DECISION_DEFINITIONS["firearms-ammunition"],
  "the Firearms reference card must not gain a decision tree"
);
assert.equal(Object.keys(DECISION_DEFINITIONS).length, 26, "still exactly 26 workflows");
// The seeded card is source-backed and reference-only.
const firearmsSql = read("supabase/seed_ops21_firearms_reference_card.sql");
for (const token of ["'firearms-ammunition'", "AED 300", "WEAP", "4 working days", "5kg", "81.7 (30-Jul-2026)", "array[130, 131, 132]"]) {
  assert.ok(firearmsSql.includes(token), `Firearms card seed missing ${token}`);
}
assert.ok(!/questions|outcome|decision tree|evaluator/i.test(firearmsSql.replace(/--.*$/gm, "")), "seed must not add workflow logic");
for (const t of ["firearm", "firearms", "ammunition"]) {
  assert.ok(!sporting.phrases.includes(t), `sporting-equipment must no longer own '${t}'`);
  assert.ok(firearms.phrases.includes(t), `firearms must own '${t}'`);
}
for (const t of ["bicycle", "bike", "sporting equipment"]) {
  assert.ok(sporting.phrases.includes(t), `sporting-equipment keeps '${t}'`);
}
assert.ok(!JSON.stringify(sporting).toLowerCase().includes("spex"), "SPEX stays retired");
assert.equal(r("spex").candidateSlugs.length, 0, "'spex' must not route");

// ---------------------------------------------------------------------------
// 10. Registry hygiene: no duplicate ids, no phrase owned by two concepts
// ---------------------------------------------------------------------------
const ids = OPERATIONAL_CONCEPTS.map((c) => c.id);
assert.equal(new Set(ids).size, ids.length, "concept ids must be unique");
const owner = new Map();
for (const c of OPERATIONAL_CONCEPTS) {
  for (const term of [...c.phrases, ...(c.aliases ?? []), ...(c.synonyms ?? []), ...(c.abbreviations ?? [])]) {
    const key = normalizeQuery(term);
    // Cross-concept ownership is the real conflict (two concepts claiming the
    // same words); duplicates inside one concept are harmless spelling variants.
    assert.ok(
      !owner.has(key) || owner.get(key) === c.id,
      `term "${key}" is claimed by both ${owner.get(key)} and ${c.id}`
    );
    owner.set(key, c.id);
  }
}
// Broad/unsafe concepts never carry target slugs and never become router intents.
const routerIds = new Set(conceptsForRouter().map((i) => i.intent));
for (const c of OPERATIONAL_CONCEPTS) {
  if (c.safety === "broad" || c.safety.startsWith("unsafe_")) {
    assert.equal(c.targetSlugs.length, 0, `${c.id} must not target a workflow`);
    assert.ok(!routerIds.has(c.id), `${c.id} must not be a router intent`);
  }
}

// ---------------------------------------------------------------------------
// 11. Performance: phrase tables precomputed, bounded work per query
// ---------------------------------------------------------------------------
const resolveSrc = read("lib/operational-intelligence/resolve.ts");
assert.ok(resolveSrc.includes("const TERM_INDEX"), "term index must be precomputed at module load");
assert.ok(
  !/for \(const entry of TERM_INDEX\)[\s\S]{0,400}normalizeQuery\(entry/.test(resolveSrc),
  "the query loop must not re-normalize phrases"
);
const start = Date.now();
for (let i = 0; i < 2000; i++) r("pregnant passenger needs wheelchair and lost baggage");
const ms = Date.now() - start;
assert.ok(ms < 2000, `2000 resolutions should stay well under 2s (took ${ms}ms)`);

console.log(`Operational intent checks passed (2000 resolutions in ${ms}ms).`);
