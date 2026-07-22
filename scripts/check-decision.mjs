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

// ---- Phase D: five operational decision trees (verified: GO TO v81.2) ----
const { DECISION_DEFINITIONS, sourceVersionMatches } = await import(
  "../lib/decision-engine/definitions/index.ts"
);

for (const slug of [
  "pregnancy",
  "sporting-equipment",
  "check-in-olci",
  "flight-disruption",
  "extra-seat-cbbg",
  "minimum-connection-time",
]) {
  assert.ok(DECISION_DEFINITIONS[slug], `definition registered for ${slug}`);
  assert.ok(DECISION_DEFINITIONS[slug].sourcePages.length > 0, `source pages for ${slug}`);
  assert.ok(DECISION_DEFINITIONS[slug].sourceVersion, `source version for ${slug}`);
}

// Every rule in every Phase D definition carries source evidence.
for (const definition of Object.values(DECISION_DEFINITIONS)) {
  for (const rule of definition.rules) {
    const pages = rule.sourcePages ?? definition.sourcePages;
    assert.ok(pages.length > 0, `rule ${definition.procedureSlug}/${rule.id} has source pages`);
    assert.ok(rule.explanation.length > 0, `rule ${definition.procedureSlug}/${rule.id} has explanation`);
  }
}

// Freshness guard.
assert.equal(sourceVersionMatches("81.2", "81.2 (10-Jul-2026)"), true);
assert.equal(sourceVersionMatches("80.8", "81.2 (10-Jul-2026)"), false);
assert.equal(sourceVersionMatches(null, "81.2 (10-Jul-2026)"), false);

/** Shared helper: evaluate and assert the matched rule, outcome and confidence. */
function expectRule(definition, answers, ruleId, outcome, confidence) {
  const result = evaluate(definition, answers);
  assert.equal(result.matchedRuleId, ruleId, `${definition.procedureSlug}: rule ${ruleId} (got ${result.matchedRuleId})`);
  assert.equal(result.outcome, outcome, `${definition.procedureSlug}/${ruleId}: outcome`);
  assert.equal(result.confidence, confidence, `${definition.procedureSlug}/${ruleId}: confidence`);
  assert.ok(result.rulePages && result.rulePages.length > 0, `${definition.procedureSlug}/${ruleId}: source evidence`);
  return result;
}

// ---- Sporting Equipment (v81.2 ch.28 pp.126-131) ----
const SPEQ = DECISION_DEFINITIONS["sporting-equipment"];
const speqBase = {
  speq_request: "New equipment booking",
  equipment_kind: "Standard sporting equipment",
  total_dimension_cm: 170,
  equipment_count: 1,
  hours_before_departure: 48,
  journey_type: "Point-to-point",
};
// standard equipment with sufficient notice
expectRule(SPEQ, speqBase, "standard-24h-plus-speq", "Can proceed", "High confidence");
expectRule(
  SPEQ,
  { ...speqBase, total_dimension_cm: 120 },
  "standard-24h-plus-free-size",
  "Can proceed",
  "High confidence"
);
expectRule(
  SPEQ,
  { ...speqBase, total_dimension_cm: 300 },
  "standard-24h-plus-spex",
  "Can proceed",
  "High confidence"
);
// sporting weapon below 96 hours
expectRule(
  SPEQ,
  { ...speqBase, equipment_kind: "Sporting weapon, firearm or ammunition", hours_before_departure: 95 },
  "weapon-under-96h",
  "Not permitted",
  "High confidence"
);
// item longer than 350 cm below 48 hours
expectRule(
  SPEQ,
  { ...speqBase, total_dimension_cm: 400, hours_before_departure: 40 },
  "over-350cm-under-48h",
  "Not permitted",
  "High confidence"
);
// more than 10 pieces
expectRule(
  SPEQ,
  { ...speqBase, equipment_count: 11 },
  "over-10-pieces",
  "Requires supervisor",
  "Conditional"
);
// refund request inside restricted window
expectRule(
  SPEQ,
  { ...speqBase, speq_request: "Cancel or refund an existing equipment fee", hours_before_departure: 10 },
  "refund-inside-24h",
  "Not permitted",
  "High confidence"
);
// supervisor late-add window and go-show
expectRule(
  SPEQ,
  { ...speqBase, hours_before_departure: 15 },
  "standard-12-to-24h",
  "Requires supervisor",
  "Conditional"
);
expectRule(
  SPEQ,
  { ...speqBase, hours_before_departure: 5 },
  "standard-under-12h-goshow",
  "Can proceed with conditions",
  "Conditional"
);
// interline escalation
expectRule(
  SPEQ,
  { ...speqBase, journey_type: "Interline or codeshare" },
  "interline-codeshare",
  "Requires supervisor",
  "Conditional"
);

