import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { buildPublishPlan, type ExistingChapterContent } from "@/lib/sync-identity";
import { evaluatePublishGate } from "@/lib/sync-publish-gate";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // SEC-1 guard: admin/owner only may publish live content (unchanged rule).
  const session = await requireAdmin();
  if (!session.ok) return session.response;
  const { supabase, user } = session;

  // PUB-1: load the full lifecycle context, not just source_version. The
  // publish preconditions (already-published, publishable state, mass
  // reclassification) MUST be enforced here — the review screen only greys out
  // a button, which a direct POST bypasses entirely.
  const { data: syncRun, error: runLoadError } = await supabase
    .from("sync_runs")
    .select(
      "source_version, state, status, new_ratio, removed_ratio, reclass_override_reason, published_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (runLoadError) {
    return NextResponse.json(
      { error: "Couldn't load the sync run.", errorCode: "RUN_LOAD_FAILED" },
      { status: 500 }
    );
  }
  if (!syncRun) {
    return NextResponse.json(
      { error: "Sync run not found.", errorCode: "RUN_NOT_FOUND" },
      { status: 404 }
    );
  }

  const gate = evaluatePublishGate(syncRun);
  if (!gate.ok) {
    // 409 Conflict: the request is well-formed and authorised, but the run's
    // current state forbids it. Publishing nothing is the safe outcome.
    return NextResponse.json(
      {
        error: gate.message,
        errorCode: gate.errorCode,
        published: 0,
        alreadyApplied: 0,
        failed: [],
      },
      { status: 409, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const { data: approvedChanges, error: fetchError } = await supabase
    .from("sync_staged_changes")
    .select("chapter_number, title, is_new_chapter, new_body_text, new_content_blocks, new_keywords")
    .eq("sync_run_id", id)
    .eq("approved", true);

  if (fetchError) {
    return NextResponse.json({ error: "Couldn't load approved changes." }, { status: 500 });
  }

  if (!approvedChanges || approvedChanges.length === 0) {
    return NextResponse.json({ error: "No approved changes to publish." }, { status: 400 });
  }

  // Load existing chapters (with content) so identity can be resolved by stable
  // attributes (slug / title / id) and already-applied rows can be detected.
  const { data: existingChapters, error: existingListError } = await supabase
    .from("chapters")
    .select("id, slug, title, chapter_number, body_text, source_version");

  if (existingListError) {
    return NextResponse.json({ error: "Couldn't load existing chapters." }, { status: 500 });
  }

  const existingRefs: ExistingChapterContent[] = existingChapters ?? [];
  const sourceVersion = syncRun?.source_version ?? null;

  // Build the two-phase plan. This validates the whole batch (unique slugs,
  // unique final numbers, positive numbers) before any write is attempted.
  const plan = buildPublishPlan(approvedChanges, existingRefs, sourceVersion);

  if (!plan.ok) {
    return NextResponse.json(
      {
        error: "Publish aborted: the approved changes are inconsistent.",
        errorCode: "SYNC_VALIDATION_FAILED",
        published: 0,
        alreadyApplied: 0,
        failed: plan.failed,
      },
      { status: 400 }
    );
  }

  // PUB-1.2: a zero-operation plan is NOT special-cased here any more. It goes
  // through publish_sync_run like every other publish, so "nothing to do" and
  // "something to do" share one code path, one lock and one transaction. The
  // old shortcut wrote the run row directly and could leave it 'staged' while
  // reporting success.

  // Apply all writes atomically (temp renumber -> final) inside one transaction.
  // temporaryMoveIds is the complete, explicit set of rows to move out of the
  // final range first — derived from the whole plan, not just update ops.
  // PUB-1.2: ONE transaction for the whole publish. publish_sync_run locks the
  // run, re-checks every precondition under that lock (state, published_at,
  // ratios, a complete and audited owner override), applies the chapter batch
  // and marks the run published. Previously these were four separate
  // transactions, so a crash between them left chapters live with the run still
  // 'staged' — and the natural retry re-applied them.
  //
  // The gate above and this call are deliberately NOT the same check. The gate
  // is a fast advisory signal for the UI; the database re-derives the decision
  // while holding the row lock, because only the lock makes it race-free.
  const { data: rpcResult, error: rpcError } = await supabase.rpc("publish_sync_run", {
    p_run_id: id,
    p_operations: plan.operations,
    p_temporary_move_ids: plan.temporaryMoveIds,
    // No p_editor. publish_sync_chapters writes the supplied UUID into
    // chapters.updated_by and the edit history, and it is granted to
    // `authenticated` — so a client-supplied editor could forge attribution.
    // publish_sync_run derives the editor from auth.uid() server-side.
    p_source_version: sourceVersion,
  });

  if (rpcError) {
    // Log the COMPLETE database error server-side (Vercel logs) so the exact
    // PostgreSQL cause is recoverable, while the browser only gets a safe code.
    console.error("Atomic chapter publish failed", {
      syncRunId: id,
      code: rpcError.code,
      message: rpcError.message,
      details: rpcError.details,
      hint: rpcError.hint,
      operationCount: plan.operations.length,
      operationSummary: plan.operations.map((op) => ({
        id: op.chapterId,
        slug: op.slug,
        chapterNumber: op.finalNumber,
        operation: op.op,
      })),
    });

    // Distinguish "function not deployed" from a genuine transaction rollback so
    // the operator knows whether to apply the migration or investigate data.
    const raw = `${rpcError.message ?? ""} ${rpcError.details ?? ""}`;
    const functionMissing =
      rpcError.code === "PGRST202" ||
      /publish_sync_run|publish_sync_chapters/.test(rpcError.message ?? "") ||
      /Could not find the function/i.test(rpcError.message ?? "");

    // A refusal is not a failure: the database declined for a stated reason and
    // nothing was written. Surface it as 409 with the reason intact.
    const refusal = /PUBLISH_REFUSED:\s*([A-Z_]+)/.exec(raw)?.[1];
    if (refusal && !functionMissing) {
      return NextResponse.json(
        {
          error:
            refusal === "ALREADY_PUBLISHED"
              ? "This sync run has already been published."
              : refusal === "MASS_RECLASSIFICATION_BLOCKED"
                ? "Chapter identity matching produced an unusually large number of new or removed chapters. An owner must record an audited override first."
                : refusal === "OVERRIDE_ACTOR_NOT_OWNER" || refusal === "OVERRIDE_UNAUDITED" || refusal === "OVERRIDE_INCOMPLETE"
                  ? "The recorded override is not valid. It must be recorded by a current owner through the override action."
                  : refusal === "NO_APPROVED_CHANGES"
                    ? "No approved changes to publish."
                    : "This run is not in a publishable state.",
          errorCode: refusal,
          published: 0,
          alreadyApplied: plan.alreadyApplied,
          failed: [],
        },
        { status: 409, headers: { "Cache-Control": "private, no-store" } }
      );
    }
    if (/ADMIN_REQUIRED/.test(raw)) {
      return NextResponse.json(
        { error: "Only an admin or owner may publish.", errorCode: "ADMIN_REQUIRED", published: 0 },
        { status: 403 }
      );
    }
    const errorCode = functionMissing
      ? "ATOMIC_CHAPTER_RPC_MISSING"
      : "ATOMIC_CHAPTER_WRITE_FAILED";
    const safeMessage = functionMissing
      ? "The atomic publish function is not deployed. Apply the latest migration, then retry."
      : "The chapter batch was rolled back. See server logs for the exact cause.";

    return NextResponse.json(
      {
        error: "Publish failed while writing chapters. No changes were applied.",
        errorCode,
        published: 0,
        alreadyApplied: plan.alreadyApplied,
        // Batch-level failure — no single chapter is to blame; no fake chapter 0.
        failed: [],
        batchFailure: { safeMessage },
      },
      { status: 500 }
    );
  }

  const published =
    (rpcResult && typeof rpcResult.published === "number"
      ? rpcResult.published
      : plan.operations.length) ?? plan.operations.length;

  // PUB-1.2: there is deliberately no follow-up write here. Marking the run
  // published happened inside publish_sync_run's transaction, alongside the
  // chapter writes. The old "Changes were published, but the sync run status
  // could not be updated" 500 described a state that can no longer exist —
  // either both committed or neither did.
  return NextResponse.json({
    success: true,
    published,
    alreadyApplied: plan.alreadyApplied,
    renumbered: plan.renumbered,
    inserted: plan.inserted,
    failed: [],
  });
}

