// UPD-2: explicit chapter diff classification for the PDF Update Studio.
//
// Pure and dependency-free so the background worker, the Admin UI and the test
// suite all share one implementation. It classifies what changed between the
// live chapters and the chapters extracted from a newly uploaded manual.
//
// Identity resolution order is UNCHANGED from lib/sync-identity.ts:
//   1. slug   2. normalized title   3. chapter number
// Classification is driven by the BODY CONTENT, never by the changelog.
// Comparison uses normalized hashes; human-readable text is retained by the
// caller (sync_staged_changes keeps old_body_text / new_body_text).

import { normalizeTitle, slugifyChapter, stripChapterNumberPrefix } from "./sync-identity.ts";

export type ChangeClass =
  | "unchanged"
  | "metadata_only"
  | "content_changed"
  | "new"
  | "removed"
  | "renamed_moved";

export type IdentityMatchMethod = "slug" | "title" | "number" | "none";

export type LiveChapter = {
  id: string;
  slug: string;
  title: string;
  chapter_number: number | null;
  body_text: string | null;
  keywords?: string[] | null;
  page_start?: number | null;
  page_end?: number | null;
  source_version?: string | null;
};

export type ExtractedChapter = {
  title: string;
  slug?: string | null;
  chapter_number: number | null;
  body_text: string | null;
  keywords?: string[] | null;
  page_start?: number | null;
  page_end?: number | null;
  source_version?: string | null;
};

export type ChapterDiff = {
  changeClass: ChangeClass;
  identityMatchMethod: IdentityMatchMethod;
  existingId: string | null;
  slug: string;
  title: string;
  chapterNumber: number | null;
  oldPageStart: number | null;
  oldPageEnd: number | null;
  newPageStart: number | null;
  newPageEnd: number | null;
  oldSourceVersion: string | null;
  newSourceVersion: string | null;
  /** Human-readable reasons; safe to show in the Admin UI. */
  reasons: string[];
  /** True when several live chapters matched a tier and none was auto-chosen. */
  ambiguous?: boolean;
};

// ---------------------------------------------------------------------------
// Normalization + hashing
// ---------------------------------------------------------------------------

