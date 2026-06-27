import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const ROLES = new Set(["agent", "supervisor", "quality", "admin", "owner"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  if (user.id === userId) {
    return NextResponse.json({ error: "You cannot change your own role here." }, { status: 400 });
  }

  const { data: currentRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (currentRole?.role !== "admin" && currentRole?.role !== "owner") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json();
  const role = body.role;

  if (typeof role !== "string" || !ROLES.has(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  const { data: targetRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (targetRole?.role === "owner" && currentRole.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can change owner accounts." }, { status: 403 });
  }

  if (role === "owner" && currentRole.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can grant owner access." }, { status: 403 });
  }

  const { error } = await supabase
    .from("user_roles")
    .update({ role })
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: "Could not update user role." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