// ---- Check-in / OLCI (v81.2 ch.55 pp.282-285) ----
const OLCI = DECISION_DEFINITIONS["check-in-olci"];
const olciBase = {
  olci_goal: "Complete online check-in",
  checkin_state: "Not checked in",
  minutes_to_departure: 300,
  card_verification: false,
  has_exst_cbbg: false,
};
// eligible online-check-in window
expectRule(OLCI, olciBase, "olci-eligible-window", "Can proceed", "High confidence");
// inside 75 minutes
expectRule(
  OLCI,
  { ...olciBase, minutes_to_departure: 70 },
  "olci-closed-under-75min",
  "Can proceed with conditions",
  "Conditional"
);
// post-OLCI cancellation before offload deadline
expectRule(
  OLCI,
  {
    ...olciBase,
    olci_goal: "Modify or cancel after online check-in",
    checkin_state: "Checked in online",
    minutes_to_departure: 120,
  },
  "offload-before-deadline",
  "Requires supervisor",
  "Conditional"
);
// too late for offload
expectRule(
  OLCI,
  {
    ...olciBase,
    olci_goal: "Modify or cancel after online check-in",
    checkin_state: "Checked in online",
    minutes_to_departure: 45,
  },
  "offload-too-late",
  "Not permitted",
  "High confidence"
);
// passenger checked in at airport
expectRule(
  OLCI,
  {
    ...olciBase,
    olci_goal: "Modify or cancel after online check-in",
    checkin_state: "Checked in at the airport",
  },
  "offload-airport-checked-in",
  "Not permitted",
  "High confidence"
);
// request to add SSR after OLCI
expectRule(
  OLCI,
  { ...olciBase, olci_goal: "Add an SSR after check-in", checkin_state: "Checked in online" },
  "ssr-after-checkin",
  "Not permitted",
  "High confidence"
);
// card-verification exclusion
expectRule(
  OLCI,
  { ...olciBase, card_verification: true },
  "olci-card-verification-block",
  "Can proceed with conditions",
  "Conditional"
);

// ---- Flight Disruption (v81.2 ch.71 pp.329-340) ----
const FDIS = DECISION_DEFINITIONS["flight-disruption"];
const fdisBase = {
  fdis_popup: "No pop-up",
  booking_channel: "Direct flydubai channel",
  request: "Rebooking",
  olci_done: false,
  hours_to_departure: 48,
  refund_zone: "Not shown / unknown",
};
// pop-up available
expectRule(
  FDIS,
  { ...fdisBase, fdis_popup: "Disruption pop-up available" },
  "popup-available",
  "Can proceed with conditions",
  "Conditional"
);
// no pop-up / no validated free option (after OLCI)
expectRule(
  FDIS,
  { ...fdisBase, olci_done: true },
  "rebooking-after-olci-validate",
  "Requires supervisor",
  "Conditional"
);
// travel-agent-issued (GDS/OAL) ticket: refund goes to ticket issuer
expectRule(
  FDIS,
  {
    ...fdisBase,
    booking_channel: "GDS / interline / codeshare (TA or OAL system)",
    request: "Refund or voucher",
  },
  "interline-refund-ticket-issuer",
  "Can proceed with conditions",
  "Conditional"
);
// interline rebooking inside/outside 72 hours
expectRule(
  FDIS,
  { ...fdisBase, booking_channel: "GDS / interline / codeshare (TA or OAL system)", hours_to_departure: 48 },
  "interline-rebooking-within-72h",
  "Requires supervisor",
  "Conditional"
);
expectRule(
  FDIS,
  { ...fdisBase, booking_channel: "GDS / interline / codeshare (TA or OAL system)", hours_to_departure: 96 },
  "interline-rebooking-outside-72h",
  "Can proceed with conditions",
  "Conditional"
);
// self-service available
expectRule(FDIS, fdisBase, "direct-self-service", "Can proceed with conditions", "Conditional");
// refund/voucher scenario with insufficient context (zone unknown)
expectRule(
  FDIS,
  { ...fdisBase, request: "Refund or voucher" },
  "refund-zone-unknown",
  "Insufficient information",
  "Insufficient information"
);
// zonal refunds
expectRule(
  FDIS,
  { ...fdisBase, request: "Refund or voucher", refund_zone: "Green" },
  "refund-green-zone",
  "Can proceed with conditions",
  "Conditional"
);
expectRule(
  FDIS,
  { ...fdisBase, request: "Refund or voucher", refund_zone: "Red or Amber" },
  "refund-red-amber-zone",
  "Can proceed with conditions",
  "Conditional"
);
// "Flight not cancelled Changes" pop-up
expectRule(
  FDIS,
  { ...fdisBase, fdis_popup: "'Flight not cancelled Changes' pop-up" },
  "popup-flight-not-cancelled",
  "Requires supervisor",
  "Conditional"
);

