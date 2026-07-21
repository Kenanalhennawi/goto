import assert from "node:assert/strict";

const { normalizeExternalUrl } = await import("../lib/links.ts");
const { buildSearchTerms, plainSnippet } = await import("../lib/search.ts");
const { sourceReviewStatus, sourceReviewWarnings } = await import("../lib/admin-procedure-quality.ts");

const sharePointUrl =
  "https://dubaiaviationcorp.sharepoint.com/sites/CCQualityandTraining/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FCCQualityandTraining%2FShared%20Documents%2FGO%20TO%20DOC%20FOLDER%2FWorldTracer%20Self%20Service%5FAn%20Overview%2Epdf&parent=%2Fsites%2FCCQualityandTraining%2FShared%20Documents%2FGO%20TO%20DOC%20FOLDER";

assert.equal(
  normalizeExternalUrl(sharePointUrl),
  "https://dubaiaviationcorp.sharepoint.com/sites/CCQualityandTraining/Shared%20Documents/GO%20TO%20DOC%20FOLDER/WorldTracer%20Self%20Service_An%20Overview.pdf"
);
assert.equal(normalizeExternalUrl("javascript:alert(1)"), null);
assert.equal(buildSearchTerms("wt bag"), "baggage:*");
assert.equal(plainSnippet("<mark>WorldTracer</mark> file"), "WorldTracer file");

const sourceReviewBase = {
  source_version: "80.8",
  last_reviewed_at: "2026-06-20T09:00:00.000Z",
  chapters: {
    source_version: "80.8",
    updated_at: "2026-06-20T08:00:00.000Z",
  },
};

assert.deepEqual(
  sourceReviewWarnings({ ...sourceReviewBase, last_reviewed_at: null }),
  ["Never reviewed against source"]
);
assert.deepEqual(
  sourceReviewWarnings({
    ...sourceReviewBase,
    chapters: { ...sourceReviewBase.chapters, updated_at: "2026-06-21T08:00:00.000Z" },
  }),
  ["Source updated"]
);
assert.equal(sourceReviewStatus(sourceReviewBase), "Current");
assert.deepEqual(
  sourceReviewWarnings({ ...sourceReviewBase, source_version: "80.7" }),
  ["Version mismatch"]
);
assert.equal(sourceReviewStatus({ ...sourceReviewBase, chapters: null }), "No linked source chapter");

const timeRangePattern = /^([01]\d|2[0-3])[:.]?([0-5]\d)\s*[-–]\s*([01]\d|2[0-3])[:.]?([0-5]\d)$/;
assert.equal(timeRangePattern.test("0800-1630"), true);
assert.equal(timeRangePattern.test("0900-2000"), true);
assert.equal(timeRangePattern.test("+7 (495) 215 1630"), false);

const travelAgentList =
  "Smart Travel 97165313533 Visachange@smarttravels.ae Clear Tour 97142955262 Mishal@dahrtours.com Travelers Choice 97165279272 malik@travellerschoice.ae Arooha 97142399903 shj@aroohatours.com Go Kite +971 42 386 066 a2a@kite.travel Hadaf +971 42 522486 ticketing@alhadaftourism.com Akbar +971 4356 1133 aegroupdesk@akbargulf.com Note the important points below, Visa change flights are applicable to MCT, KWI & BAH.";
const suppressedNames = [
  "smart travel",
  "clear tour",
  "travelers choice",
  "arooha",
  "go kite",
  "princess travel",
  "smart trip",
  "nawi saadi",
  "khyber",
  "hadaf",
  "akbar",
];
assert.equal(
  suppressedNames.filter((name) => travelAgentList.toLowerCase().includes(name)).length >= 5 &&
    travelAgentList.toLowerCase().includes("visa change flights"),
  true
);

// ---- Sync chapter-identity matching (inserted-middle-chapter regression) ----
const { resolveChapterIdentity, slugifyChapter, normalizeTitle } = await import(
  "../lib/sync-identity.ts"
);

