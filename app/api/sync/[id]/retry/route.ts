import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { EXTRACTOR_VERSION } from "@/lib/sync-upload";

// UPD-2.1: retry a failed run. A retry NEVER overwrites the failed run — it
// creates a new queued run linked by retry_of_run_id and re-uses the already
// archived PDF, so the audit trail is preserved and no re-upload is needed.
// The browser cannot pass any worker command or argument.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAdmin();
  if (!session.ok) return session.response;
  const { supabase, user } = session;

  const { data: original, error } = await supabase
    .from("sync_runs")
    .select("id, state, pdf_path, pdf_sha256, original_filename, source_filename, override_reason")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not load the sync run.", errorCode: "RUN_LOAD_FAILED" }, { status: 500 });
  }
  if (!original) {
    return NextResponse.json({ error: "Sync run not found.", errorCode: "RUN_NOT_FOUND" }, { status: 404 });
  }
  if (original.state !== "failed" && original.state !== "cancelled") {
    return NextResponse.json(
      { error: "Only failed or cancelled runs can be retried.", errorCode: "RUN_NOT_RETRYABLE" },
      { status: 409 }
    );
  }
  if (!original.pdf_path) {
    return NextResponse.json(
      { error: "The original PDF is no longer available. Upload it again.", errorCode: "PDF_UNAVAILABLE" },
      { status: 409 }
    );
  }

  const { data: created, error: insertError } = await supabase
    .from("sync_runs")
    .insert({
      source_filename: original.source_filename ?? original.original_filename,
      original_filename: original.original_filename,
      pdf_path: original.pdf_path,
      pdf_sha256: original.pdf_sha256,
      uploaded_by: user.id,
      state: "queued",
      status: "pending",
      progress_pct: 0,
      progress_message: "Queued for extraction (retry)",
      extractor_version: EXTRACTOR_VERSION,
      retry_of_run_id: original.id,
      // A retry of an already-processed PDF is an explicit, audited decision.
      override_reason: original.override_reason ?? `Retry of run ${original.id}`,
    })
    .select("id, state")
    .single();

  if (insertError || !created) {
    console.error("Retry insert failed", insertError);
    return NextResponse.json({ error: "Could not create the retry run.", errorCode: "RETRY_FAILED" }, { status: 500 });
  }

  return NextResponse.json(
    { runId: created.id, state: created.state, retryOf: original.id },
    { status: 201, headers: { "Cache-Control": "private, no-store" } }
  );
}
