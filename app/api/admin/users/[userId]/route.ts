import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { canManageUsers, isOwner, normalizeRole } from "@/lib/permissions";

const ROLES = new Set(["no_special_access", "quality", "admin", "owner"]);

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

  if (!canManageUsers(currentRole?.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const role = body.role;

  if (typeof role !== "string" || !ROLES.has(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  const { data: targetRole } = await supabase
    .from("user_roles")
    .select("role, full_name")
    .eq("user_id", userId)
    .maybeSingle();

  const currentIsOwner = isOwner(currentRole?.role);
  const targetNormalizedRole = normalizeRole(targetRole?.role);

  if (targetNormalizedRole === "owner" && !currentIsOwner) {
    return NextResponse.json({ error: "Only the owner can change owner accounts." }, { status: 403 });
  }

  if (role === "owner" && !currentIsOwner) {
    return NextResponse.json({ error: "Only the owner can grant owner access." }, { status: 403 });
  }

  if (targetNormalizedRole === "owner" && role !== "owner") {
    const { count: ownerCount, error: ownerCountError } = await supabase
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "owner");

    if (ownerCountError) {
      return NextResponse.json({ error: "Could not verify owner accounts." }, { status: 500 });
    }

    if ((ownerCount ?? 0) <= 1) {
      return NextResponse.json({ error: "You cannot remove the last owner." }, { status: 400 });
    }
  }

  if (role === "no_special_access") {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);

    if (error) {
      return NextResponse.json({ error: "Could not remove user access." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  const payload = {
    user_id: userId,
    role,
    full_name: targetRole?.full_name ?? null,
  };

  const { error } = targetRole
    ? await supabase.from("user_roles").update({ role }).eq("user_id", userId)
    : await supabase.from("user_roles").insert(payload);

  if (error) {
    return NextResponse.json({ error: "Could not update user access." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
