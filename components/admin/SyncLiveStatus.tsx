"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Live progress + worker health.
//
// Two problems this removes:
//   1. An upload sat at "Queued" with no explanation whenever the worker was
//      not running. The only diagnosis was reading a log file on a laptop.
//   2. Progress required manually refreshing the page, so the administrator
//      could not tell a working run from a dead one.
//
// This polls while a run is active and stops once it reaches a terminal state,
// so an idle review page makes no requests.

// Mirrors GET /api/sync/health.
//
// `workerOnline` was removed on purpose. Processing runs as finite GitHub
// Actions jobs, so there is no permanent process to be "online"; that field
// would have read false during entirely normal idle periods and made a real
// outage indistinguishable from a quiet afternoon. What matters instead is
// whether processing CAN be started (dispatcherConfigured), whether it last
// worked (lastDispatchSuccessAt), and whether anything is stuck
// (stuckQueuedCount).
type Health = {
  dispatcherConfigured?: boolean;
  recoveryScheduleConfigured?: boolean;
  processingSystemReady?: boolean;
  degraded?: boolean;
  reason?: string;
  message?: string;
  queueDepth?: number;
  oldestQueuedAt?: string | null;
  stuckQueuedCount?: number;
  lastDispatchAttemptAt?: string | null;
  lastDispatchSuccessAt?: string | null;
  lastDispatchErrorCode?: string | null;
  lastProcessingActivityAt?: string | null;
  lastSuccessfulRunAt?: string | null;
  activeRun?: { id?: string; state?: string; progressPct?: number; message?: string } | null;
};

// Plain-language stage labels. Internal state names never reach the screen.
const STAGE_LABEL: Record<string, string> = {
  uploaded: "Uploading",
  queued: "Waiting to start",
  validating: "Checking the PDF",
  extracting: "Reading chapters",
  staged: "Ready for review",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
  cancelled: "Cancelled",
};

const ACTIVE = new Set(["uploaded", "queued", "validating", "extracting", "publishing"]);
const TERMINAL = new Set(["published", "cancelled"]);

export function SyncLiveStatus({
  runId,
  state,
  progressPct,
  progressMessage,
  canManage,
}: {
  runId: string;
  state: string;
  progressPct: number | null;
  progressMessage: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const active = ACTIVE.has(state);

  // Poll health whenever the run is active; refresh the server component so
  // progress advances without the administrator touching anything.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/sync/health", { cache: "no-store" });
        if (!cancelled && res.ok) setHealth(await res.json());
      } catch {
        /* health is advisory; a failed poll must not break the page */
      }
      if (!cancelled && active) router.refresh();
    };
    tick();
    if (!active) return;
    const timer = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active, router, runId]);

  const act = useCallback(
    async (action: string, confirmText?: string) => {
      if (confirmText && !window.confirm(confirmText)) return;
      setBusy(action);
      setActionError(null);
      try {
        const res = await fetch(`/api/sync/${runId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) setActionError(json.error ?? "That action could not be completed.");
        else router.refresh();
      } catch {
        setActionError("That action could not be completed.");
      } finally {
        setBusy(null);
      }
    },
    [runId, router]
  );

  const pct = Math.max(0, Math.min(100, Number(progressPct ?? 0)));
  // "Stuck" now means the queue has genuinely waited past the dispatch grace
  // period, or this deployment cannot dispatch at all — not merely that no
  // process happens to be running, which is the normal resting state.
  const stuckInQueue =
    state === "queued" &&
    Boolean(health) &&
    ((health?.stuckQueuedCount ?? 0) > 0 || health?.dispatcherConfigured === false);

  return (
    <section className="content-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">
            {STAGE_LABEL[state] ?? state}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{progressMessage ?? ""}</p>
        </div>
        {active ? (
          <span className="text-xs font-semibold text-ink-faint">Updating automatically…</span>
        ) : null}
      </div>

      {!TERMINAL.has(state) ? (
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Update progress"
          className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100"
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              state === "failed" ? "bg-red-500" : "bg-accent"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}

      {/* The warning that used to require reading a log file. */}
      {stuckInQueue ? (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-soft px-3 py-2 text-sm text-warn">
          <strong>Nothing is processing this upload.</strong>{" "}
          {health?.message ?? "The background worker is offline."} Your PDF is saved and will start
          automatically as soon as the worker is running again.
        </p>
      ) : null}

      {health?.reason === "MIGRATION_PENDING" ? (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-soft px-3 py-2 text-sm text-warn">
          The database is still being updated. This resolves itself once the worker service starts.
        </p>
      ) : null}

      {/* Recovery actions — each replaces a manual database repair. */}
      {canManage ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {(state === "failed" || state === "queued" || state === "staged") ? (
            <button
              type="button"
              onClick={() => act("reprocess", "Read the same PDF again from the start?")}
              disabled={busy !== null}
              className="agent-secondary touch-target rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {busy === "reprocess" ? "Restarting…" : "Process again"}
            </button>
          ) : null}
          {ACTIVE.has(state) ? (
            <button
              type="button"
              onClick={() => act("cancel", "Stop this update? Nothing published so far is affected.")}
              disabled={busy !== null}
              className="agent-secondary touch-target rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {busy === "cancel" ? "Stopping…" : "Stop"}
            </button>
          ) : null}
          {state === "staged" ? (
            <button
              type="button"
              onClick={() =>
                act("discard", "Discard this review? Live content is not affected.")
              }
              disabled={busy !== null}
              className="agent-secondary touch-target rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {busy === "discard" ? "Discarding…" : "Discard review"}
            </button>
          ) : null}
          {state === "publishing" ? (
            <button
              type="button"
              onClick={() => act("restore", "Return this update to review?")}
              disabled={busy !== null}
              className="agent-secondary touch-target rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {busy === "restore" ? "Restoring…" : "Return to review"}
            </button>
          ) : null}
        </div>
      ) : null}

      {actionError ? (
        <p className="mt-3 text-sm font-semibold text-warn">{actionError}</p>
      ) : null}

      {/* Footer status. Never claims a process is running: processing is a
          GitHub Actions job, so "ready" means a job CAN be started, and an
          empty queue with no activity is the normal resting state. */}
      <p className="mt-4 text-[11px] text-ink-faint">
        {!health
          ? "Checking the processing system…"
          : health.dispatcherConfigured === false
            ? "Automatic processing not configured · scheduled check will run"
            : (health.stuckQueuedCount ?? 0) > 0
              ? `${health.stuckQueuedCount} waiting longer than expected · scheduled recovery available`
              : health.activeRun
                ? "Processing in progress"
                : (health.queueDepth ?? 0) > 0
                  ? `Processing requested · ${health.queueDepth} waiting to start`
                  : "Processing system ready"}
      </p>
    </section>
  );
}
