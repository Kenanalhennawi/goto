import { NextResponse } from "next/server";
import { requireAdmin, forbiddenResponse } from "@/lib/auth/guards";
import { isOwner } from "@/lib/permissions";

// UPD-2.7: record an audited OWNER override for the mass-reclassification
// guard. Admin-only is deliberately NOT sufficient, and the worker can never
// bypass silently — the override must exist as a row value with a reason and
// an owner attached. Recording an override does not publish anything.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await requireAdmin();
  if (!session.ok) return session.response;
  const { supabase, user, role } = session;

  // Owner only — an admin cannot bypass the guard.
  if (!isOwner(role)) return forbiddenResponse();

  const body = await request.json().catch(() => null);
  const reason =
    body && typeof body === "object" && typeof (body as Record<string, unknown>).reason === "string"
      ? ((body as Record<string, unknown>).reason as string).trim()
      : "";

  if (reason.length < 10 || reason.length > 500) {
    return NextResponse.json(
      { error: "Provide an override reason of 10-500 characters.", errorCode: "INVALID_OVERRIDE_REASON" },
      { status: 400 }
    );
  }

  // PUB-1.1: record the override through the owner-only SECURITY DEFINER RPC
  // instead of updating sync_runs directly.
  //
  // The direct UPDATE this replaced was NOT the security boundary it appeared to
  // be. public.sync_runs carries five permissive policies, and PostgreSQL ORs
  // permissive policies together, so "Quality+ manage sync runs" (FOR ALL)
  // widened write access to quality, admin AND owner. Measured against a real
  // PostgreSQL with all five policies installed, every one of those roles could
  // PATCH reclass_override_reason / _by / _at straight through PostgREST and
  // then publish a mass-reclassified run — and could set reclass_override_by to
  // somebody else's UUID, fabricating an audit trail.
  //
  // RLS cannot close this: it is row-level and cannot constrain columns. The
  // boundary is now a trigger plus this RPC, so it holds for every caller
  // regardless of which policy admitted the row.
  //
  // The RPC derives the actor from auth.uid() server-side. `user.id` is
  // deliberately NOT sent — a client-supplied actor is never trusted.
  const { data, error: overrideError } = await supabase.rpc("record_sync_reclass_override", {
    p_run_id: id,
    p_reason: reason,
  });

  if (overrideError) {
    // Map the RPC's stable error codes onto HTTP without leaking internals.
    const raw = `${overrideError.message ?? ""} ${overrideError.details ?? ""}`;
    const mapped = raw.includes("OWNER_REQUIRED")
      ? { status: 403, errorCode: "OWNER_REQUIRED", message: "Only an owner may record an override." }
      : raw.includes("RUN_NOT_FOUND")
        ? { status: 404, errorCode: "RUN_NOT_FOUND", message: "Sync run not found." }
        : raw.includes("INVALID_OVERRIDE_REASON")
          ? { status: 400, errorCode: "INVALID_OVERRIDE_REASON", message: "Provide an override reason of 10-500 characters." }
          : raw.includes("PGRST202") || /Could not find the function/i.test(raw)
            ? { status: 500, errorCode: "OVERRIDE_RPC_MISSING", message: "The override function is not deployed. Apply the latest migration." }
            : { status: 500, errorCode: "OVERRIDE_FAILED", message: "Could not record the override." };

    console.error("Reclassification override failed", {
      syncRunId: id,
      code: overrideError.code ?? null,
      errorCode: mapped.errorCode,
    });
    return NextResponse.json(
      { error: mapped.message, errorCode: mapped.errorCode },
      { status: mapped.status, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Sync run not found.", errorCode: "RUN_NOT_FOUND" },
      { status: 404, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  return NextResponse.json(
    { runId: id, overridden: true, actorId: user.id },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
