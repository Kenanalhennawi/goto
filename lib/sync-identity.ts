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
  /**
   * insert   — a genuinely new chapter (e.g. MEDA).
   * update   — an existing chapter whose content and/or number must change
   *            (rewrites content and logs edit_history).
   * renumber — an existing chapter whose content is already correct but whose
   *            chapter_number is wrong (number-only fix, no content, no history).
   */
  op: "insert" | "update" | "renumber";
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
      /** All writes the RPC performs: inserts, content updates, renumbers. */
      operations: PublishOperation[];
      /**
       * Explicit, unique list of existing chapter ids the RPC must move to a
       * temporary number BEFORE assigning final numbers. Derived from the full
       * plan, not just update operations.
       */
      temporaryMoveIds: string[];
      /** Rows fully correct already (content + version + title + number): skipped. */
      alreadyApplied: number;
      /** Number-only repairs (content already correct, number wrong). */
      renumbered: number;
      /** Content updates (content/title/version differs). */
      updated: number;
      /** New chapters inserted (MEDA). */
      inserted: number;
      /** Count of approved rows considered. */
      totalApproved: number;
    };

export function countWords(text: string | null | undefined): number {
  return (text ?? "").split(/\s+/).filter(Boolean).length;
}

type Resolution = {
  incomingSlug: string;
  resolved: ExistingChapterContent | null;
  bySlug: ExistingChapterContent | null;
  byTitle: ExistingChapterContent | null;
  ambiguous: boolean;
};

function resolveDetail(
  change: IncomingStagedChange,
  existing: ExistingChapterContent[]
): Resolution {
  const incomingSlug =
    change.slug && change.slug.trim().length > 0
      ? change.slug.trim()
      : slugifyChapter(change.title);
  const bySlug = existing.find((e) => e.slug === incomingSlug) ?? null;
  const nt = normalizeTitle(change.title);
  const byTitle = nt.length > 0 ? existing.find((e) => normalizeTitle(e.title) === nt) ?? null : null;
  const byId =
    change.chapter_id && change.chapter_id.trim().length > 0
      ? existing.find((e) => e.id === change.chapter_id) ?? null
      : null;
  const resolved = bySlug ?? byTitle ?? byId ?? null;
  // Ambiguous when slug and title point at DIFFERENT existing rows: an earlier
  // partial publish may have moved a title onto the wrong stable id.
  const ambiguous = !!(bySlug && byTitle && bySlug.id !== byTitle.id);
  return { incomingSlug, resolved, bySlug, byTitle, ambiguous };
}

/**
 * Build the complete, atomic publish plan from ALL approved staged changes.
 *
 * Correctness invariants enforced before any write (any failure aborts):
 *   - unique final slugs and unique final chapter numbers
 *   - positive integer chapter numbers
 *   - no existing chapter id targeted by two incoming changes (DUPLICATE_TARGET_CHAPTER_ID)
 *   - no slug/title ambiguity (AMBIGUOUS_SLUG_TITLE_MATCH)
 *   - every existing row occupying a required final number is either that
 *     number's target or in the temporary-move set (FINAL_NUMBER_OCCUPIED_BY_UNTOUCHED_CHAPTER)
 *
 * A row is only skipped as already-applied when its resolved id/slug, title,
 * final chapter_number, source version AND body all match. A row with correct
 * content but the wrong number is a renumber (kept in the numbering plan).
 */