// ---- Extra Seat / CBBG (v81.2 ch.33 pp.160-163) ----
const EXST = DECISION_DEFINITIONS["extra-seat-cbbg"];
const exstBase = {
  seat_request: "EXST (comfort)",
  cabin_class: "Economy",
  seat_count: 1,
  item_weight_kg: 0,
  can_secure: true,
  seat_rows: "Standard rows",
  checkin_status: "Not checked in",
  hours_before_departure: 24,
  booking_channel: "Direct / TA",
  meda_case: false,
};
// eligible EXST
expectRule(EXST, exstBase, "exst-proceed", "Can proceed", "High confidence");
// CBBG requested in Business Class
expectRule(
  EXST,
  { ...exstBase, seat_request: "CBBG (cabin baggage seat)", cabin_class: "Business" },
  "cbbg-business-block",
  "Not permitted",
  "High confidence"
);
// CBBG over verified weight
expectRule(
  EXST,
  { ...exstBase, seat_request: "CBBG (cabin baggage seat)", item_weight_kg: 80 },
  "cbbg-over-75kg",
  "Not permitted",
  "High confidence"
);
// checked-in passenger
expectRule(
  EXST,
  { ...exstBase, checkin_status: "Checked in" },
  "already-checked-in",
  "Not permitted",
  "High confidence"
);
// quantity limit exceeded
expectRule(
  EXST,
  { ...exstBase, seat_count: 3 },
  "exst-quantity-limit",
  "Not permitted",
  "High confidence"
);
expectRule(
  EXST,
  { ...exstBase, seat_request: "CBBG (cabin baggage seat)", seat_count: 2 },
  "cbbg-quantity-limit",
  "Not permitted",
  "High confidence"
);
// eligible CBBG, GDS handling, interline block, deadline missed, MEDA
expectRule(
  EXST,
  { ...exstBase, seat_request: "CBBG (cabin baggage seat)", item_weight_kg: 40 },
  "cbbg-proceed",
  "Can proceed",
  "High confidence"
);
expectRule(
  EXST,
  { ...exstBase, booking_channel: "GDS" },
  "gds-separate-pnr",
  "Can proceed with conditions",
  "Conditional"
);
expectRule(
  EXST,
  { ...exstBase, booking_channel: "Interline or codeshare" },
  "interline-not-permitted",
  "Not permitted",
  "High confidence"
);
expectRule(
  EXST,
  { ...exstBase, hours_before_departure: 1 },
  "deadline-missed-goshow",
  "Can proceed with conditions",
  "Conditional"
);
expectRule(EXST, { ...exstBase, meda_case: true }, "meda-approval", "Requires document", "Conditional");

// ---- Minimum Connection Time (v81.2 ch.25 p.102) ----
const MCT = DECISION_DEFINITIONS["minimum-connection-time"];
const mctBase = {
  arrival_terminal: "T2",
  departure_terminal: "T2",
  carrier_pair: "FZ-FZ",
  connection_minutes: 60,
};
// exact minimum
const mctExact = expectRule(MCT, mctBase, "t2-t2-fz-fz-meets", "Can proceed with conditions", "Conditional");
assert.ok(mctExact.derived && mctExact.derived.includes("difference +0 min"), "MCT derived difference at exact minimum");
// above minimum
const mctAbove = expectRule(
  MCT,
  { ...mctBase, connection_minutes: 90 },
  "t2-t2-fz-fz-meets",
  "Can proceed with conditions",
  "Conditional"
);
assert.ok(mctAbove.derived.includes("difference +30 min"), "MCT derived above minimum");
// below minimum
const mctBelow = expectRule(
  MCT,
  { ...mctBase, connection_minutes: 45 },
  "t2-t2-fz-fz-below",
  "Not permitted",
  "High confidence"
);
assert.ok(mctBelow.derived.includes("difference -15 min"), "MCT derived below minimum");
// terminal/carrier exception (T3-T1 FZ-SQ 150, incl. vice versa)
expectRule(
  MCT,
  { arrival_terminal: "T3", departure_terminal: "T1", carrier_pair: "FZ-SQ", connection_minutes: 150 },
  "t3-t1-fz-sq-meets",
  "Can proceed with conditions",
  "Conditional"
);
expectRule(
  MCT,
  { arrival_terminal: "T1", departure_terminal: "T3", carrier_pair: "FZ-SQ", connection_minutes: 149 },
  "t1-t3-fz-sq-below",
  "Not permitted",
  "High confidence"
);
// directional PR exception
expectRule(
  MCT,
  { arrival_terminal: "T1", departure_terminal: "T2", carrier_pair: "PR-FZ", connection_minutes: 150 },
  "t1-t2-pr-fz-meets",
  "Can proceed with conditions",
  "Conditional"
);
// missing terminal information
const mctMissing = evaluate(MCT, { carrier_pair: "FZ-FZ", connection_minutes: 60 });
assert.equal(mctMissing.outcome, "Insufficient information");
assert.equal(mctMissing.confidence, "Insufficient information");
assert.ok(mctMissing.missing.length >= 2, "missing terminal answers reported");
// pairing not in published table -> no unsupported outcome is generated
const mctUnknown = evaluate(MCT, {
  arrival_terminal: "T1",
  departure_terminal: "T1",
  carrier_pair: "FZ-FZ",
  connection_minutes: 600,
});
assert.equal(mctUnknown.outcome, "Insufficient information");
assert.equal(mctUnknown.matchedRuleId, null);

// No unsupported outcome: unanswered combinations never produce a decision.
const speqUnanswered = evaluate(SPEQ, { speq_request: "New equipment booking" });
assert.equal(speqUnanswered.outcome, "Insufficient information");
assert.equal(speqUnanswered.matchedRuleId, null);

// ---- Phase E: guided-decision availability layer ----
const { getWorkflowAvailability, hasDecisionTree } = await import(
  "../lib/decision-engine/availability.ts"
);

// Supported + available (card approved, published, version matches tree).
const availSpeq = getWorkflowAvailability({
  slug: "sporting-equipment",
  is_published: true,
  review_status: "approved",
  source_version: "81.2 (10-Jul-2026)",
});
assert.equal(availSpeq.status, "available");
assert.equal(availSpeq.available, true);
assert.equal(availSpeq.hasTree, true);
assert.equal(availSpeq.href, "/decision?procedure=sporting-equipment");
assert.equal(availSpeq.adminReason, null);

