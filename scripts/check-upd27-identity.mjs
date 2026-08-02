// UPD-2.7 — chapter identity matching + mass-reclassification guard.
// Run with: node scripts/check-upd27-identity.mjs
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const { stripChapterNumberPrefix, slugifyChapter, normalizeTitle } = await import(
  "../lib/sync-identity.ts"
);
const {
  classifyExtraction,
  summarizeDiffs,
  evaluateReclassificationGuard,
  MASS_RECLASSIFICATION_THRESHOLD,
  MASS_RECLASSIFICATION_MESSAGE,
} = await import("../lib/sync-diff.ts");

const extractPy = read("tools/extraction/extract.py");
const worker = read("worker/index.mjs");
const summaryUi = read("components/admin/SyncRunSummary.tsx");
const reviewPage = read("app/admin/sync/[id]/page.tsx");
const overrideRoute = read("app/api/sync/[id]/reclass-override/route.ts");
const cancelSql = read("supabase/seed_upd27_cancel_bad_run.sql");

// ===========================================================================
// 1. stripChapterNumberPrefix
// ===========================================================================
const STRIP = [
  ["28. Sporting Equipment", "Sporting Equipment"],
  ["48.1 Visa Change", "Visa Change"],
  ["35 - Wheelchair", "Wheelchair"],
  ["  26.6 WorldTracer  ", "WorldTracer"],
  ["26.6-26.9 WorldTracer", "WorldTracer"],
  ["26.6–26.9 WorldTracer", "WorldTracer"],
  ["39. SSR - Special Requests", "SSR - Special Requests"],
  ["44. Medical & Death cases", "Medical & Death cases"],
  ["34. Accessibility - Guidelines", "Accessibility - Guidelines"],
  // Internal numbers and non-chapter leading numbers are preserved.
  ["Boeing 737 MAX Seating", "Boeing 737 MAX Seating"],
  ["7 days notice policy", "7 days notice policy"],
  ["2026", "2026"],
];
for (const [input, expected] of STRIP) {
  assert.equal(stripChapterNumberPrefix(input), expected, `strip("${input}")`);
}
assert.equal(stripChapterNumberPrefix(null), "");
assert.equal(stripChapterNumberPrefix(undefined), "");

// ===========================================================================
// 2. Production slug byte-compatibility (the 14 real chapters)
// ===========================================================================
const PROD_SLUGS = [
  ["28. Sporting Equipment", "sporting-equipment"],
  ["29. Firearms and Carry of Ammunition", "firearms-and-carry-of-ammunition"],
  ["35. Wheelchair", "wheelchair"],
  ["37. Service animal", "service-animal"],
  ["43. Pregnancy", "pregnancy"],
  ["44. Medical & Death cases", "medical-death-cases"],
  ["48. Duplicate booking", "duplicate-booking"],
  ["50. Travel Requirements to travel from UAE", "travel-requirements-to-travel-from-uae"],
  ["51. OK to Board (OKTB)", "ok-to-board-oktb"],
  ["53. Name Change / Correction", "name-change-correction"],
  ["56. Ways to Check-in", "ways-to-check-in"],
  ["70. Government Deals", "government-deals"],
  // Hyphen semantics must be preserved exactly.
  ["39. SSR - Special Requests", "ssr---special-requests"],
  // 60-character truncation must match production.
  [
    "36. Disabled Passenger with Intellectual or Developmental Disability Needs Assistance (DPNA)",
    "disabled-passenger-with-intellectual-or-developmental-disabi",
  ],
];
for (const [title, expected] of PROD_SLUGS) {
  assert.equal(
    slugifyChapter(stripChapterNumberPrefix(title)),
    expected,
    `production slug for "${title}"`
  );
}
assert.equal(
  slugifyChapter(stripChapterNumberPrefix(PROD_SLUGS[13][0])).length,
  60,
  "truncation must be 60 chars"
);