export function buildPublishPlan(
  approved: IncomingStagedChange[],
  existing: ExistingChapterContent[],
  targetSourceVersion: string | null
): PublishPlan {
  const failures: PublishFailure[] = [];
  const seenSlugs = new Set<string>();
  const seenNumbers = new Set<number>();
  const targetById = new Map<string, number>(); // existing id -> incoming number

  // --- Validation pass over identity + uniqueness (no DB writes yet).
  for (const change of approved) {
    const detail = resolveDetail(change, existing);
    const slug = detail.resolved ? detail.resolved.slug : detail.incomingSlug;
    const finalNumber = change.chapter_number;

    if (!Number.isInteger(finalNumber) || finalNumber < 1) {
      failures.push({
        chapterNumber: finalNumber,
        slug,
        safeMessage: "INVALID_FINAL_NUMBER: chapter number must be a positive integer.",
      });
    }
    if (detail.ambiguous) {
      failures.push({
        chapterNumber: finalNumber,
        slug,
        safeMessage: `AMBIGUOUS_SLUG_TITLE_MATCH: "${change.title}" resolves to different rows by slug (${detail.bySlug?.slug}) and by title (${detail.byTitle?.slug}).`,
      });
    }
    if (seenSlugs.has(slug)) {
      failures.push({
        chapterNumber: finalNumber,
        slug,
        safeMessage: `DUPLICATE_SLUG: ${slug} appears more than once in this sync.`,
      });
    } else {
      seenSlugs.add(slug);
    }
    if (seenNumbers.has(finalNumber)) {
      failures.push({
        chapterNumber: finalNumber,
        slug,
        safeMessage: `DUPLICATE_FINAL_NUMBER: ${finalNumber} appears more than once in this sync.`,
      });
    } else {
      seenNumbers.add(finalNumber);
    }
    if (detail.resolved) {
      const prior = targetById.get(detail.resolved.id);
      if (prior !== undefined && prior !== finalNumber) {
        failures.push({
          chapterNumber: finalNumber,
          slug,
          safeMessage: `DUPLICATE_TARGET_CHAPTER_ID: existing chapter ${detail.resolved.slug} is targeted by chapters ${prior} and ${finalNumber}.`,
        });
      } else {
        targetById.set(detail.resolved.id, finalNumber);
      }
    }
  }

  if (failures.length > 0) {
    return { ok: false, failed: failures };
  }

  // --- Build pass: classify and assemble operations.
  const operations: PublishOperation[] = [];
  const moveIds = new Set<string>();
  let alreadyApplied = 0;
  let renumbered = 0;
  let updated = 0;
  let inserted = 0;

  for (const change of approved) {
    const detail = resolveDetail(change, existing);
    const finalNumber = change.chapter_number;
    const bodyText = change.new_body_text ?? "";
    const wordCount = countWords(bodyText);
    const contentBlocks = change.new_content_blocks ?? null;
    const keywords = change.new_keywords ?? null;

    if (!detail.resolved) {
      inserted++;
      operations.push({
        op: "insert",
        chapterId: null,
        slug: detail.incomingSlug,
        finalNumber,
        title: change.title,
        bodyText,
        contentBlocks,
        keywords,
        wordCount,
        numberChanges: false,
      });
      continue;
    }

    const current = detail.resolved;
    const numberChanges = (current.chapter_number ?? null) !== finalNumber;
    const contentMatches =
      current.body_text != null &&
      current.body_text === bodyText &&
      (current.source_version ?? null) === (targetSourceVersion ?? null) &&
      normalizeTitle(current.title) === normalizeTitle(change.title);

    if (contentMatches && !numberChanges) {
      // Fully correct: same content, version, title and number -> skip entirely.
      alreadyApplied++;
      continue;
    }

    if (contentMatches && numberChanges) {
      // Content correct but number wrong -> number-only repair, no history.
      renumbered++;
      moveIds.add(current.id);
      operations.push({
        op: "renumber",
        chapterId: current.id,
        slug: current.slug,
        finalNumber,
        title: change.title,
        bodyText,
        contentBlocks,
        keywords,
        wordCount,
        numberChanges: true,
      });
      continue;
    }

    // Content differs -> content update (also fixes number if needed).
    updated++;
    if (numberChanges) moveIds.add(current.id);
    operations.push({
      op: "update",
      chapterId: current.id,
      slug: current.slug,
      finalNumber,
      title: change.title,
      bodyText,
      contentBlocks,
      keywords,
      wordCount,
      numberChanges,
    });
  }

  // --- Occupant coverage: every existing row sitting on a required final number
  // must be the number's own target OR be in the temporary-move set. Otherwise
  // the final write would collide (chapters_chapter_number_key).
  const conflicts: PublishFailure[] = [];
  for (const operation of operations) {
    const occupant = existing.find((e) => e.chapter_number === operation.finalNumber);
    if (!occupant) continue;
    const isOwnTarget = occupant.id === operation.chapterId; // renumber/update in place
    if (isOwnTarget) continue;
    if (!moveIds.has(occupant.id)) {
      conflicts.push({
        chapterNumber: operation.finalNumber,
        slug: operation.slug,
        safeMessage: `FINAL_NUMBER_OCCUPIED_BY_UNTOUCHED_CHAPTER: number ${operation.finalNumber} is held by "${occupant.slug}", which this publish does not move. Approve/include it, then retry.`,
      });
    }
  }

  if (conflicts.length > 0) {
    return { ok: false, failed: conflicts };
  }

  return {
    ok: true,
    operations,
    temporaryMoveIds: Array.from(moveIds),
    alreadyApplied,
    renumbered,
    updated,
    inserted,
    totalApproved: approved.length,
  };
}
