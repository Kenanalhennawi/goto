// UPD-1 — GO TO v81.7 alignment guardrails.
// Run with: node scripts/check-v817-alignment.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");

const { DECISION_DEFINITIONS } = await import("../lib/decision-engine/definitions/index.ts");
const { OPERATIONAL_CONCEPTS } = await import("../lib/operational-intelligence/concepts.ts");
const { resolveOperationalIntelligence } = await import("../lib/operational-intelligence/resolve.ts");
const { evaluate } = await import("../lib/decision-engine/evaluator.ts");

// ---- 1. Every workflow is version-aligned to v81.7 (pregnancy stays 80.8) ----
for (const [slug, def] of Object.entries(DECISION_DEFINITIONS)) {
  const expected = slug === "pregnancy" ? "80.8 (23-Jun-2026)" : "81.7 (30-Jul-2026)";
  assert.equal(def.sourceVersion, expected, `${slug} sourceVersion must be ${expected}`);
}
assert.equal(Object.keys(DECISION_DEFINITIONS).length, 26, "still exactly 26 workflows");

// ---- 2. Chapter renumbering applied (Accessibility insertion: old ch>=34 -> +1) ----
assert.ok(DECISION_DEFINITIONS["wheelchair"].sourceChapter.startsWith("35."), "wheelchair must cite ch.35");
assert.ok(DECISION_DEFINITIONS["dpna"].sourceChapter.startsWith("36."), "dpna must cite ch.36");
assert.ok(DECISION_DEFINITIONS["service-animal"].sourceChapter.startsWith("37."), "service-animal must cite ch.37");
assert.ok(DECISION_DEFINITIONS["sporting-equipment"].sourceChapter.startsWith("28."), "sporting-equipment stays ch.28");
assert.ok(DECISION_DEFINITIONS["extra-seat-cbbg"].sourceChapter.startsWith("33."), "seat chapter stays ch.33");
// Verified page anchors from the v81.7 PDF.
assert.deepEqual(DECISION_DEFINITIONS["sporting-equipment"].sourcePages, [126, 127, 128, 129]);
assert.equal(DECISION_DEFINITIONS["wheelchair"].sourcePages[0], 164, "wheelchair starts p.164 in v81.7");
assert.equal(DECISION_DEFINITIONS["dpna"].sourcePages[0], 170, "dpna starts p.170 in v81.7");

// ---- 3. No SPEX anywhere in live decision/search/OI code ----
const liveFiles = [];
for (const dir of ["lib", "components", "app"]) {
  const walk = (d) => {
    for (const e of readdirSync(join(root, d), { withFileTypes: true })) {
      const rel = join(d, e.name);
      if (e.isDirectory()) walk(rel);
      else if (/\.(ts|tsx)$/.test(e.name)) liveFiles.push(rel);
    }
  };
  walk(dir);
}
for (const f of liveFiles) {
  const src = read(f);
  // The only permitted mentions are retirement notes ("SPEX is/was retired/no longer").
  const matches = src.match(/spex/gi) ?? [];
  if (matches.length > 0) {
    const lines = src.split("\n").filter((l) => /spex/i.test(l));
    for (const line of lines) {
      assert.ok(
        /retired|no longer/i.test(line),
        `${f}: live SPEX reference must be removed (found: ${line.trim().slice(0, 80)})`
      );
    }
  }
}

// ---- 4. Sporting Equipment v81.7 behavior ----
const SPEQ = DECISION_DEFINITIONS["sporting-equipment"];
const base = {
  equipment_kind: "Standard sporting equipment",
  item_weight_kg: 20,
  total_dimension_cm: 250,
  equipment_count: 1,
  hours_before_departure: 48,
  journey_type: "Point-to-point",
};
// 300 cm boundary: 300 accepted, 301 not.
assert.equal(evaluate(SPEQ, { ...base, total_dimension_cm: 300 }).outcome, "Can proceed");
assert.equal(evaluate(SPEQ, { ...base, total_dimension_cm: 301 }).outcome, "Not permitted");
// 32 kg boundary.
assert.equal(evaluate(SPEQ, { ...base, item_weight_kg: 32 }).outcome, "Can proceed");
assert.equal(evaluate(SPEQ, { ...base, item_weight_kg: 33 }).outcome, "Not permitted");
// No fee text anywhere; BIKE SSR exists; no refund rules remain.
const speqText = JSON.stringify(SPEQ.rules);
assert.ok(!/AED ?150|AED ?270/.test(speqText), "retired handling fees must not appear");
assert.ok(speqText.includes("BIKE"), "BIKE SSR must appear");
assert.ok(!SPEQ.rules.some((r) => r.id.includes("refund")), "refund rules removed (no fee to refund)");
// Weapons unchanged at 96h with AED 300 per sector.
assert.equal(evaluate(SPEQ, { ...base, equipment_kind: "Sporting weapon, firearm or ammunition", hours_before_departure: 95 }).outcome, "Not permitted");
assert.ok(speqText.includes("AED 300"), "weapon AED 300 per-sector charge must be cited");