// Supported but unpublished / not approved.
const availUnpub = getWorkflowAvailability({
  slug: "sporting-equipment",
  is_published: false,
  review_status: "needs_review",
  source_version: "81.2",
});
assert.equal(availUnpub.status, "unavailable_unpublished");
assert.equal(availUnpub.available, false);
assert.equal(availUnpub.adminReason, "Card not published");
// Ordinary agents only ever see the safe message, never internal metadata.
assert.equal(availUnpub.safeMessage, "Guided decision is temporarily unavailable. Use the operational card.");

// Supported but source-version mismatch (card still at 80.8, tree at 81.2).
const availMismatch = getWorkflowAvailability({
  slug: "sporting-equipment",
  is_published: true,
  review_status: "approved",
  source_version: "80.8 (23-Jun-2026)",
});
assert.equal(availMismatch.status, "unavailable_source_mismatch");
assert.equal(availMismatch.adminReason, "Source version requires review");

// Supported but source updated after review (stale under freshness rules).
const availStale = getWorkflowAvailability({
  slug: "sporting-equipment",
  is_published: true,
  review_status: "approved",
  source_version: "81.2",
  last_reviewed_at: "2026-07-10T00:00:00.000Z",
  chapters: { source_version: "81.2", updated_at: "2026-07-15T00:00:00.000Z" },
});
assert.equal(availStale.status, "unavailable_source_stale");
assert.equal(availStale.adminReason, "Source updated after review");

// Unsupported procedure slug (no deterministic tree): no entry point at all.
// ("payment" is a card slug with no deterministic decision tree.)
const availNoTree = getWorkflowAvailability({
  slug: "payment",
  is_published: true,
  review_status: "approved",
  source_version: "81.2",
});
assert.equal(availNoTree.status, "unavailable_no_tree");
assert.equal(availNoTree.hasTree, false);
assert.equal(availNoTree.safeMessage, ""); // nothing to show

// Pregnancy tree is verified against 80.8, so an 80.8 approved card is available.
const availPreg = getWorkflowAvailability({
  slug: "pregnancy",
  is_published: true,
  review_status: "approved",
  source_version: "80.8 (23-Jun-2026)",
});
assert.equal(availPreg.status, "available");

// Direct-link preselect fallback (Phase G): /decision?procedure=<slug> can be
// opened with no card info (e.g. before cards are published). The preselect
// panel calls getWorkflowAvailability with only the slug and must degrade to a
// safe state, never crash or claim availability.
const preselectNoCard = getWorkflowAvailability({ slug: "pregnancy" });
assert.equal(preselectNoCard.available, false);
assert.equal(preselectNoCard.status, "unavailable_unpublished");
assert.equal(preselectNoCard.hasTree, true);
assert.ok(preselectNoCard.safeMessage.length > 0); // safe message shown, no internal detail leaked
const preselectNoTree = getWorkflowAvailability({ slug: "payment" });
assert.equal(preselectNoTree.hasTree, false);
assert.equal(preselectNoTree.status, "unavailable_no_tree");

// hasDecisionTree true for the real trees; false for concept/card-only slugs.
assert.equal(hasDecisionTree("pregnancy"), true);
assert.equal(hasDecisionTree("minimum-connection-time"), true);
assert.equal(hasDecisionTree("wheelchair"), true);
assert.equal(hasDecisionTree("name-correction"), true);
assert.equal(hasDecisionTree("falcon-handling"), true);
assert.equal(hasDecisionTree("ok-to-board"), true); // now a Batch 2 tree
assert.equal(hasDecisionTree("payment"), false);
assert.equal(hasDecisionTree("nonexistent-slug"), false);

// ---- Phase H: wheelchair, name-correction, falcon-handling ----
const WCHAIR = DECISION_DEFINITIONS["wheelchair"];
const wchairBase = {
  assistance_type: "WCHR",
  hours_before_departure: 20,
  battery_powered: false,
  battery_type: "Not battery-powered",
  battery_damaged: false,
  companion_available: false,
  medical_certificate_available: false,
};
expectRule(WCHAIR, wchairBase, "wchr-ok", "Can proceed", "High confidence");
expectRule(WCHAIR, { ...wchairBase, hours_before_departure: 8 }, "wchr-late", "Requires supervisor", "Conditional");
expectRule(
  WCHAIR,
  { ...wchairBase, assistance_type: "WCHS", hours_before_departure: 20 },
  "wchs-late",
  "Requires supervisor",
  "Conditional"
);
expectRule(
  WCHAIR,
  { ...wchairBase, assistance_type: "WCHC", hours_before_departure: 30, companion_available: false },
  "wchc-no-companion",
  "Not permitted",
  "High confidence"
);
expectRule(
  WCHAIR,
  {
    ...wchairBase,
    assistance_type: "WCHC",
    hours_before_departure: 30,
    companion_available: true,
    medical_certificate_available: false,
  },
  "wchc-no-certificate",
  "Requires document",
  "Conditional"
);
expectRule(
  WCHAIR,
  {
    ...wchairBase,
    assistance_type: "WCHC",
    hours_before_departure: 30,
    companion_available: true,
    medical_certificate_available: true,
  },
  "wchc-ok",
  "Can proceed with conditions",
  "Conditional"
);
expectRule(
  WCHAIR,
  { ...wchairBase, battery_powered: true, battery_type: "WCLB (lithium)", hours_before_departure: 30 },
  "wchr-battery-late",
  "Not permitted",
  "High confidence"
);
expectRule(
  WCHAIR,
  { ...wchairBase, battery_powered: true, battery_type: "WCLB (lithium)", battery_damaged: true, hours_before_departure: 60 },
  "wchr-battery-damaged",
  "Not permitted",
  "High confidence"
);
expectRule(
  WCHAIR,
  { ...wchairBase, battery_powered: true, battery_type: "WCLB (lithium)", battery_damaged: false, hours_before_departure: 60 },
  "wchr-battery-ok",
  "Requires document",
  "Conditional"
);