// ===========================================================================
// 3. Extractor emits the stable slug (and keeps the numbered title)
// ===========================================================================
assert.ok(/def strip_chapter_number_prefix/.test(extractPy), "extractor must define the strip helper");
assert.ok(
  /"slug": slugify\(strip_chapter_number_prefix\(full_title\)\)/.test(extractPy),
  "extractor slug must come from the stripped title"
);
assert.ok(/"title": full_title/.test(extractPy), "numbered title must be kept for display");
assert.ok(!/titleCore/.test(extractPy), "extractor must not use a punctuation-normalizing helper");
// Byte-compatible slugify: hyphens preserved, no dash trimming, 60-char cut.
assert.ok(/re\.sub\(r"\[\\s_\]\+", "-", value\)/.test(extractPy), "slugify must not collapse hyphens");
assert.ok(/return value\[:60\]/.test(extractPy), "slugify must truncate at 60");
assert.ok(!/\^-\+\|-\+\$/.test(extractPy), "slugify must not trim leading/trailing dashes");

// ===========================================================================
// 4. Deterministic identity tiers + ambiguity safety
// ===========================================================================
const mkLive = (o) => ({
  id: o.id, slug: o.slug, title: o.title, chapter_number: o.n ?? null,
  body_text: o.body ?? "same body", keywords: o.kw ?? ["k"],
  page_start: o.ps ?? 1, page_end: o.pe ?? 1, source_version: "81.2",
});
const mkIn = (o) => ({
  title: o.title, slug: o.slug ?? null, chapter_number: o.n ?? null,
  body_text: o.body ?? "same body", keywords: o.kw ?? ["k"],
  page_start: o.ps ?? 1, page_end: o.pe ?? 1, source_version: "81.7",
});

// (a) exact slug
let d = classifyExtraction(
  [mkIn({ title: "35. Wheelchair", slug: "wheelchair", n: 35 })],
  [mkLive({ id: "1", slug: "wheelchair", title: "Wheelchair", n: 34 })],
  "81.7"
);
assert.equal(d[0].identityMatchMethod, "slug");
assert.equal(d[0].changeClass, "metadata_only", "pure renumber is metadata_only");

// (b) prefix-stripped slug rescues a numbered incoming slug
d = classifyExtraction(
  [mkIn({ title: "35. Wheelchair", slug: "35-wheelchair", n: 35 })],
  [mkLive({ id: "1", slug: "wheelchair", title: "Wheelchair", n: 34 })],
  "81.7"
);
assert.equal(d[0].identityMatchMethod, "slug", "stripped-prefix slug tier must match");
assert.notEqual(d[0].changeClass, "new", "must not be treated as a new chapter");

// (c) normalized title without the number
d = classifyExtraction(
  [mkIn({ title: "35. Wheelchair", slug: "totally-different", n: 35 })],
  [mkLive({ id: "1", slug: "wheel-chair-old", title: "Wheelchair", n: 34 })],
  "81.7"
);
assert.equal(d[0].identityMatchMethod, "title");

// (e) chapter number ONLY when content hashes agree
d = classifyExtraction(
  [mkIn({ title: "99. Brand New Topic", slug: "brand-new-topic", n: 12, body: "identical" })],
  [mkLive({ id: "1", slug: "other", title: "Other", n: 12, body: "identical" })],
  "81.7"
);
assert.equal(d[0].identityMatchMethod, "number", "number tier requires equal content");
d = classifyExtraction(
  [mkIn({ title: "99. Brand New Topic", slug: "brand-new-topic", n: 12, body: "AAA" })],
  [mkLive({ id: "1", slug: "other", title: "Other", n: 12, body: "BBB" })],
  "81.7"
);
assert.equal(d.find((x) => x.changeClass === "new")?.identityMatchMethod, "none", "differing content must not match by number");

