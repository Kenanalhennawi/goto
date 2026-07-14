import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SignOutButton } from "@/components/SignOutButton";
import { SearchTrigger } from "@/components/SearchTrigger";
import { SidebarNav, type SidebarNavItem } from "@/components/SidebarNav";
import type { UserRole } from "@/lib/types";
import { canAccessAdmin, normalizeRoleLabel } from "@/lib/permissions";

// App shell navigation: fixed sidebar on desktop, glass top bar on mobile.
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

  const navItems: SidebarNavItem[] = [
    { label: "Command center", href: "/", icon: "home" },
    { label: "Decision", href: "/decision", icon: "shield" },
    { label: "Services", href: "/services", icon: "grid" },
    { label: "Files", href: "/files", icon: "folder" },
  ];
  const adminItems: SidebarNavItem[] = showAdmin
    ? [
        { label: "Procedures", href: "/admin/procedures", icon: "list" },
        { label: "Quality", href: "/admin/quality", icon: "book" },
        { label: "Admin", href: "/admin", icon: "shield" },
      ]
    : [];

  return (
    <>
      <aside className="app-sidebar" aria-label="Sidebar">
        <Link href="/" className="group mb-4 flex items-center gap-2.5 px-1">
          <span className="press flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-display text-xs font-bold text-white shadow-sm transition-transform group-hover:scale-105">
            FZ
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-sm font-semibold tracking-tight text-white">
              GO TO
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/45">
              Contact Centre Guide
            </span>
          </span>
        </Link>

        <div className="mb-4">
          <SearchTrigger variant="sidebar" />
        </div>

        <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
          Workspace
        </p>
        <SidebarNav items={navItems} />

        {adminItems.length > 0 && (
          <>
            <p className="mb-1 mt-4 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
              Manage
            </p>
            <SidebarNav items={adminItems} />
          </>
        )}

        <div className="mt-auto border-t border-white/10 pt-3">
          {user ? (
            <div className="flex flex-col gap-2">
              <Link
                href="/account"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-white/8"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold text-white">
                  {(displayName ?? "A").slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-xs font-semibold text-white">
                    {displayName}
                  </span>
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-white/45">
                    {normalizeRoleLabel(roleName)}
                  </span>
                </span>
              </Link>
              <SignOutButton variant="dark" />
            </div>
          ) : (
            <Link
              href="/login"
              className="press flex items-center justify-center rounded-md bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-dim"
            >
              Sign in
            </Link>
          )}
        </div>
      </aside>

      <header className="glass-dark sticky top-0 z-40 border-b border-white/10 lg:hidden">
        <div className="flex h-13 items-center gap-3 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent font-display text-[10px] font-bold text-white">
              FZ
            </span>
            <span className="font-display text-sm font-semibold text-white">GO TO</span>
          </Link>
          <SearchTrigger variant="topbar" />
          <nav className="flex items-center gap-0.5">
            <Link href="/services" className="rounded-md px-2 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white">
              Services
            </Link>
            <Link href="/files" className="rounded-md px-2 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white">
              Files
            </Link>
            {showAdmin && (
              <Link href="/admin" className="rounded-md px-2 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white">
                Admin
              </Link>
            )}
            {!user && (
              <Link href="/login" className="rounded-md bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-dim">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}