const NAMEC = DECISION_DEFINITIONS["name-correction"];
const nameBase = {
  correction_type: "Title, space, or up to 3 characters",
  hours_before_departure: 48,
  no_show: false,
  checkin_state: "Not checked in",
  booking_channel: "Direct (FZ)",
};
expectRule(NAMEC, nameBase, "nc-foc", "Can proceed with conditions", "Conditional");
expectRule(
  NAMEC,
  { ...nameBase, correction_type: "Name swap (no spelling change)" },
  "nc-swap",
  "Can proceed with conditions",
  "Conditional"
);
expectRule(
  NAMEC,
  { ...nameBase, correction_type: "More than 3 characters / full name / add or delete / maiden-to-married" },
  "nc-major",
  "Requires document",
  "Conditional"
);
expectRule(NAMEC, { ...nameBase, hours_before_departure: 4 }, "nc-within-6h", "Not permitted", "High confidence");
expectRule(NAMEC, { ...nameBase, no_show: true }, "nc-no-show", "Not permitted", "High confidence");
expectRule(
  NAMEC,
  { ...nameBase, checkin_state: "Online checked in" },
  "nc-olci-checkin",
  "Not permitted",
  "High confidence"
);
expectRule(
  NAMEC,
  { ...nameBase, checkin_state: "Airport checked in" },
  "nc-airport-checkin",
  "Requires supervisor",
  "Conditional"
);
expectRule(NAMEC, { ...nameBase, booking_channel: "GDS" }, "nc-gds", "Not permitted", "High confidence");
expectRule(NAMEC, { ...nameBase, booking_channel: "Interline" }, "nc-interline", "Requires supervisor", "Conditional");

const FALCON = DECISION_DEFINITIONS["falcon-handling"];
const falconBase = {
  hours_before_departure: 72,
  falcon_count: 2,
  cabin_class: "Economy",
  destination_restriction: "None / standard",
  journey_type: "flydubai only (FZ)",
  approval_obtained: true,
  required_details_available: true,
};
expectRule(FALCON, falconBase, "falcon-approved", "Can proceed with conditions", "Conditional");
expectRule(FALCON, { ...falconBase, hours_before_departure: 20 }, "falcon-under-48h", "Not permitted", "High confidence");
expectRule(FALCON, { ...falconBase, falcon_count: 20 }, "falcon-over-15", "Requires supervisor", "Conditional");
expectRule(FALCON, { ...falconBase, cabin_class: "Business" }, "falcon-business", "Not permitted", "High confidence");
expectRule(FALCON, { ...falconBase, destination_restriction: "DMM" }, "falcon-dmm", "Not permitted", "High confidence");
expectRule(
  FALCON,
  { ...falconBase, journey_type: "Interline or codeshare" },
  "falcon-interline",
  "Not permitted",
  "High confidence"
);
expectRule(
  FALCON,
  { ...falconBase, required_details_available: false },
  "falcon-missing-details",
  "Requires document",
  "Conditional"
);
expectRule(
  FALCON,
  { ...falconBase, approval_obtained: false },
  "falcon-not-approved",
  "Requires supervisor",
  "Conditional"
);

// Every Phase H tree is registered, versioned and has source-cited rules.
for (const slug of ["wheelchair", "name-correction", "falcon-handling"]) {
  assert.ok(DECISION_DEFINITIONS[slug], `definition registered for ${slug}`);
  assert.equal(DECISION_DEFINITIONS[slug].sourceVersion, "81.2 (10-Jul-2026)");
  assert.ok(DECISION_DEFINITIONS[slug].sourcePages.length > 0, `source pages for ${slug}`);
}

// Unsupported / incomplete input never invents a fallback.
const wchairIncomplete = evaluate(WCHAIR, { assistance_type: "WCHR" });
assert.equal(wchairIncomplete.outcome, "Insufficient information");
assert.ok(wchairIncomplete.missing.length > 0);

// ---- Phase J-D Batch 1: Booking workflows (verified: GO TO v81.2 10-Jul-2026) ----

// Every Batch 1 tree is registered, versioned to 81.2 and source-cited.
for (const slug of ["duplicate-booking", "government-deals", "auto-split-od"]) {
  assert.ok(DECISION_DEFINITIONS[slug], `definition registered for ${slug}`);
  assert.equal(DECISION_DEFINITIONS[slug].sourceVersion, "81.2 (10-Jul-2026)");
  assert.ok(DECISION_DEFINITIONS[slug].sourcePages.length > 0, `source pages for ${slug}`);
  for (const rule of DECISION_DEFINITIONS[slug].rules) {
    assert.ok((rule.sourceField ?? "").length > 0, `${slug}/${rule.id}: non-empty sourceField`);
  }
}

