import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { canManageUsers } from "@/lib/permissions";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    return NextResponse.json({ error: "Only admins can delete sync runs." }, { status: 403 });
  }

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