// ---- 5. Wheelchair / DPNA reference the Accessibility guidelines; rules intact ----
const wchairText = JSON.stringify(DECISION_DEFINITIONS["wheelchair"].rules);
assert.ok(wchairText.includes("Guidelines on seat allocation"), "wheelchair must reference the Accessibility guidelines");
assert.ok(!/rows 29-31/.test(wchairText), "old rows 29-31 seating text must be gone from wheelchair");
const dpnaText = JSON.stringify(DECISION_DEFINITIONS["dpna"].rules);
assert.ok(dpnaText.includes("Guidelines on seat allocation"), "dpna must reference the Accessibility guidelines");
// Outcomes unchanged (spot checks mirror check-decision fixtures).
assert.equal(
  evaluate(DECISION_DEFINITIONS["wheelchair"], {
    assistance_type: "WCHC", hours_before_departure: 30, battery_powered: false,
    battery_damaged: false, companion_available: false, medical_certificate_available: false,
  }).outcome,
  "Not permitted"
);

// ---- 6. OI/search vocabulary ----
const sporting = OPERATIONAL_CONCEPTS.find((c) => c.id === "sporting-equipment");
assert.ok(!JSON.stringify(sporting).match(/"spex"/), "OI must not route spex");
assert.ok(sporting.phrases.includes("bicycle"), "bicycle stays a sporting-equipment phrase");
// New reference topics are broad (never auto-route).
for (const id of ["al-majlis", "champagne"]) {
  const c = OPERATIONAL_CONCEPTS.find((x) => x.id === id);
  assert.ok(c && c.safety === "broad" && c.targetSlugs.length === 0, `${id} must be a broad reference concept`);
}
// Accessibility routes ambiguously to wheelchair + dpna.
const acc = resolveOperationalIntelligence("accessibility seating");
assert.equal(acc.safety, "ambiguous");
assert.ok(acc.candidateSlugs.includes("wheelchair") && acc.candidateSlugs.includes("dpna"));
// "spex" as a query no longer resolves to a safe route.
const spexQuery = resolveOperationalIntelligence("spex");
assert.equal(spexQuery.candidateSlugs.length, 0, "'spex' must not route anywhere");
// Search code aliases: new v81.7 codes exist, SPEX absent.
const searchSrc = read("lib/search.ts");
for (const code of ["BIKE:", "WEAP:", "OOGS:", "OOGL:", "OBAG:", "HBAG:", "TVCH:", "LMAJ:"]) {
  assert.ok(searchSrc.includes(code), `CODE_ALIASES missing ${code.replace(":", "")}`);
}
// No live SPEX alias/code — only the retirement note is permitted.
for (const line of searchSrc.split("\n").filter((l) => /spex/i.test(l))) {
  assert.ok(/retired|no longer/i.test(line), `lib/search.ts must not reference SPEX (found: ${line.trim()})`);
}

// ---- 7. Alignment SQL safety ----
const sql = read("supabase/seed_upd1_v817_alignment.sql");
assert.ok(sql.includes("needs_review"), "content-changed cards must be gated for review");
assert.ok(!sql.includes("is_published = true,") && !/set\s+is_published\s*=\s*true/i.test(sql), "SQL must not auto-publish");
assert.ok(!sql.match(/'pregnancy'/), "pregnancy card must not be bumped");
assert.ok(sql.includes("81.7 (30-Jul-2026)"), "SQL must align to 81.7");

console.log("v81.7 alignment checks passed.");
