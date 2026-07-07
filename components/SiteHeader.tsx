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
    <header className="sticky top-0 z-40 border-b border-border bg-white/88 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent font-display text-sm font-bold text-white shadow-sm">
            FZ
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-base font-semibold tracking-tight text-ink">
              GO TO
            </span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
              Contact Centre Guide
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 font-medium text-ink-muted transition-colors hover:bg-sky-soft hover:text-sky"
          >
            Manifest
          </Link>
          <Link
            href="/files"
            className="rounded-lg px-3 py-2 font-medium text-ink-muted transition-colors hover:bg-sky-soft hover:text-sky"
          >
            Files
          </Link>

          {user ? (
            <>
              {showAdmin && (
                <Link
                  href="/admin/procedures"
                  className="hidden rounded-lg px-3 py-2 font-medium text-ink-muted transition-colors hover:bg-sky-soft hover:text-sky sm:inline-flex"
                >
                  Procedures
                </Link>
              )}
              {showAdmin && (
                <Link
                  href="/admin"
                  className="rounded-lg border border-border bg-white px-3 py-2 font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/account"
                className="hidden rounded-lg px-3 py-2 font-medium text-ink-muted transition-colors hover:bg-sky-soft hover:text-sky sm:inline-flex"
              >
                Account
              </Link>
              <div className="hidden items-center gap-2 rounded-lg bg-sky-soft px-3 py-2 sm:flex">
                <span className="max-w-36 truncate text-xs font-semibold text-ink">
                  {displayName}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-sky">
                  {normalizeRoleLabel(roleName)}
                </span>
              </div>
              <SignOutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-ink px-3 py-2 font-medium text-white transition-colors hover:bg-accent"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