// Ambiguity: two live chapters share a normalized title -> never auto-matched.
d = classifyExtraction(
  [mkIn({ title: "12. Baggage", slug: "no-match-slug", n: 12 })],
  [
    mkLive({ id: "a", slug: "baggage-a", title: "Baggage", n: 12 }),
    mkLive({ id: "b", slug: "baggage-b", title: "Baggage", n: 13 }),
  ],
  "81.7"
);
const ambiguousDiff = d.find((x) => x.changeClass === "new");
assert.ok(ambiguousDiff, "ambiguous input must stay unmatched");
assert.equal(ambiguousDiff.ambiguous, true, "ambiguity must be flagged");
assert.equal(ambiguousDiff.identityMatchMethod, "none");
assert.ok(/resolve manually/i.test(ambiguousDiff.reasons.join(" ")), "reason must warn against merging");

// ===========================================================================
// 5. Contract rejects duplicate slugs (collision safety)
// ===========================================================================
const { validateExtractionContract } = await import("../lib/extraction-contract.ts");
const ch = (slug, title) => ({
  chapterNumber: "1", title, slug, pageStart: 1, pageEnd: 1,
  body: "body", contentBlocks: [], searchKeywords: [], sourceLinks: [],
});
const dupContract = {
  extractorVersion: "upd2-1",
  source: { title: "t", version: "81.7", versionDate: "2026-07-30", pageCount: 10, sha256: "a".repeat(64) },
  chapters: [ch("same-slug", "A"), ch("same-slug", "B")],
};
const dupRes = validateExtractionContract(dupContract);
assert.equal(dupRes.ok, false, "duplicate slugs must be rejected");
assert.equal(dupRes.errorCode, "DUPLICATE_SLUG");
// Truncation collision: two long titles that collapse to the same 60 chars.
const longA = "Passengers with Medical Conditions Onboard Travelling with Plaster Casts";
const longB = "Passengers with Medical Conditions Onboard Travelling with Leg Braces";
const sA = slugifyChapter(longA), sB = slugifyChapter(longB);
if (sA === sB) {
  const collide = { ...dupContract, chapters: [ch(sA, longA), ch(sB, longB)] };
  assert.equal(validateExtractionContract(collide).errorCode, "DUPLICATE_SLUG", "truncation collisions must fail safely");
}

// ===========================================================================
// 6. Mass-reclassification guard
// ===========================================================================
assert.equal(MASS_RECLASSIFICATION_THRESHOLD, 0.2);
assert.ok(
  MASS_RECLASSIFICATION_MESSAGE.startsWith("Chapter identity matching produced an unusually large"),
  "safe message must match the specification"
);
const mkDiffs = (n, r, total) => [
  ...Array.from({ length: n }, () => ({ changeClass: "new" })),
  ...Array.from({ length: r }, () => ({ changeClass: "removed" })),
  ...Array.from({ length: total }, () => ({ changeClass: "metadata_only" })),
];
// Reproduce the production failure: 78 new / 79 removed.
let g = evaluateReclassificationGuard(mkDiffs(78, 79, 0), 78, 79);
assert.equal(g.blocked, true, "the production failure must be blocked");
assert.equal(g.newRatio, 1);
assert.equal(g.removedRatio, 1);
// The corrected contract must NOT be blocked.
g = evaluateReclassificationGuard(mkDiffs(1, 0, 77), 78, 77);
assert.equal(g.blocked, false, "77 metadata_only / 1 new must pass");
assert.ok(g.newRatio < 0.02);
// Boundary: exactly 20% passes, just above fails.
assert.equal(evaluateReclassificationGuard(mkDiffs(20, 0, 80), 100, 100).blocked, false);
assert.equal(evaluateReclassificationGuard(mkDiffs(21, 0, 79), 100, 100).blocked, true);
assert.equal(evaluateReclassificationGuard(mkDiffs(0, 21, 79), 100, 100).blocked, true);

