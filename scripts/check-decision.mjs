// Focused Phase A router checks. Run with: node scripts/check-decision.mjs
import assert from "node:assert/strict";

const { routeIntent } = await import("../lib/decision-engine/router.ts");

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
  return {
    id: slug,
    title,
    slug,
    category: "Test",
    service_code: code,
    service_type: null,
    summary: null,
    keywords,
    aliases: [],
    priority: 0,
  };
}

function primarySlug(query) {
  return routeIntent(query, cards).primary?.slug ?? null;
}

assert.equal(primarySlug("passenger cannot walk"), "wheelchair");
assert.equal(primarySlug("pregnant customer"), "pregnancy");
assert.equal(primarySlug("wrong passenger name"), "name-correction");
assert.equal(primarySlug("sporting weapon"), "sporting-equipment");
assert.equal(primarySlug("needs falcon"), "falcon-handling");
assert.equal(primarySlug("connection time"), "minimum-connection-time");
assert.equal(primarySlug("EK OKTB"), "ok-to-board");
assert.equal(primarySlug("wheelchair with battery"), "wheelchair");

const missed = routeIntent("customer missed flight after online check-in", cards);
assert.equal(missed.needsClarification, true);
assert.ok(
  ["flight-disruption", "check-in-olci"].includes(missed.primary?.slug ?? ""),
  "missed-flight routes to disruption or check-in"
);
assert.equal(missed.confidence, "Possible workflows");

const nothing = routeIntent("completely unrelated gibberish zzz", []);
assert.equal(nothing.primary, null);
assert.equal(nothing.confidence, "Insufficient verified guidance");

const wheelchairResult = routeIntent("passenger cannot walk", cards);
assert.equal(wheelchairResult.confidence, "High confidence");
assert.ok(wheelchairResult.matchedConcepts.some((c) => c.intent === "wheelchair"));

// ---- Phase B: question framework checks ----
const { QUESTION_SETS } = await import("../lib/decision-engine/questions.ts");
const { nextQuestion, missingRequired, validateAnswer } = await import("../lib/decision-engine/session.ts");

const pregnancyQs = QUESTION_SETS["pregnancy"];
assert.equal(nextQuestion(pregnancyQs, {}).id, "pregnancy_type");
assert.equal(nextQuestion(pregnancyQs, { pregnancy_type: "Single" }).id, "pregnancy_week");
assert.equal(nextQuestion(pregnancyQs, { pregnancy_type: "Single", pregnancy_week: 28, certificate_available: true }), null);
assert.equal(missingRequired(pregnancyQs, { pregnancy_type: "Single" }).length, 1);

const weekQ = pregnancyQs.find((q) => q.id === "pregnancy_week");
assert.equal(validateAnswer(weekQ, 28), null);
assert.ok(validateAnswer(weekQ, 99));
assert.ok(validateAnswer(weekQ, "not a number"));
const typeQ = pregnancyQs.find((q) => q.id === "pregnancy_type");
assert.equal(validateAnswer(typeQ, "Single"), null);
assert.ok(validateAnswer(typeQ, "Quadruple"));

// ---- Phase C: pregnancy tree fixtures (verified: GO TO v80.8 ch.42 p.259) ----
const { evaluate } = await import("../lib/decision-engine/evaluator.ts");
const { PREGNANCY_DEFINITION } = await import("../lib/decision-engine/definitions/pregnancy.ts");

function preg(type, week) {
  return evaluate(PREGNANCY_DEFINITION, { pregnancy_type: type, pregnancy_week: week, certificate_available: true });
}
assert.equal(preg("Single", 28).outcome, "Can proceed");
assert.equal(preg("Single", 29).outcome, "Requires document");
assert.equal(preg("Single", 36).outcome, "Requires document");
assert.equal(preg("Single", 37).outcome, "Not permitted");
assert.equal(preg("Multiple", 28).outcome, "Can proceed");
assert.equal(preg("Multiple", 32).outcome, "Requires document");
assert.equal(preg("Multiple", 33).outcome, "Not permitted");
assert.equal(preg("Single", 29).confidence, "Conditional");
assert.equal(preg("Single", 28).confidence, "High confidence");
const incomplete = evaluate(PREGNANCY_DEFINITION, { pregnancy_type: "Single" });
assert.equal(incomplete.outcome, "Insufficient information");
assert.ok(incomplete.missing.length > 0);

console.log("Decision router checks passed.");
