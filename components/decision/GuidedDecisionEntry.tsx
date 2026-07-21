import Link from "next/link";
import type { WorkflowAvailability } from "@/lib/decision-engine/availability";

// Presentational guided-decision entry point (server-safe, no client JS).
// Renders a prominent link when available, a disabled state otherwise, and
// nothing at all when the procedure has no deterministic tree. Reviewers
// (canManage) see a short reason; ordinary agents see only the safe message.
export function GuidedDecisionEntry({
  availability,
  canManage = false,
  variant = "panel",
}: {
  availability: WorkflowAvailability;
  canManage?: boolean;
  variant?: "panel" | "inline";
}) {
  // No tree for this procedure: render no entry point.
  if (!availability.hasTree) return null;

  if (variant === "inline") {
    if (availability.available) {
      return (
        <Link
          href={availability.href}
          className="press inline-flex items-center gap-1.5 rounded border border-sky bg-sky-soft px-3.5 py-1.5 text-xs font-semibold text-sky transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-1"
        >
          Guided decision
        </Link>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded border border-dashed border-border px-3 py-1.5 text-[11px] font-semibold text-ink-faint"
        title={canManage && availability.adminReason ? availability.adminReason : undefined}
      >
        Guided workflow under review
      </span>
    );
  }

  if (availability.available) {
    return (
      <section className="content-card border-l-4 border-l-sky p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky">
              Guided decision
            </p>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              Answer a few verified questions to reach the applicable operational outcome.
            </p>
          </div>
          <Link
            href={availability.href}
            className="press inline-flex shrink-0 items-center justify-center rounded-md bg-sky px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2"
          >
            Start guided decision
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-warn">
            Guided decision
          </p>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {availability.safeMessage}
          </p>
          {canManage && availability.adminReason && (
            <p className="mt-1 text-xs font-semibold text-warn">
              Reviewer note: {availability.adminReason}
            </p>
          )}
        </div>
        <span
          aria-disabled="true"
          className="inline-flex shrink-0 cursor-not-allowed items-center justify-center rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-ink-faint opacity-70"
        >
          Guided decision unavailable
        </span>
      </div>
    </section>
  );
}
