import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SiteHeader } from "@/components/SiteHeader";
import { redirect } from "next/navigation";
import { UserRoleManager } from "@/components/UserRoleManager";

export default async function AdminUsersPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: currentRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (currentRole?.role !== "admin" && currentRole?.role !== "owner") redirect("/admin");

  const { data: users } = await supabase
    .from("user_roles")
    .select("user_id, role, full_name, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
        <section className="content-card mb-6 p-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Admin only
          </p>
          <h1 className="font-display text-2xl font-semibold text-ink">User access</h1>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            New users stay as agent until an admin approves them as quality or admin.
          </p>
        </section>

        <UserRoleManager
          users={users ?? []}
          currentUserId={user.id}
          currentRole={currentRole.role}
        />
      </main>
    </div>
  );
}
