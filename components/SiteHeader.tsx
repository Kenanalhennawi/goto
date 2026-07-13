import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SignOutButton } from "@/components/SignOutButton";
import type { UserRole } from "@/lib/types";
import { canAccessAdmin, normalizeRoleLabel } from "@/lib/permissions";

export async function SiteHeader() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: role } = user
    ? await supabase
        .from("user_roles")
        .select("role, full_name")
        .eq("user_id", user.id)
        .single()
    : { data: null };

  const roleName = role?.role as UserRole | undefined;
  const displayName = role?.full_name ?? user?.email ?? null;
  const showAdmin = canAccessAdmin(roleName);

  return (
    <header className="sticky top-0 z-40 border-b border-navy-soft bg-navy">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-accent font-display text-xs font-bold text-white">
            FZ
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-sm font-semibold tracking-tight text-white">
              GO TO
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/55">
              Contact Centre Guide
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/"
            className="rounded px-2.5 py-1.5 text-[13px] font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
          >
            Manifest
          </Link>
          <Link
            href="/files"
            className="rounded px-2.5 py-1.5 text-[13px] font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
          >
            Files
          </Link>
          <Link
            href="/services"
            className="rounded px-2.5 py-1.5 text-[13px] font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
          >
            Services
          </Link>

          {user ? (
            <>
              {showAdmin && (
                <Link
                  href="/admin/procedures"
                  className="hidden rounded px-2.5 py-1.5 text-[13px] font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex"
                >
                  Procedures
                </Link>
              )}
              {showAdmin && (
                <Link
                  href="/admin"
                  className="rounded border border-white/25 px-2.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:border-accent hover:bg-accent"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/account"
                className="hidden rounded px-2.5 py-1.5 text-[13px] font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex"
              >
                Account
              </Link>
              <div className="hidden items-center gap-2 rounded bg-white/10 px-2.5 py-1.5 sm:flex">
                <span className="max-w-36 truncate text-xs font-semibold text-white">
                  {displayName}
                </span>
                <span className="rounded-sm bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/85">
                  {normalizeRoleLabel(roleName)}
                </span>
              </div>
              <SignOutButton variant="dark" />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded bg-accent px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-dim"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
