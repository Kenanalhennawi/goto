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

console.log("Logic checks passed.");
