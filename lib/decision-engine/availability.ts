// Shared guided-decision availability layer (Phase E).
//
// One place that decides whether a "Start guided decision" entry point may be
// shown for a procedure. It is an ADDITIONAL UI gate on top of — never a
// replacement for — the QuestionFlow runtime freshness guard. A workflow is
// only available when a deterministic tree exists AND the card is approved,
// published, version-matched to the tree, and not stale under the existing
// source-review rules.

import { DECISION_DEFINITIONS, sourceVersionMatches } from "./definitions/index.ts";
import { sourceReviewWarnings } from "../admin-procedure-quality.ts";
import type { SourceReviewChapter } from "../admin-procedure-quality.ts";

export type WorkflowAvailabilityStatus =
  | "available"
  | "unavailable_no_tree"
  | "unavailable_unpublished"
  | "unavailable_source_mismatch"
  | "unavailable_source_stale";

// Safe, non-technical message shown to ordinary agents.
export const SAFE_UNAVAILABLE_MESSAGE =
  "Guided decision is temporarily unavailable. Use the operational card.";

export type WorkflowAvailabilityInput = {
  slug: string;
  is_published?: boolean | null;
  review_status?: string | null;
  source_version?: string | null;
  last_reviewed_at?: string | null;
  chapters?: SourceReviewChapter | SourceReviewChapter[] | null;
};

export type WorkflowAvailability = {
  status: WorkflowAvailabilityStatus;
  available: boolean;
  hasTree: boolean;
  /** Target for the guided-decision entry point. */
  href: string;
  /** Safe message for ordinary agents (empty when available or no tree). */
  safeMessage: string;
  /** Detailed reason for reviewers only (null for public-safe cases). */
  adminReason: string | null;
};

export function decisionHref(slug: string): string {
  return `/decision?procedure=${encodeURIComponent(slug)}`;
}

export function hasDecisionTree(slug: string): boolean {
  return Boolean(DECISION_DEFINITIONS[slug]);
}

export function getWorkflowAvailability(
  input: WorkflowAvailabilityInput
): WorkflowAvailability {
  const definition = DECISION_DEFINITIONS[input.slug];
  const href = decisionHref(input.slug);

  // No deterministic tree: no entry point at all (nothing to render).
  if (!definition) {
    return {
      status: "unavailable_no_tree",
      available: false,
      hasTree: false,
      href,
      safeMessage: "",
      adminReason: null,
    };
  }

  const unavailable = (
    status: WorkflowAvailabilityStatus,
    adminReason: string
  ): WorkflowAvailability => ({
    status,
    available: false,
    hasTree: true,
    href,
    safeMessage: SAFE_UNAVAILABLE_MESSAGE,
    adminReason,
  });

  // Must be approved AND published for ordinary agents.
  if (!input.is_published || input.review_status !== "approved") {
    return unavailable("unavailable_unpublished", "Card not published");
  }

  // Card's source version must match the version the tree was verified against.
  if (!sourceVersionMatches(input.source_version ?? null, definition.sourceVersion)) {
    return unavailable("unavailable_source_mismatch", "Source version requires review");
  }

  // Existing source-review freshness rules (linked chapter version + updates).
  const warnings = sourceReviewWarnings(input);
  if (warnings.includes("Version mismatch")) {
    return unavailable("unavailable_source_mismatch", "Source version requires review");
  }
  if (warnings.includes("Source updated")) {
    return unavailable("unavailable_source_stale", "Source updated after review");
  }

  return {
    status: "available",
    available: true,
    hasTree: true,
    href,
    safeMessage: "",
    adminReason: null,
  };
}
