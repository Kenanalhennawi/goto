// UPD-2.7 — chapter identity match dry run.
//
// Compares a REAL export of the production chapters table against a real
// chapters.json extraction, offline. No database writes, no Supabase, no AI.
//
// Usage:
//   node scripts/dryrun-chapter-match.mjs \
//     --existing existing-chapters.json \
//     --incoming chapters.json [--json]
//
// Produce the export with:
//   select id, slug, title, chapter_number, body_text, search_keywords,
//          page_start, page_end, source_version
//     from chapters order by chapter_number;
//
// Exits non-zero when new > 20%, removed > 20%, duplicate slugs exist, or any
// ambiguous match was detected.
import { readFileSync } from "node:fs";

const {
  classifyExtraction,
  summarizeDiffs,
  evaluateReclassificationGuard,
  MASS_RECLASSIFICATION_THRESHOLD,
} = await import("../lib/sync-diff.ts");
const { slugifyChapter, stripChapterNumberPrefix, normalizeTitle } = await import(
  "../lib/sync-identity.ts"
);

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
}
const existingPath = arg("existing");
const incomingPath = arg("incoming");
const asJson = process.argv.includes("--json");

if (!existingPath || !incomingPath) {
  console.error(
    "usage: node scripts/dryrun-chapter-match.mjs --existing <export.json> --incoming <chapters.json> [--json]"
  );
  process.exit(2);
}

const load = (p) => JSON.parse(readFileSync(p, "utf8"));

// --- existing: a plain array, or { chapters: [...] } ---
const rawExisting = load(existingPath);
const existingRows = Array.isArray(rawExisting) ? rawExisting : (rawExisting.chapters ?? []);
const live = existingRows.map((c, i) => ({
  id: c.id ?? `existing-${i}`,
  slug: c.slug,
  title: c.title,
  chapter_number: c.chapter_number ?? null,
  body_text: c.body_text ?? null,
  keywords: c.search_keywords ?? c.keywords ?? null,
  page_start: c.page_start ?? null,
  page_end: c.page_end ?? null,
  source_version: c.source_version ?? null,
}));

// --- incoming: the extraction contract ---
const rawIncoming = load(incomingPath);
const incomingChapters = rawIncoming.chapters ?? [];
const targetVersion = rawIncoming.source?.version ?? null;
const incoming = incomingChapters.map((c) => ({
  title: c.title,
  slug: c.slug,
  chapter_number: Number(c.chapterNumber) || null,
  body_text: c.body,
  keywords: c.searchKeywords,
  page_start: c.pageStart,
  page_end: c.pageEnd,
  source_version: targetVersion,
}));

// --- duplicate slug detection (both sides) ---
function duplicates(values) {
  const seen = new Map();
  for (const v of values) seen.set(v, (seen.get(v) ?? 0) + 1);
  return [...seen.entries()].filter(([, n]) => n > 1).map(([v, n]) => `${v} x${n}`);
}
const dupIncoming = duplicates(incoming.map((c) => c.slug ?? slugifyChapter(c.title)));
const dupExisting = duplicates(live.map((c) => c.slug));

// --- per-tier match attribution (mirrors resolveIdentity's order) ---
const tally = {
  exactSlug: 0,
  strippedPrefixSlug: 0,
  normalizedTitle: 0,
  titleCore: 0,
  numberHash: 0,
  unmatched: 0,
};
for (const c of incoming) {
  const slug = (c.slug ?? "").trim() || slugifyChapter(c.title);
  const stripped = slugifyChapter(stripChapterNumberPrefix(c.title));
  const nt = normalizeTitle(stripChapterNumberPrefix(c.title));
  if (live.filter((l) => l.slug === slug).length === 1) tally.exactSlug++;
  else if (stripped !== slug && live.filter((l) => l.slug === stripped).length === 1)
    tally.strippedPrefixSlug++;
  else if (
    live.filter((l) => normalizeTitle(stripChapterNumberPrefix(l.title)) === nt).length === 1
  )
    tally.normalizedTitle++;
  else tally.unmatched++;
}