// slugify parity with the historical publish-route behaviour.
assert.equal(slugifyChapter("Sporting Equipment"), "sporting-equipment");
assert.equal(slugifyChapter("Ways to Check-in"), "ways-to-check-in");
assert.equal(slugifyChapter("Connection and Transfers"), "connection-and-transfers");
assert.equal(normalizeTitle("Ways to  Check-in!"), "ways to check in");

// Existing chapters before the sync (numbers as currently stored).
const existing = [
  { id: "id-a", slug: "duplicate-booking", title: "Duplicate Booking", chapter_number: 1 },
  { id: "id-b", slug: "partner-inquiries", title: "Partner Inquiries", chapter_number: 2 },
  { id: "id-c", slug: "connection-and-transfers", title: "Connection and Transfers", chapter_number: 3 },
];

// Incoming PDF after MEDA is inserted in the middle: everything from
// Duplicate Booking onward shifts by +1.
const incoming = [
  { title: "Duplicate Booking", chapter_number: 1 },
  { title: "MEDA", chapter_number: 2 },
  { title: "Partner Inquiries", chapter_number: 3 },
  { title: "Connection and Transfers", chapter_number: 4 },
];

const resolved = incoming.map((c) => ({ title: c.title, ...resolveChapterIdentity(c, existing) }));

// MEDA is the only genuine insert.
const meda = resolved.find((r) => r.title === "MEDA");
assert.equal(meda.operation, "insert");
assert.equal(meda.existingId, null);
assert.equal(meda.slug, "meda");

// Every pre-existing chapter is an UPDATE of its stable id, matched by slug,
// even though its chapter_number shifted by +1.
const dup = resolved.find((r) => r.title === "Duplicate Booking");
assert.equal(dup.operation, "update");
assert.equal(dup.existingId, "id-a");
assert.equal(dup.matchedBy, "slug");

const partner = resolved.find((r) => r.title === "Partner Inquiries");
assert.equal(partner.operation, "update");
assert.equal(partner.existingId, "id-b");
assert.equal(partner.chapterNumberChanged, true); // 2 -> 3

const conx = resolved.find((r) => r.title === "Connection and Transfers");
assert.equal(conx.operation, "update");
assert.equal(conx.existingId, "id-c");
assert.equal(conx.chapterNumberChanged, true); // 3 -> 4

// No incoming chapter that matches an existing one is ever an insert, so no
// duplicate slug can be produced.
const insertSlugs = resolved.filter((r) => r.operation === "insert").map((r) => r.slug);
assert.deepEqual(insertSlugs, ["meda"]);
const existingSlugs = new Set(existing.map((c) => c.slug));
assert.equal(insertSlugs.some((s) => existingSlugs.has(s)), false);

// chapter_number must never establish identity: a renamed chapter keeping the
// same number is treated as a new insert, not an accidental update.
const renamed = resolveChapterIdentity(
  { title: "Totally New Chapter", chapter_number: 1 },
  existing
);
assert.equal(renamed.operation, "insert");
assert.equal(renamed.slug, "totally-new-chapter");

// Title match still resolves when a slug drifts but the title is unchanged.
const titleMatch = resolveChapterIdentity(
  { title: "Partner Inquiries", slug: "partner-inquiries-old" },
  [{ id: "id-b", slug: "partner-inquiries", title: "Partner Inquiries", chapter_number: 2 }]
);
assert.equal(titleMatch.operation, "update");
assert.equal(titleMatch.existingId, "id-b");

// ---- Publish plan: full atomic chapter-ordering repair ----
const { buildPublishPlan } = await import("../lib/sync-identity.ts");
const V = "81.2 (10-Jul-2026)";

