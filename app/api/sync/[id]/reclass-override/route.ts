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

  const { data: run, error: loadError } = await supabase
    .from("sync_runs")
    .select("id, state")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json({ error: "Could not load the sync run.", errorCode: "RUN_LOAD_FAILED" }, { status: 500 });
  }
  if (!run) {
    return NextResponse.json({ error: "Sync run not found.", errorCode: "RUN_NOT_FOUND" }, { status: 404 });
  }

  const { error } = await supabase
    .from("sync_runs")
    .update({
      reclass_override_reason: reason,
      reclass_override_by: user.id,
      reclass_override_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Reclassification override failed", error.code ?? null);
    return NextResponse.json({ error: "Could not record the override.", errorCode: "OVERRIDE_FAILED" }, { status: 500 });
  }

  return NextResponse.json(
    { runId: id, overridden: true },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
