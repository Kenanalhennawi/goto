// UPD-2: impact analysis for a staged PDF sync.
//
// Pure and dependency-free. Given the classified chapter diffs, the live
// procedure cards and the registered decision workflows, it REPORTS what a
// chapter publication would affect. It never mutates anything: no card is
// approved or published, no decision tree is edited, no version is bumped.
//
// This is the control that would have caught the v81.2 -> v81.7 drift, where
// deployed trees moved to a new manual version while the cards stayed behind
// and every guided workflow silently became unavailable.

import type { ChangeClass, ChapterDiff } from "./sync-diff.ts";

export type ImpactType =
  | "chapter"
  | "procedure_card"
  | "workflow"
  | "search_term"
  | "orphaned_source";

export type ImpactStatus = "ok" | "review" | "blocked";

export type ImpactItem = {
  impactType: ImpactType;
  entitySlug: string;
  entityTitle: string;
  currentVersion: string | null;
  targetVersion: string | null;
  status: ImpactStatus;
  reason: string;
  requiresManualReview: boolean;
};

export type ImpactCard = {
  slug: string;
  title: string;
  chapter_id: string | null;
  source_version: string | null;
  review_status: string;
  is_published: boolean;
};

export type ImpactWorkflow = {
  slug: string;
  title: string;
  sourceVersion: string;
  sourcePages: number[];
};

const CHANGED_CLASSES: ChangeClass[] = ["content_changed", "new", "renamed_moved", "removed"];

/** Extract the numeric version ("81.7") from a stored version string. */
export function versionOf(value: string | null | undefined): string | null {
  const match = (value ?? "").match(/(\d+\.\d+)/);
  return match ? match[1] : null;
}

function pageRange(start: number | null, end: number | null): number[] {
  if (start === null) return [];
  const last = end ?? start;
  const out: number[] = [];
  for (let p = start; p <= last; p++) out.push(p);
  return out;
}

/**
 * Build the full impact report for a staged run.
 * `targetVersion` is the version parsed from the uploaded manual.
 */