// Worker enforcement + owner-only override.
assert.ok(worker.includes("evaluateReclassificationGuard"), "worker must evaluate the guard");
assert.ok(/throw new WorkerError\("MASS_RECLASSIFICATION"/.test(worker), "worker must block with the stable code");
assert.ok(worker.includes("reclass_override_reason"), "override must be read from the run");
const transient = worker.slice(worker.indexOf("const TRANSIENT_ERROR_CODES"), worker.indexOf("]);", worker.indexOf("const TRANSIENT_ERROR_CODES")));
assert.ok(!transient.includes("MASS_RECLASSIFICATION"), "a blocked run must not silently retry");

// ===========================================================================
// 7. Owner-only override endpoint
// ===========================================================================
assert.ok(overrideRoute.includes("requireAdmin"), "override must require a session");
assert.ok(overrideRoute.includes("isOwner(role)"), "override must be OWNER-only");
assert.ok(/reason\.length < 10/.test(overrideRoute), "an override reason is mandatory");
assert.ok(overrideRoute.includes("reclass_override_by"), "override must record the actor");
assert.ok(overrideRoute.includes("reclass_override_at"), "override must record the timestamp");
assert.ok(!/is_published|review_status|publish_sync_chapters/.test(overrideRoute), "override must not publish anything");

// ===========================================================================
// 8. UI gate
// ===========================================================================
assert.ok(reviewPage.includes("reclassBlocked"), "review page must compute the block");
assert.ok(/canPublish = canManageUsers\(role\?\.role\) && !reclassBlocked/.test(reviewPage), "publish must be disabled when blocked");
assert.ok(reviewPage.includes("new_ratio") && reviewPage.includes("removed_ratio"), "ratios must be loaded");
assert.ok(summaryUi.includes("Identity matching"), "ratios must be shown");
assert.ok(summaryUi.includes("Chapter identity matching produced an unusually large"), "critical warning text required");
assert.ok(summaryUi.includes("Publishing is disabled"), "the gate must be explained");
// Staged rows are still rendered (never hidden).
assert.ok(reviewPage.includes("<SyncReviewClient"), "staged rows must remain visible");

// ===========================================================================
// 9. Production cancellation SQL is guarded and non-destructive
// ===========================================================================
assert.ok(/state\s*=\s*'cancelled'/.test(cancelSql), "must set state cancelled");
assert.ok(/status\s*=\s*'discarded'/.test(cancelSql), "must set status discarded");
assert.ok(cancelSql.includes("Cancelled: invalid mass chapter reclassification"), "message must match spec");
assert.ok(cancelSql.includes("MASS_RECLASSIFICATION"), "error code must be recorded");
assert.ok(/and r\.state = 'staged'/.test(cancelSql), "guard: only a staged run");
assert.ok(/= 157/.test(cancelSql) && /= 306/.test(cancelSql), "guard: exact staged/impact counts");
assert.ok(/published_at is null/.test(cancelSql), "guard: nothing was published");
assert.ok(!/\bdelete\s+from\b/i.test(cancelSql), "must never delete the audit trail");
assert.ok(!/drop\s+table/i.test(cancelSql), "must never drop anything");

// ===========================================================================
// 10. Dry-run script exists and is offline
// ===========================================================================
assert.ok(existsSync(new URL("../scripts/dryrun-chapter-match.mjs", import.meta.url)), "dry-run script required");
const dry = read("scripts/dryrun-chapter-match.mjs");
for (const token of ["--existing", "--incoming", "matchedByExactSlug", "matchedByStrippedPrefixSlug", "ambiguousCount", "duplicateSlugsIncoming"]) {
  assert.ok(dry.includes(token), `dry run must report ${token}`);
}
assert.ok(/process\.exit\(1\)/.test(dry), "dry run must exit non-zero on failure");
assert.ok(!/SERVICE_ROLE|createClient/.test(dry), "dry run must not touch Supabase");

// ===========================================================================
// 11. Scope: nothing operational was changed
// ===========================================================================
const migration = read("supabase/migrations/20260804000000_reclassification_guard.sql");
const migrationCode = migration.replace(/--.*$/gm, "");
assert.ok(!/procedure_cards|chapters\b|decision/.test(migrationCode), "migration must not touch operational tables");
assert.ok(!/drop policy|create policy/i.test(migrationCode), "migration must not alter RLS");

console.log("UPD-2.7 identity + guard checks passed.");
