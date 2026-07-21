// Chapter identity matching for the PDF sync publish step.
//
// Permanent fix for the "inserted middle chapter" bug: when a new chapter is
// inserted (e.g. MEDA), every later chapter's chapter_number shifts by +1.
// The old logic matched chapters by chapter_number, so existing chapters were
// misclassified as new inserts and publish crashed on chapters_slug_key.
//
// Identity is resolved by STABLE attributes, never by chapter_number:
//   1. existing slug            (incoming slug, or slugified title, vs chapters.slug)
//   2. normalized title         (case/punctuation-insensitive title match)
//   3. explicit id mapping      (incoming chapter_id, if the generator supplies one)
//   4. chapter_number           (diagnostics only — reported, never used to match)
//
// If any of 1-3 matches an existing chapter, the operation is an UPDATE of that
// exact chapter id. Only when nothing matches is it an INSERT.

export type ExistingChapter = {
  id: string;
  slug: string;
  title: string;
  chapter_number?: number | null;
};

export type IncomingChapter = {
  title: string;
  /** Optional slug from the generator; falls back to slugified title. */
  slug?: string | null;
  /** Optional explicit id mapping from the generator. */
  chapter_id?: string | null;
  /** Diagnostics only — never used to establish identity. */
  chapter_number?: number | null;
};

export type ChapterIdentity =
  | {
      operation: "update";
      existingId: string;
      /** The existing chapter's slug is kept stable across renumbering. */
      slug: string;
      matchedBy: "slug" | "title" | "id";
      /** Diagnostic: incoming chapter_number differs from the stored one. */
      chapterNumberChanged: boolean;
    }
  | {
      operation: "insert";
      existingId: null;
      slug: string;
      matchedBy: null;
      chapterNumberChanged: false;
    };

/**
 * Slugify a chapter title. Kept identical to the historical publish-route
 * slugify so slugs match chapters created by earlier syncs.
 */
export function slugifyChapter(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .slice(0, 60);
}

/** Normalize a title for punctuation/case-insensitive comparison. */
export function normalizeTitle(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Resolve whether an incoming chapter is an update of an existing chapter or a
 * brand-new insert, using slug/title/id — never chapter_number.
 */
export function resolveChapterIdentity(
  incoming: IncomingChapter,
  existing: ExistingChapter[]
): ChapterIdentity {
  const incomingSlug =
    incoming.slug && incoming.slug.trim().length > 0
      ? incoming.slug.trim()
      : slugifyChapter(incoming.title);

  // 1. existing slug
  let match = existing.find((chapter) => chapter.slug === incomingSlug) ?? null;
  let matchedBy: "slug" | "title" | "id" | null = match ? "slug" : null;

  // 2. normalized title
  if (!match) {
    const target = normalizeTitle(incoming.title);
    if (target.length > 0) {
      match = existing.find((chapter) => normalizeTitle(chapter.title) === target) ?? null;
      if (match) matchedBy = "title";
    }
  }

  // 3. explicit id mapping
  if (!match && incoming.chapter_id && incoming.chapter_id.trim().length > 0) {
    match = existing.find((chapter) => chapter.id === incoming.chapter_id) ?? null;
    if (match) matchedBy = "id";
  }

  // 4. chapter_number is intentionally NOT consulted for identity.

  if (match && matchedBy) {
    const chapterNumberChanged =
      incoming.chapter_number != null &&
      match.chapter_number != null &&
      incoming.chapter_number !== match.chapter_number;
    return {
      operation: "update",
      existingId: match.id,
      slug: match.slug,
      matchedBy,
      chapterNumberChanged,
    };
  }

  return {
    operation: "insert",
    existingId: null,
    slug: incomingSlug,
    matchedBy: null,
    chapterNumberChanged: false,
  };
}
