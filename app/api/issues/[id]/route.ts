import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const STATUSES = new Set(["open", "reviewing", "resolved", "dismissed"]);

export async function PATCH(
  request: Request,
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

  if (!role || !["quality", "admin", "owner"].includes(role.role)) {
    return NextResponse.json({ error: "No access." }, { status: 403 });
  }

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