// -- Duplicate Booking (ch.47 pp.268-270): every resolvable case is approval-gated --
const DUP = DECISION_DEFINITIONS["duplicate-booking"];
expectRule(
  DUP,
  { match_level: "Not clearly a duplicate", both_active: true },
  "dup-not-clear",
  "Insufficient information",
  "Insufficient information"
);
expectRule(
  DUP,
  { match_level: "Identical in every detail", both_active: false },
  "dup-not-active",
  "Requires supervisor",
  "Conditional"
);
expectRule(
  DUP,
  { match_level: "Only one sector matches", both_active: true },
  "dup-partial",
  "Requires supervisor",
  "Conditional"
);
expectRule(
  DUP,
  { match_level: "Identical in every detail", both_active: true, other_channel: true },
  "dup-other-channel",
  "Requires supervisor",
  "Conditional"
);
expectRule(
  DUP,
  { match_level: "Identical in every detail", both_active: true, fare_same: true, other_channel: false },
  "dup-exact-same-fare",
  "Requires supervisor",
  "Conditional"
);
const dupSameFare = evaluate(DUP, {
  match_level: "Identical in every detail",
  both_active: true,
  fare_same: true,
  other_channel: false,
});
assert.deepEqual(dupSameFare.rulePages, [269, 270], "dup-exact-same-fare source pages");
expectRule(
  DUP,
  { match_level: "Identical in every detail", both_active: true, fare_same: false, other_channel: false },
  "dup-exact-diff-fare",
  "Requires supervisor",
  "Conditional"
);
// No self-service "Can proceed" outcome exists anywhere in the duplicate tree.
for (const rule of DUP.rules) {
  assert.notEqual(rule.outcome, "Can proceed", "duplicate booking never self-services a refund");
}
// Incomplete answers -> Insufficient information, no matched rule.
const dupIncomplete = evaluate(DUP, { match_level: "Identical in every detail" });
assert.equal(dupIncomplete.outcome, "Insufficient information");
assert.equal(dupIncomplete.matchedRuleId, null);
assert.ok(dupIncomplete.missing.length > 0);

// -- Government Deals (ch.69 pp.322-324) --
const GOV = DECISION_DEFINITIONS["government-deals"];
expectRule(
  GOV,
  { request_type: "Create a new discounted booking", interline_codeshare: true },
  "gov-interline",
  "Not permitted",
  "High confidence"
);
expectRule(
  GOV,
  { request_type: "Create a new discounted booking", interline_codeshare: false },
  "gov-create",
  "Not permitted",
  "High confidence"
);
expectRule(
  GOV,
  { request_type: "Add an adult or child", interline_codeshare: false },
  "gov-add-adult-child",
  "Requires supervisor",
  "Conditional"
);
expectRule(
  GOV,
  { request_type: "Add an infant", interline_codeshare: false },
  "gov-add-infant",
  "Can proceed with conditions",
  "Conditional"
);
expectRule(
  GOV,
  { request_type: "Modify or cancel an existing deal booking", interline_codeshare: false },
  "gov-modify-cancel",
  "Can proceed with conditions",
  "Conditional"
);
const govIncomplete = evaluate(GOV, { request_type: "Add an infant" });
assert.equal(govIncomplete.outcome, "Insufficient information");
assert.equal(govIncomplete.matchedRuleId, null);
assert.ok(govIncomplete.missing.length > 0);

// -- Auto Split OD (ch.11 Fare Types pp.49-50) --
const AUTO = DECISION_DEFINITIONS["auto-split-od"];
expectRule(
  AUTO,
  { fz_connection: false, leg_pattern: "Other or both same status" },
  "auto-split-excluded",
  "Insufficient information",
  "Insufficient information"
);
expectRule(
  AUTO,
  { fz_connection: true, leg_pattern: "Other or both same status" },
  "auto-split-other-status",
  "Insufficient information",
  "Insufficient information"
);
expectRule(
  AUTO,
  { fz_connection: true, leg_pattern: "Leg 1 no-show, Leg 2 boarded" },
  "auto-split-noshow-first",
  "Not permitted",
  "High confidence"
);
expectRule(
  AUTO,
  { fz_connection: true, leg_pattern: "Leg 1 boarded, Leg 2 no-show", request: "Cancel the affected leg" },
  "auto-split-cancel",
  "Requires supervisor",
  "Conditional"
);
expectRule(
  AUTO,
  { fz_connection: true, leg_pattern: "Leg 1 boarded, Leg 2 no-show", request: "Modify the affected leg" },
  "auto-split-modify",
  "Can proceed with conditions",
  "Conditional"
);
const autoIncomplete = evaluate(AUTO, { fz_connection: true });
assert.equal(autoIncomplete.outcome, "Insufficient information");
assert.equal(autoIncomplete.matchedRuleId, null);
assert.ok(autoIncomplete.missing.length > 0);

