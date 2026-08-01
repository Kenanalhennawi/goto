"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// UPD-2.1: validation summary, diff classification counts, removed-chapter
// warnings, impact report and retry for a staged/failed run. Display only —
// it never approves, publishes or mutates operational content.

type Run = {
  id: string;
  original_filename: string | null;
  source_filename: string | null;
  state: string | null;
  status: string | null;
  progress_pct: number | null;
  progress_message: string | null;
  pdf_version: string | null;
  pdf_version_date: string | null;
  pdf_page_count: number | null;
  pdf_sha256: string | null;
  extractor_version: string | null;
  error_code: string | null;
  error_detail: string | null;
  retry_of_run_id: string | null;
  created_at?: string;
};

type ImpactRow = {
  impact_type: string;
  entity_slug: string;
  entity_title: string | null;
  current_version: string | null;
  target_version: string | null;
  status: string;
  reason: string | null;
};

const CLASS_LABEL: Record<string, string> = {
  unchanged: "Unchanged",
  metadata_only: "Metadata only",
  content_changed: "Content changed",
  new: "New",
  removed: "Removed",
  renamed_moved: "Renamed / moved",
  unclassified: "Unclassified",
};

const IMPACT_LABEL: Record<string, string> = {
  chapter: "Chapter",
  procedure_card: "Procedure card",
  workflow: "Workflow",
  search_term: "Search term",
  orphaned_source: "New source topic",
};

export function SyncRunSummary({
  run,
  counts,
  impact,
  canRetry,
}: {
  run: Run;
  counts: Record<string, number>;
  impact: ImpactRow[];
  canRetry: boolean;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const state = run.state ?? run.status ?? "uploaded";
  const failed = state === "failed";
  const blocked = impact.filter((i) => i.status === "blocked");
  const review = impact.filter((i) => i.status === "review");
  const removedCount = counts.removed ?? 0;

  async function retry() {
    setRetrying(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/sync/${run.id}/retry`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error ?? "Could not start the retry.");
        setRetrying(false);
        return;
      }
      router.push(`/admin/sync/${json.runId}`);
      router.refresh();
    } catch {
      setMessage("Retry request failed.");
      setRetrying(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ---- Validation summary ---- */}
      <section className="content-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold text-ink">
              {run.original_filename ?? run.source_filename ?? "Manual upload"}
            </h1>
            <p className="mt-1 text-xs text-ink-muted">
              {run.pdf_version ? `Version ${run.pdf_version}` : "Version pending"}
              {run.pdf_version_date ? ` · ${run.pdf_version_date}` : ""}
              {run.pdf_page_count ? ` · ${run.pdf_page_count} pages` : ""}
              {run.extractor_version ? ` · extractor ${run.extractor_version}` : ""}
            </p>
            {run.pdf_sha256 ? (
              <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                sha256 {run.pdf_sha256.slice(0, 12)}…{run.pdf_sha256.slice(-6)}
              </p>
            ) : null}
            {run.retry_of_run_id ? (
              <p className="mt-0.5 text-[11px] text-ink-faint">
                Retry of an earlier run (the original is preserved).
              </p>
            ) : null}
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
              failed
                ? "border-red-200 bg-red-50 text-red-700"
                : state === "staged"
                  ? "border-blue-200 bg-sky-soft text-sky"
                  : "border-border bg-slate-50 text-ink-muted"
            }`}
          >
            {state}
          </span>
        </div>

        {failed ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Extraction failed{run.error_code ? ` (${run.error_code})` : ""}.{" "}
            {run.error_detail ?? "Check the uploaded file and try again."}
          </p>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">{run.progress_message ?? ""}</p>
        )}

        {canRetry && failed ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={retry}
              disabled={retrying}
              className="agent-secondary touch-target inline-flex items-center rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              {retrying ? "Starting retry…" : "Retry this run"}
            </button>
            {message ? <p className="mt-2 text-sm font-semibold text-warn">{message}</p> : null}
          </div>
        ) : null}
      </section>

      {/* ---- Classification counts ---- */}
      <section className="content-card p-5">
        <h2 className="font-display text-base font-semibold text-ink">Chapter changes</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {["unchanged", "metadata_only", "content_changed", "new", "removed", "renamed_moved", "unclassified"]
            .filter((key) => (counts[key] ?? 0) > 0)
            .map((key) => (
              <li
                key={key}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                  key === "removed"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : key === "content_changed" || key === "new" || key === "renamed_moved"
                      ? "border-amber-200 bg-amber-soft text-warn"
                      : "border-border bg-slate-50 text-ink-muted"
                }`}
              >
                {CLASS_LABEL[key] ?? key}: {counts[key]}
              </li>
            ))}
          {Object.keys(counts).length === 0 ? (
            <li className="text-sm text-ink-muted">No staged changes yet.</li>
          ) : null}
        </ul>

        {removedCount > 0 ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {removedCount} chapter(s) are absent from the uploaded manual. They are retained, never
            deleted automatically, and require explicit owner confirmation before this run is
            considered complete.
          </p>
        ) : null}
      </section>

      {/* ---- Impact report ---- */}
      <section className="content-card p-5">
        <h2 className="font-display text-base font-semibold text-ink">
          Affected cards and workflows
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Reported only. Procedure cards are never approved or published automatically, and decision
          workflows are never edited.
        </p>

        {impact.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            No impact report yet. It is generated when extraction completes.
          </p>
        ) : (
          <>
            <p className="mt-3 text-xs font-semibold text-ink-muted">
              {blocked.length} blocker(s) · {review.length} item(s) needing review
            </p>
            <ul className="mt-3 space-y-2">
              {[...blocked, ...review].slice(0, 40).map((item, index) => (
                <li
                  key={`${item.impact_type}-${item.entity_slug}-${index}`}
                  className={`rounded-lg border px-3 py-2 ${
                    item.status === "blocked"
                      ? "border-red-200 bg-red-50"
                      : "border-border bg-white"
                  }`}
                >
                  <p className="text-sm font-semibold text-ink">
                    <span className="text-[11px] uppercase tracking-wider text-ink-faint">
                      {IMPACT_LABEL[item.impact_type] ?? item.impact_type}
                    </span>{" "}
                    {item.entity_title ?? item.entity_slug}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-ink-muted">{item.reason}</p>
                  {item.current_version || item.target_version ? (
                    <p className="mt-0.5 text-[11px] text-ink-faint">
                      {item.current_version ?? "unset"} → {item.target_version ?? "unset"}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            {blocked.length > 0 ? (
              <p className="mt-3 text-sm font-semibold text-warn">
                Resolve the blockers before treating this manual update as complete.
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