// Smaller inserted-middle fixture (kept): existing 1..3, NEW inserted at 2.
{
  const existing = [
    { id: "id-a", slug: "a", title: "A", chapter_number: 1, body_text: "A-old", source_version: "80.8" },
    { id: "id-b", slug: "b", title: "B", chapter_number: 2, body_text: "B-old", source_version: "80.8" },
    { id: "id-c", slug: "c", title: "C", chapter_number: 3, body_text: "C-old", source_version: "80.8" },
  ];
  const incoming = [
    { chapter_number: 1, title: "A", new_body_text: "A-new" },
    { chapter_number: 2, title: "NEW", new_body_text: "NEW" },
    { chapter_number: 3, title: "B", new_body_text: "B-new" },
    { chapter_number: 4, title: "C", new_body_text: "C-new" },
  ];
  const p = buildPublishPlan(incoming, existing, V);
  assert.equal(p.ok, true);
  const byTitle = Object.fromEntries(p.operations.map((o) => [o.title, o]));
  assert.equal(byTitle["NEW"].op, "insert");
  assert.equal(byTitle["NEW"].finalNumber, 2);
  assert.equal(byTitle["B"].op, "update");
  assert.equal(byTitle["B"].chapterId, "id-b");
  assert.equal(byTitle["B"].finalNumber, 3);
  assert.equal(byTitle["C"].chapterId, "id-c");
  assert.ok(p.temporaryMoveIds.includes("id-b"));
  assert.ok(p.temporaryMoveIds.includes("id-c"));
  assert.equal(p.inserted, 1);
  const finals = p.operations.map((o) => o.finalNumber);
  assert.equal(new Set(finals).size, finals.length);
}

// (1) An already-applied row occupies a final number needed by a pending insert.
// A is fully applied at 1; NEW inserts at 2; B (content correct, wrong number)
// must move 2->3 so nothing blocks. If B were skipped, insert at 2 would collide.
{
  const existing = [
    { id: "id-a", slug: "a", title: "A", chapter_number: 1, body_text: "A", source_version: V },
    { id: "id-b", slug: "b", title: "B", chapter_number: 2, body_text: "B", source_version: V },
  ];
  const incoming = [
    { chapter_number: 1, title: "A", new_body_text: "A" }, // fully applied -> skip
    { chapter_number: 2, title: "NEW", new_body_text: "NEW" }, // insert at 2
    { chapter_number: 3, title: "B", new_body_text: "B" }, // content ok, number 2->3 -> renumber
  ];
  const p = buildPublishPlan(incoming, existing, V);
  assert.equal(p.ok, true);
  assert.equal(p.alreadyApplied, 1); // A
  const byTitle = Object.fromEntries(p.operations.map((o) => [o.title, o]));
  assert.equal(byTitle["NEW"].op, "insert");
  assert.equal(byTitle["B"].op, "renumber"); // number-only, no history
  assert.equal(byTitle["B"].finalNumber, 3);
  assert.ok(p.temporaryMoveIds.includes("id-b"));
  assert.equal(p.renumbered, 1);
}

// (5) Correct content/version but wrong final number is NOT alreadyApplied.
{
  const existing = [
    { id: "id-x", slug: "x", title: "X", chapter_number: 9, body_text: "x", source_version: V },
  ];
  const p = buildPublishPlan([{ chapter_number: 1, title: "X", new_body_text: "x" }], existing, V);
  assert.equal(p.ok, true);
  assert.equal(p.alreadyApplied, 0);
  assert.equal(p.operations[0].op, "renumber");
  assert.equal(p.operations[0].finalNumber, 1);
}

// A row fully correct (content + number) IS skipped.
{
  const existing = [{ id: "id-x", slug: "x", title: "X", chapter_number: 1, body_text: "x", source_version: V }];
  const p = buildPublishPlan([{ chapter_number: 1, title: "X", new_body_text: "x" }], existing, V);
  assert.equal(p.ok, true);
  assert.equal(p.alreadyApplied, 1);
  assert.equal(p.operations.length, 0);
}

// (2) A row has MEDA title/content but the duplicate-booking slug (earlier
// partial publish). Incoming MEDA resolves by TITLE to that row; incoming
// Duplicate Booking resolves by SLUG to the SAME row -> ambiguity + dup target.
{
  const existing = [
    { id: "id-r", slug: "duplicate-booking", title: "MEDA", chapter_number: 46, body_text: "meda", source_version: "80.8" },
  ];
  const incoming = [
    { chapter_number: 46, title: "MEDA", new_body_text: "meda" },
    { chapter_number: 47, title: "Duplicate Booking", new_body_text: "dup" },
  ];
  const p = buildPublishPlan(incoming, existing, V);
  assert.equal(p.ok, false);
  assert.ok(
    p.failed.some((f) => /AMBIGUOUS_SLUG_TITLE_MATCH/.test(f.safeMessage)) ||
      p.failed.some((f) => /DUPLICATE_TARGET_CHAPTER_ID/.test(f.safeMessage))
  );
}