// -- Category mapping: all three Batch 1 workflows are Booking --
const { categoryForWorkflow: categoryForWorkflowB1 } = await import(
  "../lib/decision-engine/categories.ts"
);
assert.equal(categoryForWorkflowB1("duplicate-booking"), "Booking");
assert.equal(categoryForWorkflowB1("government-deals"), "Booking");
assert.equal(categoryForWorkflowB1("auto-split-od"), "Booking");

// -- Availability: duplicate-booking has no card yet -> unavailable but tree exists --
const dupAvail = getWorkflowAvailability({ slug: "duplicate-booking" });
assert.equal(dupAvail.hasTree, true);
assert.equal(dupAvail.available, false);
assert.equal(dupAvail.status, "unavailable_unpublished");
// gov / auto-split are gated too until a matching approved+published card exists.
for (const slug of ["government-deals", "auto-split-od"]) {
  const gated = getWorkflowAvailability({ slug, is_published: false, review_status: "needs_review" });
  assert.equal(gated.hasTree, true);
  assert.equal(gated.available, false);
  // With an approved, published, version-matched card they become available.
  const live = getWorkflowAvailability({
    slug,
    is_published: true,
    review_status: "approved",
    source_version: "81.2 (10-Jul-2026)",
  });
  assert.equal(live.status, "available");
  assert.equal(live.available, true);
}
// A version-mismatched card keeps the Batch 1 workflow gated.
const govMismatch = getWorkflowAvailability({
  slug: "government-deals",
  is_published: true,
  review_status: "approved",
  source_version: "80.8 (23-Jun-2026)",
});
assert.equal(govMismatch.status, "unavailable_source_mismatch");

// ---- Phase J-D Batch 2: Travel Requirements workflows (verified: GO TO v81.2 10-Jul-2026) ----

// Every Batch 2 tree is registered, versioned to 81.2 and source-cited.
for (const slug of ["travel-requirements", "ok-to-board", "visa-change"]) {
  assert.ok(DECISION_DEFINITIONS[slug], `definition registered for ${slug}`);
  assert.equal(DECISION_DEFINITIONS[slug].sourceVersion, "81.2 (10-Jul-2026)");
  assert.ok(DECISION_DEFINITIONS[slug].sourcePages.length > 0, `source pages for ${slug}`);
  for (const rule of DECISION_DEFINITIONS[slug].rules) {
    assert.ok((rule.sourceField ?? "").length > 0, `${slug}/${rule.id}: non-empty sourceField`);
    // High-risk travel-document trees must never imply admissibility with a bare "Can proceed".
    assert.notEqual(rule.outcome, "Can proceed", `${slug}/${rule.id}: no bare Can proceed`);
  }
}

// -- Travel Requirements — UAE residency (ch.49 p.272) --
const TR = DECISION_DEFINITIONS["travel-requirements"];
expectRule(
  TR,
  { scenario: "Other entry or exit requirement" },
  "tr-other-requirement",
  "Insufficient information",
  "Insufficient information"
);
expectRule(
  TR,
  { scenario: "UAE resident departing Dubai and returning to the UAE", eid_present: false },
  "tr-uae-resident-no-eid",
  "Requires document",
  "Conditional"
);
expectRule(
  TR,
  { scenario: "UAE resident departing Dubai and returning to the UAE", eid_present: true },
  "tr-uae-resident-eid",
  "Can proceed with conditions",
  "Conditional"
);
const trIncomplete = evaluate(TR, {});
assert.equal(trIncomplete.outcome, "Insufficient information");
assert.equal(trIncomplete.matchedRuleId, null);
assert.ok(trIncomplete.missing.length > 0);

// -- OK to Board (ch.50 pp.272-274) --
const OKTB = DECISION_DEFINITIONS["ok-to-board"];
expectRule(
  OKTB,
  { request: "General OKTB policy or eligibility question" },
  "oktb-policy-reference",
  "Insufficient information",
  "Insufficient information"
);
expectRule(
  OKTB,
  { request: "Add OKTB manually on an EK* flight", actioning_role: "Contact Centre agent" },
  "oktb-ek-manual-not-fs",
  "Requires supervisor",
  "Conditional"
);
expectRule(
  OKTB,
  { request: "Add OKTB manually on an EK* flight", actioning_role: "Floor Support or Supervisor" },
  "oktb-ek-manual-fs",
  "Can proceed with conditions",
  "Conditional"
);
// Manual add with no actioning role never self-authorises.
const oktbNoRole = evaluate(OKTB, { request: "Add OKTB manually on an EK* flight" });
assert.equal(oktbNoRole.outcome, "Insufficient information");
assert.equal(oktbNoRole.matchedRuleId, null);
const oktbIncomplete = evaluate(OKTB, {});
assert.equal(oktbIncomplete.outcome, "Insufficient information");
assert.equal(oktbIncomplete.matchedRuleId, null);
assert.ok(oktbIncomplete.missing.length > 0);