/** Collapse whitespace/case so reflowed PDF text does not read as a change. */
export function normalizeBody(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ /g, " ")
    .replace(/[^\p{L}\p{N}\s.,;:%/()+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Title without its leading chapter numbering ("34. Wheelchair" -> "wheelchair",
 * "26.6-26.9 WorldTracer" -> "worldtracer"). Renumbering a chapter changes the
 * prefix but not the topic, so identity comparisons must ignore it — otherwise
 * a pure renumber (v81.2 ch.34 -> v81.7 ch.35) is misread as a rename.
 */
export function titleCore(value: string | null | undefined): string {
  return normalizeTitle(
    (value ?? "").replace(/^\s*\d+(?:\.\d+)*\s*(?:[-–—]\s*\d+(?:\.\d+)*)?\s*[.)–—-]?\s*/, "")
  );
}

export function normalizeKeywords(values: string[] | null | undefined): string {
  return [...new Set((values ?? []).map((v) => normalizeTitle(v)).filter(Boolean))]
    .sort()
    .join("|");
}

/**
 * Deterministic, dependency-free 64-bit FNV-1a hash rendered as hex.
 * Used only to compare normalized content — never for security.
 */
export function contentHash(value: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ((c << 5) | (c >>> 3)), 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export function chapterContentHash(
  chapter: Pick<LiveChapter, "body_text" | "keywords">
): string {
  return contentHash(`${normalizeBody(chapter.body_text)}::${normalizeKeywords(chapter.keywords)}`);
}

// ---------------------------------------------------------------------------
// Identity resolution (same order as lib/sync-identity.ts)
// ---------------------------------------------------------------------------

/** Exactly one match => use it; several => ambiguous, never auto-matched. */
function uniqueMatch(
  live: LiveChapter[],
  predicate: (c: LiveChapter) => boolean
): { match: LiveChapter | null; ambiguous: boolean } {
  const hits = live.filter(predicate);
  if (hits.length === 1) return { match: hits[0], ambiguous: false };
  return { match: null, ambiguous: hits.length > 1 };
}

/**
 * UPD-2.7 deterministic identity resolution. No fuzzy or AI matching, and an
 * ambiguous tier is never auto-resolved — it falls through to `none` so a
 * human reviews it rather than two chapters being silently merged.
 *
 * Order: stable slug -> prefix-stripped slug -> prefix-stripped normalized
 * title -> titleCore -> chapter number (content-hash gated) -> unmatched.
 */
function resolveIdentity(
  incoming: ExtractedChapter,
  live: LiveChapter[]
): { match: LiveChapter | null; method: IdentityMatchMethod; ambiguous: boolean } {
  // (a) exact stable slug as provided by the extractor
  const slug = (incoming.slug ?? "").trim() || slugifyChapter(incoming.title);
  const bySlug = uniqueMatch(live, (c) => c.slug === slug);
  if (bySlug.match) return { match: bySlug.match, method: "slug", ambiguous: false };
  if (bySlug.ambiguous) return { match: null, method: "none", ambiguous: true };

  // (b) slug regenerated from the title WITHOUT its leading chapter number
  const strippedSlug = slugifyChapter(stripChapterNumberPrefix(incoming.title));
  if (strippedSlug && strippedSlug !== slug) {
    const byStripped = uniqueMatch(live, (c) => c.slug === strippedSlug);
    if (byStripped.match) return { match: byStripped.match, method: "slug", ambiguous: false };
    if (byStripped.ambiguous) return { match: null, method: "none", ambiguous: true };
  }

  // (c) normalized title without the leading chapter number
  const strippedTitle = normalizeTitle(stripChapterNumberPrefix(incoming.title));
  if (strippedTitle) {
    const byStrippedTitle = uniqueMatch(
      live,
      (c) => normalizeTitle(stripChapterNumberPrefix(c.title)) === strippedTitle
    );
    if (byStrippedTitle.match) return { match: byStrippedTitle.match, method: "title", ambiguous: false };
    if (byStrippedTitle.ambiguous) return { match: null, method: "none", ambiguous: true };
  }

  // (d) titleCore (punctuation-insensitive topic comparison)
  const core = titleCore(incoming.title);
  if (core) {
    const byCore = uniqueMatch(live, (c) => titleCore(c.title) === core);
    if (byCore.match) return { match: byCore.match, method: "title", ambiguous: false };
    if (byCore.ambiguous) return { match: null, method: "none", ambiguous: true };
  }

  // (e) chapter number, ONLY when the content hashes agree — otherwise a
  // renumber would masquerade as a content change.
  if (incoming.chapter_number !== null && incoming.chapter_number !== undefined) {
    const byNumber = uniqueMatch(live, (c) => c.chapter_number === incoming.chapter_number);
    if (
      byNumber.match &&
      chapterContentHash(byNumber.match) === chapterContentHash(incoming)
    ) {
      return { match: byNumber.match, method: "number", ambiguous: false };
    }
  }

  // (f) unmatched
  return { match: null, method: "none", ambiguous: false };
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

function pages(c: { page_start?: number | null; page_end?: number | null }) {
  return [c.page_start ?? null, c.page_end ?? null] as const;
}

function classifyMatched(
  incoming: ExtractedChapter,
  match: LiveChapter
): { changeClass: ChangeClass; reasons: string[] } {
  const reasons: string[] = [];
  const contentEqual = chapterContentHash(match) === chapterContentHash(incoming);

  if (!contentEqual) {
    reasons.push("Operational body text or keywords changed.");
    return { changeClass: "content_changed", reasons };
  }

  // Content identical from here on — only metadata may differ.
  const titleChanged = match.title.trim() !== incoming.title.trim();
  // Compare the topic, not the chapter numbering prefix.
  const titleMateriallyChanged = titleCore(match.title) !== titleCore(incoming.title);
  const numberChanged =
    incoming.chapter_number !== null &&
    incoming.chapter_number !== undefined &&
    match.chapter_number !== incoming.chapter_number;
  const slugChanged =
    Boolean(incoming.slug) && incoming.slug!.trim().length > 0 && incoming.slug !== match.slug;

  const [oldStart, oldEnd] = pages(match);
  const [newStart, newEnd] = pages(incoming);
  const pagesChanged = oldStart !== newStart || oldEnd !== newEnd;
  const versionChanged =
    (incoming.source_version ?? null) !== null &&
    (match.source_version ?? null) !== (incoming.source_version ?? null);

  // Materially renamed or moved: same content, different identity surface.
  if (titleMateriallyChanged || slugChanged) {
    if (titleMateriallyChanged) reasons.push("Chapter title changed materially.");
    if (slugChanged) reasons.push("Chapter slug changed.");
    if (numberChanged) reasons.push("Chapter number changed.");
    return { changeClass: "renamed_moved", reasons };
  }

  if (numberChanged || pagesChanged || versionChanged || titleChanged) {
    if (numberChanged) reasons.push("Chapter number changed (renumbering only).");
    if (pagesChanged) reasons.push("Source page range changed.");
    if (versionChanged) reasons.push("Source version changed.");
    if (titleChanged && !titleMateriallyChanged) reasons.push("Title formatting changed.");
    return { changeClass: "metadata_only", reasons };
  }

  reasons.push("No change detected.");
  return { changeClass: "unchanged", reasons };
}

/**
 * Classify a full extraction against the live chapters.
 * Returns one diff per incoming chapter PLUS one `removed` diff per live
 * chapter that the incoming manual no longer contains.
 */
export function classifyExtraction(
  incoming: ExtractedChapter[],
  live: LiveChapter[],
  targetSourceVersion: string | null = null
): ChapterDiff[] {
  const diffs: ChapterDiff[] = [];
  const matchedIds = new Set<string>();

  for (const chapter of incoming) {
    const { match, method, ambiguous } = resolveIdentity(chapter, live);
    const slug = (chapter.slug ?? "").trim() || slugifyChapter(chapter.title);

    if (!match) {
      diffs.push({
        changeClass: "new",
        identityMatchMethod: "none",
        existingId: null,
        slug,
        title: chapter.title,
        chapterNumber: chapter.chapter_number ?? null,
        oldPageStart: null,
        oldPageEnd: null,
        newPageStart: chapter.page_start ?? null,
        newPageEnd: chapter.page_end ?? null,
        oldSourceVersion: null,
        newSourceVersion: chapter.source_version ?? targetSourceVersion,
        reasons: ambiguous
          ? ["Several live chapters matched; resolve manually rather than merging."]
          : ["No matching chapter in the live manual."],
        ambiguous,
      });
      continue;
    }

    matchedIds.add(match.id);
    const { changeClass, reasons } = classifyMatched(chapter, match);
    diffs.push({
      changeClass,
      identityMatchMethod: method,
      existingId: match.id,
      slug: match.slug,
      title: chapter.title,
      chapterNumber: chapter.chapter_number ?? match.chapter_number ?? null,
      oldPageStart: match.page_start ?? null,
      oldPageEnd: match.page_end ?? null,
      newPageStart: chapter.page_start ?? null,
      newPageEnd: chapter.page_end ?? null,
      oldSourceVersion: match.source_version ?? null,
      newSourceVersion: chapter.source_version ?? targetSourceVersion,
      reasons,
    });
  }

  // Removed: live chapters the incoming manual no longer contains. These are
  // NEVER deleted automatically — they are staged for explicit owner review.
  for (const chapter of live) {
    if (matchedIds.has(chapter.id)) continue;
    diffs.push({
      changeClass: "removed",
      identityMatchMethod: "none",
      existingId: chapter.id,
      slug: chapter.slug,
      title: chapter.title,
      chapterNumber: chapter.chapter_number ?? null,
      oldPageStart: chapter.page_start ?? null,
      oldPageEnd: chapter.page_end ?? null,
      newPageStart: null,
      newPageEnd: null,
      oldSourceVersion: chapter.source_version ?? null,
      newSourceVersion: targetSourceVersion,
      reasons: ["Chapter is absent from the uploaded manual. Retained for review."],
    });
  }

  return diffs;
}

/** Classes an admin may bulk-approve. Content/new/removed always need eyes. */
export const AUTO_APPROVABLE_CLASSES: ChangeClass[] = ["unchanged", "metadata_only"];

export function isAutoApprovable(changeClass: ChangeClass): boolean {
  return AUTO_APPROVABLE_CLASSES.includes(changeClass);
}

// ---------------------------------------------------------------------------
// UPD-2.7: mass-reclassification guard
// ---------------------------------------------------------------------------

/** A run may not become review-ready when either ratio exceeds this. */
export const MASS_RECLASSIFICATION_THRESHOLD = 0.2;

export const MASS_RECLASSIFICATION_MESSAGE =
  "Chapter identity matching produced an unusually large number of new or removed chapters. " +
  "Review the extraction and matching configuration before continuing.";

export type ReclassificationGuard = {
  incomingCount: number;
  existingCount: number;
  newIncoming: number;
  removedExisting: number;
  newRatio: number;
  removedRatio: number;
  ambiguousCount: number;
  blocked: boolean;
};

/**
 * A correct manual update touches a minority of chapters. Mass new/removed
 * means identity matching failed (as in the v81.7 run: 78 new / 79 removed),
 * so the run must be blocked before review rather than published.
 */
export function evaluateReclassificationGuard(
  diffs: ChapterDiff[],
  incomingCount: number,
  existingCount: number
): ReclassificationGuard {
  const newIncoming = diffs.filter((d) => d.changeClass === "new").length;
  const removedExisting = diffs.filter((d) => d.changeClass === "removed").length;
  const ambiguousCount = diffs.filter((d) => d.ambiguous === true).length;
  const newRatio = incomingCount > 0 ? newIncoming / incomingCount : 0;
  const removedRatio = existingCount > 0 ? removedExisting / existingCount : 0;
  return {
    incomingCount,
    existingCount,
    newIncoming,
    removedExisting,
    newRatio,
    removedRatio,
    ambiguousCount,
    blocked:
      newRatio > MASS_RECLASSIFICATION_THRESHOLD ||
      removedRatio > MASS_RECLASSIFICATION_THRESHOLD,
  };
}

export function summarizeDiffs(diffs: ChapterDiff[]): Record<ChangeClass, number> {
  const summary: Record<ChangeClass, number> = {
    unchanged: 0,
    metadata_only: 0,
    content_changed: 0,
    new: 0,
    removed: 0,
    renamed_moved: 0,
  };
  for (const d of diffs) summary[d.changeClass] += 1;
  return summary;
}
