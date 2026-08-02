import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { EXTRACTOR_VERSION, MANUAL_SOURCES_BUCKET } from "@/lib/sync-upload";
import { dispatchPdfSync, dispatchMessage } from "@/lib/github-dispatch";

// UPD-2: create a sync run AFTER the PDF has been uploaded to private storage.
// The run is queued for the background worker; this route performs no PDF
// processing itself. It never approves or publishes anything.
const ACTIVE_STATES = ["uploaded", "queued", "validating", "extracting", "staged", "publishing"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session.ok) return session.response;
  const { supabase, user } = session;

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid request.", errorCode: "INVALID_BODY" }, { status: 400 });
  }

  const path = typeof body.path === "string" ? body.path.trim() : "";
  const originalFilename = typeof body.originalFilename === "string" ? body.originalFilename.trim() : "";
  const sha256 = typeof body.sha256 === "string" ? body.sha256.trim().toLowerCase() : null;
  const overrideReason =
    typeof body.overrideReason === "string" && body.overrideReason.trim().length > 0
      ? body.overrideReason.trim().slice(0, 500)
      : null;

  if (!path || !path.startsWith("pending/")) {
    return NextResponse.json({ error: "Invalid upload reference.", errorCode: "INVALID_PATH" }, { status: 400 });
  }
  if (!originalFilename || !/\.pdf$/i.test(originalFilename)) {
    return NextResponse.json({ error: "Invalid file name.", errorCode: "INVALID_FILENAME" }, { status: 400 });
  }
  if (sha256 !== null && !/^[a-f0-9]{64}$/.test(sha256)) {
    return NextResponse.json({ error: "Invalid file hash.", errorCode: "INVALID_HASH" }, { status: 400 });
  }

  // Duplicate policy: the same PDF cannot be queued twice while a run is
  // active, and an identical hash is rejected outright unless an owner
  // supplies an explicit override reason (audited on the run row).
  if (sha256) {
    const { data: existing, error: dupError } = await supabase
      .from("sync_runs")
      .select("id, state")
      .eq("pdf_sha256", sha256)
      .in("state", ACTIVE_STATES)
      .limit(1);

    if (dupError) {
      console.error("Duplicate check failed", dupError);
      return NextResponse.json({ error: "Could not start the sync.", errorCode: "DUPLICATE_CHECK_FAILED" }, { status: 500 });
    }
    if ((existing?.length ?? 0) > 0 && !overrideReason) {
      return NextResponse.json(
        {
          error: "This PDF is already being processed. Provide an override reason to force a new run.",
          errorCode: "DUPLICATE_ACTIVE_RUN",
          runId: existing![0].id,
        },
        { status: 409 }
      );
    }
  }

  const { data, error } = await supabase
    .from("sync_runs")
    .insert({
      source_filename: originalFilename,
      original_filename: originalFilename,
      pdf_path: path,
      pdf_sha256: sha256,
      uploaded_by: user.id,
      state: "queued",
      status: "pending",
      progress_pct: 0,
      progress_message: "Queued for extraction",
      extractor_version: EXTRACTOR_VERSION,
      override_reason: overrideReason,
    })
    .select("id, state, progress_pct")
    .single();

  if (error || !data) {
    console.error("Sync run insert failed", error);
    return NextResponse.json({ error: "Could not create the sync run.", errorCode: "RUN_CREATE_FAILED" }, { status: 500 });
  }

  // ---------------------------------------------------------------------
  // Ask GitHub Actions to process the queue.
  //
  // There is no permanent worker: nothing will happen until something asks.
  // This is deliberately AFTER the run row is committed, so the ordering is
  // always "durable first, best-effort second". If dispatch fails, the PDF is
  // in storage and the run is 'queued' — the scheduled recovery workflow will
  // collect it. So a dispatch failure is a WARNING on a 201, never a 5xx:
  // failing the upload would tell the administrator to re-upload a file that
  // was in fact saved, and duplicate uploads are then rejected by the
  // sync_runs_active_hash_idx unique index, which is a confusing dead end.
  // ---------------------------------------------------------------------
  const dispatch = await dispatchPdfSync(data.id);
  const attemptedAt = new Date().toISOString();

  // Telemetry only: timestamps and a short code from a closed set. No token,
  // no GitHub response body. Failure to record telemetry must not affect the
  // upload result, so the error is swallowed after logging.
  const { error: telemetryError } = await supabase
    .from("sync_runs")
    .update({
      dispatch_attempted_at: attemptedAt,
      dispatch_succeeded_at: dispatch.ok ? attemptedAt : null,
      dispatch_error_code: dispatch.ok ? null : dispatch.code,
    })
    .eq("id", data.id);
  if (telemetryError) console.error("Dispatch telemetry write failed", telemetryError.message);

  if (!dispatch.ok) console.error("PDF sync dispatch failed", dispatch.code);

  return NextResponse.json(
    {
      runId: data.id,
      state: data.state,
      bucket: MANUAL_SOURCES_BUCKET,
      dispatched: dispatch.ok,
      ...(dispatch.ok ? {} : { warning: dispatchMessage(dispatch.code), warningCode: dispatch.code }),
    },
    { status: 201, headers: { "Cache-Control": "private, no-store" } }
  );
}
