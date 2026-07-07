import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { canManageUsers } from "@/lib/permissions";

const KEEP_RECENT_COUNT = 3;

export async function DELETE() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!canManageUsers(role?.role)) {
    return NextResponse.json({ error: "Only admins can clean up sync runs." }, { status: 403 });
  }

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
