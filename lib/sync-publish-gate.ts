// Explicit .ts extension matches the repo convention (lib/sync-diff.ts,
// lib/sync-impact.ts) and is required by Node's type-stripping, which the
// scripts/check-*.mjs harness and the worker both rely on.
import { MASS_RECLASSIFICATION_THRESHOLD } from "./sync-diff.ts";

// ============================================================================
// PUB-1: the single source of truth for "may this sync run be published?".
//
// Previously the mass-reclassification guard existed only as UI text. The admin
// page computed `reclassBlocked` locally (with its own hardcoded 0.2 literal)
// and used it to grey out a button, while POST /api/sync/[id]/publish applied
// no check at all. Any admin could publish a run the guard had flagged simply
// by calling the endpoint directly, even though the review screen stated
// "Publishing is disabled until an owner records an audited override."
//
// This module is deliberately pure and dependency-free so that the server route
// and the server component evaluate byte-identical logic, and so the rules are
// testable without a database.
//
// It never publishes, approves or mutates anything — it only answers yes/no.
// ============================================================================

/**
 * States from which publishing is meaningful. A run that is still extracting
 * has no staged rows to publish; a failed or cancelled run must be retried
 * rather than published. `null` is tolerated because rows created before the
 * UPD-2 migration predate the `state` column and fall back to `status`.
 */
export const PUBLISHABLE_STATES = ["staged", "publishing"] as const;

/** Terminal success — publishing again would double-apply the same batch. */
export const PUBLISHED_STATES = ["published"] as const;

export type PublishGateRun = {
  state?: string | null;
  status?: string | null;
  new_ratio?: number | string | null;
  removed_ratio?: number | string | null;
  reclass_override_reason?: string | null;
  published_at?: string | null;
};

export type PublishGateResult = {
  /** True only when every precondition passes. */
  ok: boolean;
  /** Stable machine code; null when ok. */
  errorCode:
    | "ALREADY_PUBLISHED"
    | "RUN_NOT_PUBLISHABLE"
    | "MASS_RECLASSIFICATION_BLOCKED"
    | null;
  /** Operator-safe message; never contains data or internals. */
  message: string | null;
  /** Effective lifecycle state after the legacy-column fallback. */
  effectiveState: string;
  newRatio: number;
  removedRatio: number;
  /** An owner recorded an audited override for the reclassification guard. */
  overridden: boolean;
  /** The guard tripped (independent of whether an override neutralised it). */
  reclassTripped: boolean;
  /** The guard tripped AND no override exists -> publishing must be refused. */
  reclassBlocked: boolean;
  limit: number;
};

/** A ratio may arrive as a JS number or a PostgreSQL numeric string. */
function toRatio(value: number | string | null | undefined): number {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

/**
 * `state` is authoritative. `status` is the legacy pre-UPD-2 column and is only
 * consulted when `state` is absent, matching the admin list's display rule
 * (`run.state ?? run.status ?? "uploaded"`) so the UI and the API can never
 * disagree about which run they are talking about.
 */
export function effectiveRunState(run: PublishGateRun): string {
  const state = (run.state ?? "").trim();
  if (state) return state;
  const status = (run.status ?? "").trim();
  return status || "uploaded";
}

export function evaluatePublishGate(run: PublishGateRun): PublishGateResult {
  const effectiveState = effectiveRunState(run);
  const newRatio = toRatio(run.new_ratio);
  const removedRatio = toRatio(run.removed_ratio);
  const overridden = Boolean((run.reclass_override_reason ?? "").trim());
  const reclassTripped =
    newRatio > MASS_RECLASSIFICATION_THRESHOLD ||
    removedRatio > MASS_RECLASSIFICATION_THRESHOLD;
  const reclassBlocked = reclassTripped && !overridden;

  const base = {
    effectiveState,
    newRatio,
    removedRatio,
    overridden,
    reclassTripped,
    reclassBlocked,
    limit: MASS_RECLASSIFICATION_THRESHOLD,
  };

  // 1. Idempotency first: a published run is terminal. Checked before the
  //    reclassification guard so an already-applied batch reports the accurate
  //    reason instead of a misleading "blocked".
  if (
    (PUBLISHED_STATES as readonly string[]).includes(effectiveState) ||
    Boolean(run.published_at)
  ) {
    return {
      ...base,
      ok: false,
      errorCode: "ALREADY_PUBLISHED",
      message: "This sync run has already been published.",
    };
  }

  // 2. Lifecycle precondition — never publish a run that has not finished
  //    staging, and never publish one that failed or was cancelled.
  if (!(PUBLISHABLE_STATES as readonly string[]).includes(effectiveState)) {
    return {
      ...base,
      ok: false,
      errorCode: "RUN_NOT_PUBLISHABLE",
      message:
        "This sync run is not ready to publish. Only a staged run can be published.",
    };
  }

  // 3. Mass-reclassification guard — enforced, not merely displayed.
  if (reclassBlocked) {
    return {
      ...base,
      ok: false,
      errorCode: "MASS_RECLASSIFICATION_BLOCKED",
      message:
        "Chapter identity matching produced an unusually large number of new or " +
        "removed chapters. An owner must record an audited override before this " +
        "run can be published.",
    };
  }

  return { ...base, ok: true, errorCode: null, message: null };
}
