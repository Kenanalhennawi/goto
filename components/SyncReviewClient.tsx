"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { TextDiff } from "@/components/TextDiff";
import Link from "next/link";

interface StagedChange {
  id: string;
  chapter_number: number;
  title: string;
  is_new_chapter: boolean;
  old_body_text: string | null;
  new_body_text: string;
  old_keywords: string[] | null;
  new_keywords: string[] | null;
  approved: boolean;
  // UPD-2.1 classification (null on runs staged before this phase).
  change_class?: string | null;
  identity_match_method?: string | null;
  old_page_start?: number | null;
  old_page_end?: number | null;
  new_page_start?: number | null;
  new_page_end?: number | null;
  old_source_version?: string | null;
  new_source_version?: string | null;
  change_reasons?: string | null;
}

interface SyncRun {
  id: string;
  source_filename: string | null;
  source_version: string | null;
  status: string | null;
  chapters_changed: number | null;
  chapters_added: number | null;
}

export function SyncReviewClient({
  syncRun,
  changes,
  canPublish,
}: {
  syncRun: SyncRun;
  changes: StagedChange[];
  canPublish: boolean;
}) {
  const [approved, setApproved] = useState<Set<string>>(
    new Set(changes.filter((c) => c.approved).map((c) => c.id))
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  function toggleApproved(id: string) {
    setApproved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Bulk selection helpers — pure React state updates, no network or reload.
  function selectAll() {
    setApproved(new Set(changes.map((c) => c.id)));
  }

  function clearSelection() {
    setApproved(new Set());
  }

  // UPD-2.1: bulk approval is limited to the safe classes. content_changed,
  // new, removed and renamed_moved must be reviewed one by one.
  function selectByClass(target: string) {
    setApproved(new Set(changes.filter((c) => c.change_class === target).map((c) => c.id)));
  }

  const unchangedCount = changes.filter((c) => c.change_class === "unchanged").length;
  const metadataOnlyCount = changes.filter((c) => c.change_class === "metadata_only").length;
  const removedCount = changes.filter((c) => c.change_class === "removed").length;
  const classified = changes.some((c) => Boolean(c.change_class));

  async function handlePublish() {
    if (approved.size === 0) {
      setMessage("Approve at least one chapter before publishing.");
      return;
    }

    setPublishing(true);
    setMessage(null);

    // Mark approval state in the DB first.
    const { error: approvalError } = await supabase
      .from("sync_staged_changes")
      .update({ approved: true })
      .in("id", Array.from(approved));

    if (approvalError) {
      setPublishing(false);
      setMessage("Couldn't save approvals. Publish was not started.");
      return;
    }

    try {
      const res = await fetch(`/api/sync/${syncRun.id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      setPublishing(false);

      if (!res.ok) {
        setMessage(data.error ?? "Publish failed. Try again.");
        return;
      }

      setMessage(`Published ${data.published} chapters. The live site is updated.`);
      router.refresh();
    } catch {
      setPublishing(false);
      setMessage("Publish request failed. Check your connection and try again.");
    }
  }

  const alreadyPublished = syncRun.status === "published";

  return (
    <div>
      <Link href="/admin" className="text-xs text-ink-muted hover:text-accent transition-colors inline-flex items-center gap-1 mb-6">
        Back to dashboard
      </Link>

      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-xl font-semibold text-ink">
          Review sync - {syncRun.source_filename}
        </h1>
        {alreadyPublished && (
          <span className="text-xs px-2 py-1 rounded bg-good/10 text-good border border-good/20">
            Published
          </span>
        )}
      </div>
      <p className="text-sm text-ink-muted mb-8 font-mono">
        Source version {syncRun.source_version} - {syncRun.chapters_changed} changed -{" "}
        {syncRun.chapters_added} new
      </p>

      {!alreadyPublished && canPublish && (
        <div className="flex items-center justify-between mb-6 bg-panel border border-border rounded-lg px-4 py-3">
          <p className="text-sm text-ink-muted" aria-live="polite">
            {approved.size} of {changes.length} chapters approved
          </p>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing || approved.size === 0}
            aria-label={`Publish ${approved.size} selected chapter${approved.size === 1 ? "" : "s"}`}
            className="bg-accent text-base font-medium rounded-lg px-4 py-2 text-sm hover:bg-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          >
            {publishing ? "Publishing..." : `Publish ${approved.size} chapter${approved.size === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

      {!alreadyPublished && canPublish && (
        <div
          role="group"
          aria-label="Bulk chapter selection"
          className="mb-6 flex flex-wrap items-center gap-2"
        >
          <ToolbarButton
            onClick={selectAll}
            ariaLabel={`Select all ${changes.length} chapters`}
          >
            <span aria-hidden="true">✓</span> Select all
          </ToolbarButton>
          <ToolbarButton
            onClick={clearSelection}
            ariaLabel="Clear selection"
          >
            <span aria-hidden="true">✕</span> Clear selection
          </ToolbarButton>
          {/* UPD-2.1: bulk approval is offered ONLY for the safe classes.
              content_changed / new / removed / renamed_moved are never bulk
              approved — each must be reviewed individually. */}
          {classified && (
            <>
              <ToolbarButton
                onClick={() => selectByClass("unchanged")}
                ariaLabel={`Approve unchanged chapters only (${unchangedCount})`}
              >
                <span aria-hidden="true">✓</span> Approve unchanged ({unchangedCount})
              </ToolbarButton>
              <ToolbarButton
                onClick={() => selectByClass("metadata_only")}
                ariaLabel={`Approve metadata-only chapters (${metadataOnlyCount})`}
              >
                <span aria-hidden="true">✓</span> Approve metadata-only ({metadataOnlyCount})
              </ToolbarButton>
            </>
          )}
        </div>
      )}

      {removedCount > 0 && (
        <p className="mb-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {removedCount} chapter(s) are absent from the uploaded manual. They are never deleted
          automatically and require explicit owner confirmation.
        </p>
      )}

      {!alreadyPublished && !canPublish && (
        <div className="mb-6 rounded-lg border border-border bg-panel px-4 py-3 text-sm text-ink-muted">
          You can review this sync, but only admins can publish live content.
        </div>
      )}

      {message && (
        <div className="mb-6 bg-good/10 border border-good/20 text-good rounded-lg px-4 py-2.5 text-sm">
          {message}
        </div>
      )}

      <div className="space-y-3">
        {changes.map((change) => {
          const isExpanded = expanded.has(change.id);
          const isApproved = approved.has(change.id);

          return (
            <div key={change.id} className="bg-panel border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleExpanded(change.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-panel-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-ink-faint tabular-nums">
                    {String(change.chapter_number).padStart(2, "0")}
                  </span>
                  <span className="font-display text-sm text-ink">{change.title}</span>
                  {change.is_new_chapter && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-good/10 text-good border border-good/20">
                      new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {!alreadyPublished && canPublish && (
                    <label className="flex items-center gap-2 text-xs text-ink-muted">
                      <input
                        type="checkbox"
                        checked={isApproved}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleApproved(change.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="accent-accent"
                      />
                      Approve
                    </label>
                  )}
                  <span className="text-ink-faint text-xs">{isExpanded ? "Hide" : "View diff"}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4">
                  <TextDiff oldText={change.old_body_text} newText={change.new_body_text} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ToolbarButton({
  onClick,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
    >
      {children}
    </button>
  );
}

