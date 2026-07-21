import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { canManageUsers } from "@/lib/permissions";
import { buildPublishPlan, type ExistingChapterContent } from "@/lib/sync-identity";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!canManageUsers(role?.role)) {
    return NextResponse.json(
      { error: "Only admins can publish live content." },
      { status: 403 }
    );
  }

  const { data: syncRun } = await supabase
    .from("sync_runs")
    .select("source_version")
    .eq("id", id)
    .single();

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

  // Everything already matches the target — mark the run published, write nothing.
  if (plan.operations.length === 0) {
    await markRunPublished(supabase, id);
    return NextResponse.json({
      success: true,
      published: 0,
      alreadyApplied: plan.alreadyApplied,
      failed: [],
    });
  }

  // Apply all writes atomically (temp renumber -> final) inside one transaction.
  const { data: rpcResult, error: rpcError } = await supabase.rpc("publish_sync_chapters", {
    p_operations: plan.operations,
    p_editor: user.id,
    p_editor_email: user.email ?? null,
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
    const functionMissing =
      rpcError.code === "PGRST202" ||
      /publish_sync_chapters/.test(rpcError.message ?? "") ||
      /Could not find the function/i.test(rpcError.message ?? "");
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
        // Batch-level failure — no single chapter number/slug is to blame.
        failed: [{ chapterNumber: null, slug: null, safeMessage }],
      },
      { status: 500 }
    );
  }

  const published =
    (rpcResult && typeof rpcResult.published === "number"
      ? rpcResult.published
      : plan.operations.length) ?? plan.operations.length;

  const { error: runUpdateError } = await markRunPublished(supabase, id);

  if (runUpdateError) {
    return NextResponse.json(
      {
        error: "Changes were published, but the sync run status could not be updated.",
        published,
        alreadyApplied: plan.alreadyApplied,
        failed: [],
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    published,
    alreadyApplied: plan.alreadyApplied,
    failed: [],
  });
}

async function markRunPublished(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  id: string
) {
  return supabase
    .from("sync_runs")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id);
}