// (3) Incoming MEDA resolves by title to duplicate-booking row while incoming
// Duplicate Booking resolves by slug to the same row: ambiguous-target failure.
{
  const existing = [
    { id: "id-r", slug: "duplicate-booking", title: "MEDA", chapter_number: 46, body_text: "m", source_version: "80.8" },
    { id: "id-o", slug: "other", title: "Other", chapter_number: 47, body_text: "o", source_version: "80.8" },
  ];
  const incoming = [
    { chapter_number: 46, title: "MEDA", new_body_text: "m" },
    { chapter_number: 47, title: "Duplicate Booking", new_body_text: "d" },
    { chapter_number: 48, title: "Other", new_body_text: "o2" },
  ];
  const p = buildPublishPlan(incoming, existing, V);
  assert.equal(p.ok, false);
  assert.ok(p.failed.some((f) => /AMBIGUOUS_SLUG_TITLE_MATCH|DUPLICATE_TARGET_CHAPTER_ID/.test(f.safeMessage)));
}

// (4) Two incoming changes resolve to the same existing id (both by slug/title).
{
  const existing = [{ id: "id-s", slug: "same", title: "Same", chapter_number: 5, body_text: "s", source_version: "80.8" }];
  const incoming = [
    { chapter_number: 1, title: "Same", new_body_text: "a", slug: "same" },
    { chapter_number: 2, title: "Same", new_body_text: "b", slug: "same" },
  ];
  const p = buildPublishPlan(incoming, existing, V);
  assert.equal(p.ok, false);
  // duplicate slug and/or duplicate target id must be reported
  assert.ok(p.failed.some((f) => /DUPLICATE_SLUG|DUPLICATE_TARGET_CHAPTER_ID/.test(f.safeMessage)));
}

// Untouched occupant of a required final number aborts (neighbour not included).
{
  const existing = [
    { id: "dup", slug: "duplicate-booking", title: "Duplicate Booking", chapter_number: 46, body_text: "d", source_version: "80.8" },
    { id: "visa", slug: "visa", title: "Visa", chapter_number: 47, body_text: "v", source_version: "80.8" },
  ];
  const incoming = [
    { chapter_number: 46, title: "MEDA", new_body_text: "meda" },
    { chapter_number: 47, title: "Duplicate Booking", new_body_text: "d2" }, // Visa (47) not included
  ];
  const p = buildPublishPlan(incoming, existing, V);
  assert.equal(p.ok, false);
  assert.ok(p.failed.some((f) => /FINAL_NUMBER_OCCUPIED_BY_UNTOUCHED_CHAPTER/.test(f.safeMessage)));
}

