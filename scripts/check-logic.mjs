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

// ---- Publish plan: atomic renumbering after an inserted middle chapter ----
const { buildPublishPlan } = await import("../lib/sync-identity.ts");

const V = "81.2 (10-Jul-2026)";
// Existing chapters at their OLD numbers/content.
const ex3 = [
  { id: "id-a", slug: "a", title: "A", chapter_number: 1, body_text: "A-old", source_version: "80.8" },
  { id: "id-b", slug: "b", title: "B", chapter_number: 2, body_text: "B-old", source_version: "80.8" },
  { id: "id-c", slug: "c", title: "C", chapter_number: 3, body_text: "C-old", source_version: "80.8" },
];
// Incoming after NEW is inserted at position 2: B->3, C->4.
const in3 = [
  { chapter_number: 1, title: "A", new_body_text: "A-new" },
  { chapter_number: 2, title: "NEW", new_body_text: "NEW-body" },
  { chapter_number: 3, title: "B", new_body_text: "B-new" },
  { chapter_number: 4, title: "C", new_body_text: "C-new" },
];
const plan1 = buildPublishPlan(in3, ex3, V);
assert.equal(plan1.ok, true);
const byTitle1 = Object.fromEntries(plan1.operations.map((o) => [o.title, o]));
assert.equal(byTitle1["NEW"].op, "insert");
assert.equal(byTitle1["NEW"].finalNumber, 2);
assert.equal(byTitle1["NEW"].slug, "new");
assert.equal(byTitle1["A"].op, "update");
assert.equal(byTitle1["A"].chapterId, "id-a");
assert.equal(byTitle1["B"].op, "update");
assert.equal(byTitle1["B"].chapterId, "id-b");
assert.equal(byTitle1["B"].finalNumber, 3);
assert.equal(byTitle1["C"].op, "update");
assert.equal(byTitle1["C"].chapterId, "id-c");
assert.equal(byTitle1["C"].finalNumber, 4);
// B and C are moved to temp first (they change number); every written update is.
assert.ok(plan1.tempRenumberIds.includes("id-b"));
assert.ok(plan1.tempRenumberIds.includes("id-c"));
// No duplicate final numbers, no duplicate slugs across operations.
const finals1 = plan1.operations.map((o) => o.finalNumber);
assert.equal(new Set(finals1).size, finals1.length);
const slugs1 = plan1.operations.map((o) => o.slug);
assert.equal(new Set(slugs1).size, slugs1.length);
// Existing ids preserved (no operation invents an id for A/B/C).
assert.equal(byTitle1["A"].chapterId, "id-a");

// Multiple inserted chapters.
const exM = [
  { id: "x", slug: "x", title: "X", chapter_number: 1, body_text: "x", source_version: "80.8" },
  { id: "y", slug: "y", title: "Y", chapter_number: 2, body_text: "y", source_version: "80.8" },
];
const inM = [
  { chapter_number: 1, title: "N1", new_body_text: "n1" },
  { chapter_number: 2, title: "X", new_body_text: "x2" },
  { chapter_number: 3, title: "N2", new_body_text: "n2" },
  { chapter_number: 4, title: "Y", new_body_text: "y2" },
];
const planM = buildPublishPlan(inM, exM, V);
assert.equal(planM.ok, true);
assert.equal(planM.operations.filter((o) => o.op === "insert").length, 2);
assert.equal(planM.operations.filter((o) => o.op === "update").length, 2);

// Reordered chapter (number changes, slug/title stable) resolves to update.
const exR = [
  { id: "p", slug: "p", title: "P", chapter_number: 5, body_text: "p", source_version: "80.8" },
  { id: "q", slug: "q", title: "Q", chapter_number: 6, body_text: "q", source_version: "80.8" },
];
const planR = buildPublishPlan(
  [
    { chapter_number: 6, title: "P", new_body_text: "p2" },
    { chapter_number: 5, title: "Q", new_body_text: "q2" },
  ],
  exR,
  V
);
assert.equal(planR.ok, true);
const byTitleR = Object.fromEntries(planR.operations.map((o) => [o.title, o]));
assert.equal(byTitleR["P"].op, "update");
assert.equal(byTitleR["P"].finalNumber, 6);
assert.equal(byTitleR["P"].numberChanges, true);
assert.equal(byTitleR["Q"].finalNumber, 5);

