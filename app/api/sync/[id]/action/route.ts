import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";

// One endpoint for every supported recovery action.
//
// Each of these previously required hand-written SQL against production:
// re-queueing a stuck run, clearing a bad staged review, un-sticking a run that
// died mid-publish. That is what turned a PDF update into days of database
// surgery. Every action is now an RPC that validates its own preconditions, so
// there is no state an administrator can reach that needs manual repair.
//
// Authorisation is enforced inside each RPC (assert_sync_admin), not here — a
// direct PostgREST call gets the same answer as this route.
export const dynamic = "force-dynamic";

const ACTIONS = {
  // Re-run extraction on the PDF already in storage.
  reprocess: { rpc: "reprocess_sync_run", args: (id: string) => ({ p_run_id: id }) },
  // Stop a run that is queued or processing.
  cancel: {
    rpc: "cancel_sync_run",
    args: (id: string, reason?: string) => ({ p_run_id: id, p_reason: reason ?? null }),
  },
  // Throw away a staged review without touching live content.
  discard: { rpc: "discard_sync_run_staging", args: (id: string) => ({ p_run_id: id }) },
  // Recover a run stranded in 'publishing' by an interrupted publish.
  restore: { rpc: "restore_sync_run_to_staged", args: (id: string) => ({ p_run_id: id }) },
} as const;

type ActionName = keyof typeof ACTIONS;

// Refusals are expected outcomes, not server faults. Each maps to a sentence an
// administrator can act on without knowing what an RPC is.
const REFUSALS: Record<string, { status: number; message: string }> = {
  ADMIN_REQUIRED: { status: 403, message: "Only an admin or owner may do this." },
  NOT_AUTHENTICATED: { status: 401, message: "Please sign in again." },
  RUN_NOT_FOUND: { status: 404, message: "That update could not be found." },
  RUN_TERMINAL: {
    status: 409,
    message: "This update is already finished and cannot be changed. Upload the PDF again to start a new one.",
  },
  NO_STORED_PDF: {
    status: 409,
    message: "The original PDF is no longer stored. Please upload it again.",
  },
  NOT_IN_PUBLISHING: {
    status: 409,
    message: "This update is not stuck mid-publish, so it does not need restoring.",
  },
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await requireAdmin();
  if (!session.ok) return session.response;
  const { supabase } = session;

  const body = (await request.json().catch(() => null)) as
    | { action?: string; reason?: string }
    | null;
  const action = body?.action as ActionName | undefined;

  if (!action || !(action in ACTIONS)) {
    return NextResponse.json(
      { error: "Unknown action.", errorCode: "UNKNOWN_ACTION", supported: Object.keys(ACTIONS) },
      { status: 400 }
    );
  }

  const spec = ACTIONS[action];
  // Each action supplies exactly the arguments its own RPC declares; the union
  // of those shapes is wider than any single RPC signature.
  const { data, error } = await supabase.rpc(
    spec.rpc,
    spec.args(id, body?.reason) as Record<string, unknown>
  );

  if (error) {
    const raw = `${error.message ?? ""} ${error.details ?? ""}`;

    if (error.code === "PGRST202" || /Could not find the function/i.test(raw)) {
      return NextResponse.json(
        {
          error:
            "The database is not yet migrated. Restart the worker service — it applies migrations on start.",
          errorCode: "MIGRATION_PENDING",
        },
        { status: 503 }
      );
    }

    const key = Object.keys(REFUSALS).find((k) => raw.includes(k));
    if (key) {
      return NextResponse.json(
        { error: REFUSALS[key].message, errorCode: key },
        { status: REFUSALS[key].status, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    console.error("Sync run action failed", { syncRunId: id, action, code: error.code ?? null });
    return NextResponse.json(
      { error: "That action could not be completed.", errorCode: "ACTION_FAILED" },
      { status: 500 }
    );
  }

  const run = (Array.isArray(data) ? data[0] : data) as { state?: string } | null;
  return NextResponse.json(
    { runId: id, action, state: run?.state ?? null },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
