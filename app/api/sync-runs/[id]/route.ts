import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // SEC-1 guard: admin/owner only (unchanged rule).
  const session = await requireAdmin();
  if (!session.ok) return session.response;
  const { supabase } = session;

  const { error: stagedError } = await supabase
    .from("sync_staged_changes")
    .delete()
    .eq("sync_run_id", id);

  if (stagedError) {
    return NextResponse.json(
      { error: "Couldn't delete staged sync changes. Run the delete migration if this is the first time." },
      { status: 500 }
    );
  }

  const { error } = await supabase.from("sync_runs").delete().eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "Couldn't delete sync run. Run the delete migration if this is the first time." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