// -- Visa Change (ch.48.1 p.271) --
const VC = DECISION_DEFINITIONS["visa-change"];
expectRule(
  VC,
  { request_type: "General or transit visa enquiry" },
  "vc-general-enquiry",
  "Not permitted",
  "High confidence"
);
expectRule(
  VC,
  { request_type: "Visa-change travel (re-entry to UAE)", outbound_noshow: true },
  "vc-outbound-noshow",
  "Requires supervisor",
  "Conditional"
);
expectRule(
  VC,
  { request_type: "Visa-change travel (re-entry to UAE)", route: "Other route" },
  "vc-route-unsupported",
  "Not permitted",
  "High confidence"
);
expectRule(
  VC,
  { request_type: "Visa-change travel (re-entry to UAE)", valid_uae_visa_in_hand: false },
  "vc-no-valid-visa",
  "Requires document",
  "Conditional"
);
expectRule(
  VC,
  { request_type: "Visa-change travel (re-entry to UAE)", valid_uae_visa_in_hand: true, same_pnr_both_flights: false },
  "vc-not-same-pnr",
  "Requires supervisor",
  "Conditional"
);
expectRule(
  VC,
  {
    request_type: "Visa-change travel (re-entry to UAE)",
    route: "MCT",
    valid_uae_visa_in_hand: true,
    same_pnr_both_flights: true,
    outbound_noshow: false,
  },
  "vc-eligible-mct",
  "Can proceed with conditions",
  "Conditional"
);
expectRule(
  VC,
  {
    request_type: "Visa-change travel (re-entry to UAE)",
    route: "KWI",
    valid_uae_visa_in_hand: true,
    same_pnr_both_flights: true,
    outbound_noshow: false,
  },
  "vc-eligible-kwi",
  "Can proceed with conditions",
  "Conditional"
);
// Safety: everything valid EXCEPT an unanswered route must never reach an eligible outcome.
const vcNoRoute = evaluate(VC, {
  request_type: "Visa-change travel (re-entry to UAE)",
  valid_uae_visa_in_hand: true,
  same_pnr_both_flights: true,
  outbound_noshow: false,
});
assert.equal(vcNoRoute.outcome, "Insufficient information");
assert.equal(vcNoRoute.matchedRuleId, null);
// Bare visa-change with no supporting answers never self-authorises.
const vcBare = evaluate(VC, { request_type: "Visa-change travel (re-entry to UAE)" });
assert.equal(vcBare.outcome, "Insufficient information");
assert.equal(vcBare.matchedRuleId, null);
const vcIncomplete = evaluate(VC, {});
assert.equal(vcIncomplete.outcome, "Insufficient information");
assert.equal(vcIncomplete.matchedRuleId, null);
assert.ok(vcIncomplete.missing.length > 0);

// -- Category mapping: all three Batch 2 workflows are Travel Requirements --
const { categoryForWorkflow: categoryForWorkflowB2 } = await import(
  "../lib/decision-engine/categories.ts"
);
for (const slug of ["travel-requirements", "ok-to-board", "visa-change"]) {
  assert.equal(categoryForWorkflowB2(slug), "Travel Requirements");
}

// -- Availability: cards are still at v80.8, so each Batch 2 workflow stays gated --
for (const slug of ["travel-requirements", "ok-to-board", "visa-change"]) {
  const noTree = getWorkflowAvailability({ slug });
  assert.equal(noTree.hasTree, true, `${slug} has a tree`);
  assert.equal(noTree.available, false);
  // Unpublished / needs-review card stays unavailable.
  const unpub = getWorkflowAvailability({ slug, is_published: false, review_status: "needs_review" });
  assert.equal(unpub.available, false);
  // A card still at v80.8 (source-version mismatch vs the 81.2 tree) stays unavailable.
  const mismatch = getWorkflowAvailability({
    slug,
    is_published: true,
    review_status: "approved",
    source_version: "80.8 (23-Jun-2026)",
  });
  assert.equal(mismatch.status, "unavailable_source_mismatch");
  assert.equal(mismatch.available, false);
  // Only an approved, published, version-matched card makes it available.
  const live = getWorkflowAvailability({
    slug,
    is_published: true,
    review_status: "approved",
    source_version: "81.2 (10-Jul-2026)",
  });
  assert.equal(live.status, "available");
  assert.equal(live.available, true);
}

// ---- Phase J: structural tree validation must have zero errors ----
const { validateAllTrees, treeErrors } = await import("../lib/decision-engine/validate-trees.ts");
const treeIssues = validateAllTrees(DECISION_DEFINITIONS);
const treeErrs = treeErrors(treeIssues);
assert.equal(
  treeErrs.length,
  0,
  `tree validation errors: ${treeErrs.map((i) => `${i.slug}: ${i.message}`).join("; ")}`
);

// ---- Phase J: workflow categories cover every registered tree ----
const { listWorkflowSummaries, categoryForWorkflow, filterWorkflows, WORKFLOW_CATEGORY_ORDER } =
  await import("../lib/decision-engine/categories.ts");
const summaries = listWorkflowSummaries();
assert.equal(summaries.length, Object.keys(DECISION_DEFINITIONS).length);
for (const s of summaries) {
  assert.ok(WORKFLOW_CATEGORY_ORDER.includes(s.category), `category valid for ${s.slug}`);
  assert.ok(s.questionCount > 0 && s.estimatedSeconds > 0);
  assert.ok(s.sourcePages.length > 0);
}
assert.equal(categoryForWorkflow("pregnancy"), "Medical");
assert.equal(categoryForWorkflow("name-correction"), "Booking");
assert.equal(categoryForWorkflow("unknown-slug"), "Special Services");
assert.equal(filterWorkflows(summaries, "wheelchair").length >= 1, true);
assert.equal(filterWorkflows(summaries, "zzz-no-match").length, 0);

console.log("Decision router checks passed.");