export function buildImpactReport(input: {
  diffs: ChapterDiff[];
  cards: ImpactCard[];
  workflows: ImpactWorkflow[];
  targetVersion: string | null;
}): ImpactItem[] {
  const { diffs, cards, workflows, targetVersion } = input;
  const target = versionOf(targetVersion);
  const items: ImpactItem[] = [];

  const changedDiffs = diffs.filter((d) => CHANGED_CLASSES.includes(d.changeClass));
  const changedChapterIds = new Set(
    changedDiffs.map((d) => d.existingId).filter((id): id is string => Boolean(id))
  );
  const removedChapterIds = new Set(
    diffs.filter((d) => d.changeClass === "removed").map((d) => d.existingId).filter(Boolean)
  );

  // Pages touched by any changed chapter (old and new ranges both count: a
  // shifted page range can invalidate a tree's sourcePages citation).
  const touchedPages = new Set<number>();
  for (const d of changedDiffs) {
    for (const p of pageRange(d.oldPageStart, d.oldPageEnd)) touchedPages.add(p);
    for (const p of pageRange(d.newPageStart, d.newPageEnd)) touchedPages.add(p);
  }

  // ---- 1. Chapters ----
  for (const d of diffs) {
    if (d.changeClass === "unchanged") continue;
    const removed = d.changeClass === "removed";
    items.push({
      impactType: "chapter",
      entitySlug: d.slug,
      entityTitle: d.title,
      currentVersion: d.oldSourceVersion,
      targetVersion: d.newSourceVersion,
      // A removed chapter blocks completion until an owner decides.
      status: removed ? "blocked" : d.changeClass === "metadata_only" ? "ok" : "review",
      reason: d.reasons.join(" "),
      requiresManualReview: d.changeClass !== "metadata_only",
    });
  }

  // ---- 2. Procedure cards ----
  for (const card of cards) {
    const linkedToRemoved = card.chapter_id !== null && removedChapterIds.has(card.chapter_id);
    const linkedToChanged = card.chapter_id !== null && changedChapterIds.has(card.chapter_id);
    const cardVersion = versionOf(card.source_version);
    const versionMismatch = Boolean(target) && cardVersion !== target;

    if (linkedToRemoved) {
      items.push({
        impactType: "procedure_card",
        entitySlug: card.slug,
        entityTitle: card.title,
        currentVersion: card.source_version,
        targetVersion,
        status: "blocked",
        reason:
          "Linked source chapter is absent from the uploaded manual. An owner must confirm before this stays live.",
        requiresManualReview: true,
      });
      continue;
    }

    if (linkedToChanged || versionMismatch) {
      items.push({
        impactType: "procedure_card",
        entitySlug: card.slug,
        entityTitle: card.title,
        currentVersion: card.source_version,
        targetVersion,
        status: "review",
        reason: linkedToChanged
          ? "Linked source chapter content changed; review the card against the new source."
          : `Card source version (${card.source_version ?? "unset"}) does not match the uploaded manual.`,
        requiresManualReview: true,
      });
      continue;
    }

    if (card.chapter_id === null) {
      items.push({
        impactType: "procedure_card",
        entitySlug: card.slug,
        entityTitle: card.title,
        currentVersion: card.source_version,
        targetVersion,
        status: "review",
        reason: "Card is not linked to a source chapter.",
        requiresManualReview: true,
      });
    }
  }

  // ---- 3. Workflows (report only — trees are never edited automatically) ----
  const cardBySlug = new Map(cards.map((c) => [c.slug, c]));
  for (const wf of workflows) {
    const card = cardBySlug.get(wf.slug);
    const treeVersion = versionOf(wf.sourceVersion);
    const cardVersion = versionOf(card?.source_version);
    const pagesIntersect = wf.sourcePages.some((p) => touchedPages.has(p));
    const linkedToRemoved =
      card?.chapter_id != null && removedChapterIds.has(card.chapter_id);
    const linkedToChanged =
      card?.chapter_id != null && changedChapterIds.has(card.chapter_id);

    // Would the availability guard switch this workflow off after publication?
    const willBecomeUnavailable =
      !card || card.review_status !== "approved" || !card.is_published || cardVersion !== treeVersion;

    const reasons: string[] = [];
    if (!card) reasons.push("No published procedure card exists for this workflow.");
    else {
      if (card.review_status !== "approved" || !card.is_published) {
        reasons.push("Linked card is not approved and published.");
      }
      if (cardVersion !== treeVersion) {
        reasons.push(
          `Card version (${card.source_version ?? "unset"}) does not match the tree version (${wf.sourceVersion}).`
        );
      }
    }
    if (Boolean(target) && treeVersion !== target) {
      reasons.push(`Tree version (${wf.sourceVersion}) does not match the uploaded manual (${targetVersion}).`);
    }
    if (pagesIntersect) reasons.push("Tree source pages intersect a changed chapter page range.");
    if (linkedToChanged) reasons.push("Linked source chapter content changed.");
    if (linkedToRemoved) reasons.push("Linked source chapter was removed from the manual.");

    if (reasons.length === 0) continue;

    items.push({
      impactType: "workflow",
      entitySlug: wf.slug,
      entityTitle: wf.title,
      currentVersion: wf.sourceVersion,
      targetVersion,
      status: linkedToRemoved ? "blocked" : willBecomeUnavailable ? "review" : "ok",
      reason: reasons.join(" "),
      requiresManualReview: true,
    });
  }

  // ---- 4. Orphaned source: new chapters with no card yet ----
  for (const d of diffs.filter((x) => x.changeClass === "new")) {
    items.push({
      impactType: "orphaned_source",
      entitySlug: d.slug,
      entityTitle: d.title,
      currentVersion: null,
      targetVersion,
      status: "review",
      reason: "New source topic has no reviewed procedure card.",
      requiresManualReview: true,
    });
  }

  return items;
}

/** Publication readiness: blocked items must be resolved by an owner first. */
export function readiness(items: ImpactItem[]): {
  blocked: number;
  review: number;
  ok: number;
  canComplete: boolean;
} {
  const blocked = items.filter((i) => i.status === "blocked").length;
  const review = items.filter((i) => i.status === "review").length;
  const ok = items.filter((i) => i.status === "ok").length;
  return { blocked, review, ok, canComplete: blocked === 0 };
}
