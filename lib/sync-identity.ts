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

// ---------------------------------------------------------------------------
// Publish planning: turn approved staged changes + existing chapters into a
// safe, atomic operation plan. Inserting a chapter in the middle shifts later
// chapter_numbers; because chapter_number is UNIQUE, the plan is executed in
// two phases (temp renumber, then final) by the publish_sync_chapters RPC.
// This builder is pure so it can be unit-tested without a database.
// ---------------------------------------------------------------------------

/** Existing chapter with the content needed to detect already-applied rows. */
export type ExistingChapterContent = ExistingChapter & {
  body_text?: string | null;
  source_version?: string | null;
};

/** An approved staged change coming from the sync run. */
export type IncomingStagedChange = {
  chapter_number: number;
  title: string;
  new_body_text: string | null;
  new_content_blocks?: unknown[] | null;
  new_keywords?: string[] | null;
  /** Optional explicit slug / id, if the generator ever provides them. */
  slug?: string | null;
  chapter_id?: string | null;
};

/** A single write the RPC will perform, with the final (post-shift) number. */
export type PublishOperation = {
  op: "update" | "insert";
  chapterId: string | null;
  slug: string;
  finalNumber: number;
  title: string;
  bodyText: string;
  contentBlocks: unknown[] | null;
  keywords: string[] | null;
  wordCount: number;
  /** Diagnostic: final number differs from the current stored number. */
  numberChanges: boolean;
};

export type PublishFailure = {
  chapterNumber: number;
  slug: string;
  safeMessage: string;
};

export type PublishPlan =
  | { ok: false; failed: PublishFailure[] }
  | {
      ok: true;
      /** Operations that must be written (already-applied rows are excluded). */
      operations: PublishOperation[];
      /** Count of approved rows whose content already matches the target. */
      alreadyApplied: number;
      /** Count of approved rows considered. */
      totalApproved: number;
      /** Chapter ids the RPC will move to a temporary number first. */
      tempRenumberIds: string[];
    };

export function countWords(text: string | null | undefined): number {
  return (text ?? "").split(/\s+/).filter(Boolean).length;
}

/**
 * Build the two-phase publish plan. Validation errors (duplicate slug,
 * duplicate final number, non-positive number) abort the whole batch before
 * any write is attempted. Rows whose stored content already equals the target
 * (body_text + source_version) are classified as already-applied and skipped,
 * so retrying a partial publish is idempotent.
 */
export function buildPublishPlan(
  approved: IncomingStagedChange[],
  existing: ExistingChapterContent[],
  targetSourceVersion: string | null
): PublishPlan {
  const failures: PublishFailure[] = [];
  const seenSlugs = new Set<string>();
  const seenNumbers = new Set<number>();

  // --- Validation pass: never touch the database if the batch is inconsistent.
  for (const change of approved) {
    const identity = resolveChapterIdentity(
      {
        title: change.title,
        slug: change.slug ?? null,
        chapter_id: change.chapter_id ?? null,
        chapter_number: change.chapter_number,
      },
      existing
    );
    const slug = identity.slug;
    const finalNumber = change.chapter_number;

    if (!Number.isInteger(finalNumber) || finalNumber < 1) {
      failures.push({
        chapterNumber: finalNumber,
        slug,
        safeMessage: "Chapter number must be a positive integer.",
      });
    }
    if (seenSlugs.has(slug)) {
      failures.push({
        chapterNumber: finalNumber,
        slug,
        safeMessage: `Duplicate chapter slug in this sync: ${slug}.`,
      });
    } else {
      seenSlugs.add(slug);
    }
    if (seenNumbers.has(finalNumber)) {
      failures.push({
        chapterNumber: finalNumber,
        slug,
        safeMessage: `Duplicate final chapter number in this sync: ${finalNumber}.`,
      });
    } else {
      seenNumbers.add(finalNumber);
    }
  }

  if (failures.length > 0) {
    return { ok: false, failed: failures };
  }

  // --- Build pass: classify already-applied and assemble write operations.
  const operations: PublishOperation[] = [];
  const tempRenumberIds: string[] = [];
  let alreadyApplied = 0;

  for (const change of approved) {
    const identity = resolveChapterIdentity(
      {
        title: change.title,
        slug: change.slug ?? null,
        chapter_id: change.chapter_id ?? null,
        chapter_number: change.chapter_number,
      },
      existing
    );
    const slug = identity.slug;
    const finalNumber = change.chapter_number;
    const bodyText = change.new_body_text ?? "";
    const wordCount = countWords(bodyText);
    const contentBlocks = change.new_content_blocks ?? null;
    const keywords = change.new_keywords ?? null;

    if (identity.operation === "update") {
      const current = existing.find((c) => c.id === identity.existingId);
      const currentNumber = current?.chapter_number ?? null;
      const numberChanges = currentNumber == null ? true : currentNumber !== finalNumber;

      // Already applied: stored body + source version already equal the target.
      const alreadyMatches =
        current != null &&
        current.body_text != null &&
        current.body_text === bodyText &&
        (current.source_version ?? null) === (targetSourceVersion ?? null);

      if (alreadyMatches) {
        alreadyApplied++;
        continue;
      }

      operations.push({
        op: "update",
        chapterId: identity.existingId,
        slug,
        finalNumber,
        title: change.title,
        bodyText,
        contentBlocks,
        keywords,
        wordCount,
        numberChanges,
      });
      // Every written update is moved to a temp number first so its old number
      // can be reused by another shifted chapter without a collision.
      tempRenumberIds.push(identity.existingId);
    } else {
      operations.push({
        op: "insert",
        chapterId: null,
        slug,
        finalNumber,
        title: change.title,
        bodyText,
        contentBlocks,
        keywords,
        wordCount,
        numberChanges: false,
      });
    }
  }

  // Cross-batch collision guard: a final number must not be permanently held
  // by an existing chapter that this publish does NOT move. This happens when a
  // shifted chapter's neighbour was not approved/included — the atomic write
  // would then roll back on chapters_chapter_number_key. Detect it up front and
  // report exactly which chapter blocks the number.
  const movedIds = new Set(tempRenumberIds);
  const conflicts: PublishFailure[] = [];
  for (const operation of operations) {
    const blocker = existing.find(
      (c) => c.chapter_number === operation.finalNumber && !movedIds.has(c.id)
    );
    if (blocker) {
      conflicts.push({
        chapterNumber: operation.finalNumber,
        slug: operation.slug,
        safeMessage: `Chapter number ${operation.finalNumber} is still used by "${blocker.slug}", which is not part of this publish. Approve that chapter too, then retry.`,
      });
    }
  }

  if (conflicts.length > 0) {
    return { ok: false, failed: conflicts };
  }

  return {
    ok: true,
    operations,
    alreadyApplied,
    totalApproved: approved.length,
    tempRenumberIds,
  };
}