const diffs = classifyExtraction(incoming, live, targetVersion);
const classification = summarizeDiffs(diffs);
const guard = evaluateReclassificationGuard(diffs, incoming.length, live.length);

const methods = {};
for (const d of diffs) methods[d.identityMatchMethod] = (methods[d.identityMatchMethod] ?? 0) + 1;
tally.titleCore = Math.max(0, (methods.title ?? 0) - tally.normalizedTitle);
tally.numberHash = methods.number ?? 0;

const unmatchedIncoming = diffs.filter((d) => d.changeClass === "new").map((d) => d.title);
const unmatchedExisting = diffs.filter((d) => d.changeClass === "removed").map((d) => d.title);
const ambiguous = diffs.filter((d) => d.ambiguous === true).map((d) => d.title);

const report = {
  existingCount: live.length,
  incomingCount: incoming.length,
  matchedByExactSlug: tally.exactSlug,
  matchedByStrippedPrefixSlug: tally.strippedPrefixSlug,
  matchedByNormalizedTitle: tally.normalizedTitle,
  matchedByTitleCore: tally.titleCore,
  matchedByNumberHash: tally.numberHash,
  unmatchedIncoming: unmatchedIncoming.length,
  unmatchedExisting: unmatchedExisting.length,
  classification,
  newRatio: Number(guard.newRatio.toFixed(4)),
  removedRatio: Number(guard.removedRatio.toFixed(4)),
  ambiguousCount: ambiguous.length,
  duplicateSlugsIncoming: dupIncoming,
  duplicateSlugsExisting: dupExisting,
  guardBlocked: guard.blocked,
};

if (asJson) {
  console.log(JSON.stringify({ ...report, unmatchedIncoming, unmatchedExisting, ambiguous }, null, 2));
} else {
  console.log("Chapter identity match — dry run");
  console.log(`  existing chapters          ${report.existingCount}`);
  console.log(`  incoming chapters          ${report.incomingCount}`);
  console.log(`  matched: exact slug        ${report.matchedByExactSlug}`);
  console.log(`  matched: stripped-prefix   ${report.matchedByStrippedPrefixSlug}`);
  console.log(`  matched: normalized title  ${report.matchedByNormalizedTitle}`);
  console.log(`  matched: titleCore         ${report.matchedByTitleCore}`);
  console.log(`  matched: number + hash     ${report.matchedByNumberHash}`);
  console.log(`  unmatched incoming         ${report.unmatchedIncoming}`);
  console.log(`  unmatched existing         ${report.unmatchedExisting}`);
  console.log(`  classification             ${JSON.stringify(classification)}`);
  console.log(
    `  ratios                     new=${(report.newRatio * 100).toFixed(1)}%  removed=${(report.removedRatio * 100).toFixed(1)}%  (limit ${MASS_RECLASSIFICATION_THRESHOLD * 100}%)`
  );
  if (ambiguous.length) console.log(`  AMBIGUOUS                  ${ambiguous.length}: ${ambiguous.slice(0, 5).join(" | ")}`);
  if (dupIncoming.length) console.log(`  DUPLICATE slugs (incoming) ${dupIncoming.join(", ")}`);
  if (dupExisting.length) console.log(`  DUPLICATE slugs (existing) ${dupExisting.join(", ")}`);
  if (unmatchedIncoming.length) console.log(`  new:     ${unmatchedIncoming.slice(0, 10).map((t) => t.slice(0, 60)).join(" | ")}`);
  if (unmatchedExisting.length) console.log(`  removed: ${unmatchedExisting.slice(0, 10).map((t) => t.slice(0, 60)).join(" | ")}`);
}

const failures = [];
if (guard.newRatio > MASS_RECLASSIFICATION_THRESHOLD) failures.push("new ratio above 20%");
if (guard.removedRatio > MASS_RECLASSIFICATION_THRESHOLD) failures.push("removed ratio above 20%");
if (dupIncoming.length || dupExisting.length) failures.push("duplicate slugs");
if (ambiguous.length) failures.push("ambiguous matches");

if (failures.length) {
  console.error(`\nFAILED: ${failures.join("; ")}`);
  process.exit(1);
}
console.log("\nOK: identity matching is within safe limits.");