// (6) Full live-state repair: 78 existing (46..75 shifted, 76 absent, 77..79
// already correct), MEDA inserted at 46. Verify all invariants.
{
  const existing = [];
  const incoming = [];
  // 1..45 already applied (content + number correct)
  for (let n = 1; n <= 45; n++) {
    existing.push({ id: `id-${n}`, slug: `ch-${n}`, title: `Ch ${n}`, chapter_number: n, body_text: `b-${n}`, source_version: V });
    incoming.push({ chapter_number: n, title: `Ch ${n}`, new_body_text: `b-${n}` });
  }
  // MEDA insert at 46
  incoming.push({ chapter_number: 46, title: "MEDA", new_body_text: "meda", new_content_blocks: [{ type: "text", text: "m" }], new_keywords: ["meda"] });
  // existing 46..75 (old 80.8 content) shift to 47..76
  const names = {};
  for (let n = 46; n <= 75; n++) {
    const title = n === 75 ? "Pilot Recruitment" : `Existing ${n}`;
    const slug = n === 75 ? "pilot-recruitment" : `ex-${n}`;
    existing.push({ id: `id-${n}`, slug, title, chapter_number: n, body_text: `old-${n}`, source_version: "80.8" });
    incoming.push({ chapter_number: n + 1, title, new_body_text: `new-${n}`, new_content_blocks: null, new_keywords: null });
    names[n] = slug;
  }
  // 77..79 already correct (content V, correct number)
  const tail = { 77: ["digital-certificate", "Digital Certificate"], 78: ["blacklisted-customer", "Blacklisted Customer"], 79: ["flydubai-partner-inquiries", "flydubai Partner Inquiries"] };
  for (const n of [77, 78, 79]) {
    existing.push({ id: `id-${n}`, slug: tail[n][0], title: tail[n][1], chapter_number: n, body_text: `t-${n}`, source_version: V });
    incoming.push({ chapter_number: n, title: tail[n][1], new_body_text: `t-${n}` });
  }

  const p = buildPublishPlan(incoming, existing, V);
  assert.equal(p.ok, true);
  assert.equal(p.totalApproved, 79);
  // MEDA is the only insert.
  assert.equal(p.inserted, 1);
  const meda = p.operations.find((o) => o.slug === "meda");
  assert.equal(meda.op, "insert");
  assert.equal(meda.finalNumber, 46);
  // Pilot moves 75 -> 76.
  const pilot = p.operations.find((o) => o.slug === "pilot-recruitment");
  assert.equal(pilot.finalNumber, 76);
  assert.equal(pilot.numberChanges, true);
  // 1..45 and 77..79 fully applied -> skipped (48 rows).
  assert.equal(p.alreadyApplied, 48);
  // Chapters currently 46..75 are all in the temporary move set (30 rows).
  assert.equal(p.temporaryMoveIds.length, 30);
  for (let n = 46; n <= 75; n++) assert.ok(p.temporaryMoveIds.includes(`id-${n}`));
  // 77..79 keep their ids/numbers and are NOT moved.
  for (const n of [77, 78, 79]) assert.ok(!p.temporaryMoveIds.includes(`id-${n}`));
  // Every existing id is preserved (each update/renumber carries an existing id).
  const writeIds = p.operations.filter((o) => o.op !== "insert").map((o) => o.chapterId);
  assert.equal(new Set(writeIds).size, writeIds.length); // no duplicate target id
  // Final numbers of the full desired state = 1..79 exactly.
  const finalNumbers = new Set(incoming.map((c) => c.chapter_number));
  assert.equal(finalNumbers.size, 79);
  assert.equal(Math.min(...finalNumbers), 1);
  assert.equal(Math.max(...finalNumbers), 79);
  // Unique final slugs across everything (ops + skipped are all distinct).
  const opSlugs = p.operations.map((o) => o.slug);
  assert.equal(new Set(opSlugs).size, opSlugs.length);

  // Retry idempotency: after the repair, feed the target state back in.
  const repaired = [];
  // 1..45 unchanged
  for (let n = 1; n <= 45; n++) repaired.push({ id: `id-${n}`, slug: `ch-${n}`, title: `Ch ${n}`, chapter_number: n, body_text: `b-${n}`, source_version: V });
  // MEDA now exists at 46
  repaired.push({ id: "id-meda", slug: "meda", title: "MEDA", chapter_number: 46, body_text: "meda", source_version: V });
  // 46..75 now at 47..76 with new content
  for (let n = 46; n <= 75; n++) {
    const title = n === 75 ? "Pilot Recruitment" : `Existing ${n}`;
    const slug = n === 75 ? "pilot-recruitment" : `ex-${n}`;
    repaired.push({ id: `id-${n}`, slug, title, chapter_number: n + 1, body_text: `new-${n}`, source_version: V });
  }
  for (const n of [77, 78, 79]) repaired.push({ id: `id-${n}`, slug: tail[n][0], title: tail[n][1], chapter_number: n, body_text: `t-${n}`, source_version: V });

  const p2 = buildPublishPlan(incoming, repaired, V);
  assert.equal(p2.ok, true);
  assert.equal(p2.operations.length, 0); // nothing to do
  assert.equal(p2.alreadyApplied, 79);
  assert.equal(p2.temporaryMoveIds.length, 0);
}

// Empty approved selection: valid plan, nothing to do.
{
  const p = buildPublishPlan([], [], V);
  assert.equal(p.ok, true);
  assert.equal(p.operations.length, 0);
  assert.equal(p.totalApproved, 0);
}

