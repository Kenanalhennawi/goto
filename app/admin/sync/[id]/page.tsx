import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SiteHeader } from "@/components/SiteHeader";
import { redirect, notFound } from "next/navigation";
import { SyncReviewClient } from "@/components/SyncReviewClient";

export default async function SyncReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!role || !["quality", "admin", "owner"].includes(role.role)) {
    redirect("/admin");
  }

  const { data: syncRun } = await supabase
    .from("sync_runs")
    .select("*")
    .eq("id", id)
    .single();

  if (!syncRun) notFound();

  const { data: changes } = await supabase
    .from("sync_staged_changes")
    .select("*")
    .eq("sync_run_id", id)
    .order("chapter_number", { ascending: true });

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10">
        <SyncReviewClient syncRun={syncRun} changes={changes ?? []} />
      </main>
    </div>
  );
}
