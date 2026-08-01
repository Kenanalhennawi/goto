import { NextResponse } from "next/server";
import { requireAdmin, requireReviewer } from "@/lib/auth/guards";

const STATUSES = new Set(["open", "reviewing", "resolved", "dismissed"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // SEC-1 guard: quality/admin/owner may update issue status (unchanged rule).
  const session = await requireReviewer();
  if (!session.ok) return session.response;
  const { supabase, user } = session;

  const body = (await request.json().catch(() => ({}))) as { status?: string };
  const status = body.status?.trim() ?? "";
  if (!STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const { error } = await supabase
    .from("content_issues")
    .update({
      status,
      resolved_at: status === "resolved" || status === "dismissed" ? new Date().toISOString() : null,
      resolved_by: status === "resolved" || status === "dismissed" ? user.id : null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Couldn't update issue." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // SEC-1 guard: admin/owner may delete issues (unchanged rule).
  const session = await requireAdmin();
  if (!session.ok) return session.response;
  const { supabase } = session;

  const { error } = await supabase.from("content_issues").delete().eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "Couldn't delete issue. Run the delete migration if this is the first time." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