// Title punctuation change still matches the existing chapter (normalized title).
const planPunct = buildPublishPlan(
  [{ chapter_number: 1, title: "Ways to Check-in!", new_body_text: "z" }],
  [{ id: "w", slug: "ways-to-check-in-old", title: "Ways to Check-in", chapter_number: 1, body_text: "old", source_version: "80.8" }],
  V
);
assert.equal(planPunct.ok, true);
assert.equal(planPunct.operations[0].op, "update");
assert.equal(planPunct.operations[0].chapterId, "w");

// Duplicate incoming final number aborts before any write.
const dupNum = buildPublishPlan(
  [
    { chapter_number: 2, title: "One", new_body_text: "1" },
    { chapter_number: 2, title: "Two", new_body_text: "2" },
  ],
  [],
  V
);
assert.equal(dupNum.ok, false);
assert.ok(dupNum.failed.some((f) => /duplicate final chapter number/i.test(f.safeMessage)));

// Duplicate incoming slug aborts before any write.
const dupSlug = buildPublishPlan(
  [
    { chapter_number: 1, title: "Same Name", new_body_text: "1" },
    { chapter_number: 2, title: "Same Name", new_body_text: "2" },
  ],
  [],
  V
);
assert.equal(dupSlug.ok, false);
assert.ok(dupSlug.failed.some((f) => /duplicate chapter slug/i.test(f.safeMessage)));

// Non-positive number aborts.
const badNum = buildPublishPlan([{ chapter_number: 0, title: "Z", new_body_text: "z" }], [], V);
assert.equal(badNum.ok, false);
assert.ok(badNum.failed.some((f) => /positive integer/i.test(f.safeMessage)));

// Retry idempotency: chapters already at target content+version are skipped.
const exApplied = [
  { id: "id-a", slug: "a", title: "A", chapter_number: 1, body_text: "A-new", source_version: V },
  { id: "id-b", slug: "b", title: "B", chapter_number: 3, body_text: "B-new", source_version: V },
  { id: "id-c", slug: "c", title: "C", chapter_number: 3, body_text: "C-old", source_version: "80.8" },
];
const planRetry = buildPublishPlan(
  [
    { chapter_number: 1, title: "A", new_body_text: "A-new" }, // already applied
    { chapter_number: 2, title: "NEW", new_body_text: "NEW" }, // still insert
    { chapter_number: 4, title: "C", new_body_text: "C-new" }, // still needs write
  ],
  exApplied,
  V
);
assert.equal(planRetry.ok, true);
assert.equal(planRetry.alreadyApplied, 1); // A skipped
assert.equal(planRetry.operations.some((o) => o.title === "A"), false);
assert.equal(planRetry.operations.find((o) => o.title === "NEW").op, "insert");
assert.equal(planRetry.operations.find((o) => o.title === "C").op, "update");

// A chapter whose number does not change is still updated (content differs).
const planSameNum = buildPublishPlan(
  [{ chapter_number: 1, title: "A", new_body_text: "A-new" }],
  [{ id: "id-a", slug: "a", title: "A", chapter_number: 1, body_text: "A-old", source_version: "80.8" }],
  V
);
assert.equal(planSameNum.operations[0].op, "update");
assert.equal(planSameNum.operations[0].numberChanges, false);

// Empty approved selection: valid plan with nothing to do.
const planEmpty = buildPublishPlan([], ex3, V);
assert.equal(planEmpty.ok, true);
assert.equal(planEmpty.operations.length, 0);
assert.equal(planEmpty.totalApproved, 0);

console.log("Logic checks passed.");