// ---- Phase I: agent workspace local-state (pure transforms) ----
const {
  toggleFavorite,
  isFavorite,
  mergeLegacyPins,
  upsertRecent,
  sanitizeHistoryEntry,
  addDecisionHistory,
  incrementUsage,
  topUsed,
  formatOutcomeSummary,
  MAX_HISTORY,
} = await import("../lib/agent-workspace.ts");

// Favorites: toggle add/remove, keyed by kind+slug, distinct kinds coexist.
let favs = [];
favs = toggleFavorite(favs, { kind: "procedure", slug: "a", title: "A" });
favs = toggleFavorite(favs, { kind: "service", slug: "a", title: "A service" });
assert.equal(favs.length, 2);
assert.equal(isFavorite(favs, "procedure", "a"), true);
assert.equal(isFavorite(favs, "workflow", "a"), false);
favs = toggleFavorite(favs, { kind: "procedure", slug: "a", title: "A" }); // remove
assert.equal(isFavorite(favs, "procedure", "a"), false);
assert.equal(favs.length, 1);

// Legacy pins migrate in as procedure favorites, de-duped.
const migrated = mergeLegacyPins(
  [{ kind: "procedure", slug: "p1", title: "P1" }],
  [{ slug: "p1", title: "P1", code: "X" }, { slug: "p2", title: "P2", code: null }]
);
assert.equal(migrated.filter((f) => f.slug === "p1").length, 1);
assert.ok(migrated.some((f) => f.slug === "p2" && f.kind === "procedure"));

// Recent: newest first, de-dupe by slug, capped.
let rec = [];
for (let i = 0; i < 15; i++) rec = upsertRecent(rec, { slug: `s${i}`, title: "t", at: i }, 10);
assert.equal(rec.length, 10);
assert.equal(rec[0].slug, "s14");
rec = upsertRecent(rec, { slug: "s14", title: "t2", at: 99 }, 10);
assert.equal(rec.length, 10); // no duplicate
assert.equal(rec[0].slug, "s14");

// Decision history NEVER persists passenger data.
const withPII = addDecisionHistory([], {
  slug: "pregnancy",
  title: "Pregnancy",
  outcome: "Can proceed",
  at: 1,
  pnr: "ABC123",
  passenger_name: "John Doe",
  passport: "X1234",
});
assert.deepEqual(Object.keys(withPII[0]).sort(), ["at", "outcome", "slug", "title"]);
assert.equal("pnr" in withPII[0], false);
assert.equal("passport" in withPII[0], false);
assert.equal(sanitizeHistoryEntry({ outcome: "x" }), null); // missing slug -> dropped
// History capped at MAX_HISTORY.
let hist = [];
for (let i = 0; i < MAX_HISTORY + 5; i++) hist = addDecisionHistory(hist, { slug: `w${i}`, outcome: "o", at: i });
assert.equal(hist.length, MAX_HISTORY);

// Most used: counts, sorted desc, positive only.
let usage = {};
usage = incrementUsage(usage, "a");
usage = incrementUsage(usage, "a");
usage = incrementUsage(usage, "b");
assert.equal(usage.a, 2);
assert.deepEqual(topUsed(usage, 2), [
  { slug: "a", count: 2 },
  { slug: "b", count: 1 },
]);

// Copy summary contains outcome, action, advice, rule, source, version — no PII.
const summary = formatOutcomeSummary({
  title: "Pregnancy",
  outcome: "Requires document",
  nextAction: "Advise the certificate requirements",
  passengerAdvice: ["Only the original certificate is accepted"],
  matchedRuleId: "single-29-36",
  sourceChapter: "42. Pregnancy",
  sourcePages: [259],
  sourceVersion: "81.2 (10-Jul-2026)",
});
assert.ok(summary.includes("Outcome: Requires document"));
assert.ok(summary.includes("Required action: Advise the certificate requirements"));
assert.ok(summary.includes("Matched rule: single-29-36"));
assert.ok(summary.includes("Page 259"));
assert.ok(summary.includes("81.2 (10-Jul-2026)"));

console.log("Logic checks passed.");
