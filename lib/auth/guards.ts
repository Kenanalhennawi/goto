// Reusable server-side authorization guards (SEC-1).
// Used by every API route handler. Middleware (proxy.ts) is the outer wall;
// these guards are the per-route enforcement so no handler ever relies on UI
// gating alone. Responses are consistent and never leak internals.

import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { canAccessAdmin, canManageUsers } from "@/lib/permissions";

type SupabaseServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type GuardOk = {
  ok: true;
  supabase: SupabaseServerClient;
  user: User;
  role: string | null;
};
export type GuardFail = { ok: false; response: NextResponse };
export type GuardResult = GuardOk | GuardFail;

export function unauthenticatedResponse() {
  return NextResponse.json(
    { error: "Authentication required", errorCode: "AUTH_REQUIRED" },
    { status: 401 }
  );
}

export function forbiddenResponse() {
  return NextResponse.json(
    { error: "You do not have permission to perform this action.", errorCode: "FORBIDDEN" },
    { status: 403 }
  );
}

async function resolveSession(): Promise<GuardResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: unauthenticatedResponse() };

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  return { ok: true, supabase, user, role: data?.role ?? null };
}

/** Any authenticated user (agents included). */
export async function requireUser(): Promise<GuardResult> {
  return resolveSession();
}

/** Quality / admin / owner (review-level access). */
export async function requireReviewer(): Promise<GuardResult> {
  const session = await resolveSession();
  if (!session.ok) return session;
  if (!canAccessAdmin(session.role)) return { ok: false, response: forbiddenResponse() };
  return session;
}

/** Admin / owner (destructive + user management). */
export async function requireAdmin(): Promise<GuardResult> {
  const session = await resolveSession();
  if (!session.ok) return session;
  if (!canManageUsers(session.role)) return { ok: false, response: forbiddenResponse() };
  return session;
}
