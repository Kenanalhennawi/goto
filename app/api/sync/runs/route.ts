import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { EXTRACTOR_VERSION, MANUAL_SOURCES_BUCKET } from "@/lib/sync-upload";

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

  return NextResponse.json(
    { runId: data.id, state: data.state, bucket: MANUAL_SOURCES_BUCKET },
    { status: 201, headers: { "Cache-Control": "private, no-store" } }
  );
}
