import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";

const KEEP_RECENT_COUNT = 3;

export async function DELETE() {
  // SEC-1 guard: admin/owner only (unchanged rule).
  const session = await requireAdmin();
  if (!session.ok) return session.response;
  const { supabase } = session;

  const { data: runs, error: runsError } = await supabase
    .from("sync_runs")
    .select("id")
    .order("created_at", { ascending: false });

  if (runsError) {
    return NextResponse.json({ error: "Couldn't read sync runs." }, { status: 500 });
  }

  const deleteIds = (runs ?? []).slice(KEEP_RECENT_COUNT).map((run) => run.id);
  if (deleteIds.length === 0) {
    return NextResponse.json({ success: true, deleted: 0 });
  }

  const { error: stagedError } = await supabase
    .from("sync_staged_changes")
    .delete()
    .in("sync_run_id", deleteIds);

  if (stagedError) {
    return NextResponse.json(
      { error: "Couldn't delete old staged changes. Run the delete migration first." },
      { status: 500 }
    );
  }

  const { error } = await supabase.from("sync_runs").delete().in("id", deleteIds);
  if (error) {
    return NextResponse.json(
      { error: "Couldn't delete old sync runs. Run the delete migration first." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, deleted: deleteIds.length });
}
