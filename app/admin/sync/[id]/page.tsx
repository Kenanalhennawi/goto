import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SiteHeader } from "@/components/SiteHeader";
import { redirect, notFound } from "next/navigation";
import { SyncReviewClient } from "@/components/SyncReviewClient";
import { canManageUsers, isEditorRole } from "@/lib/permissions";

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

  if (!isEditorRole(role?.role)) {
    redirect("/admin");
  }

  const { data: syncRun } = await supabase
    .from("sync_runs")
    .select("id, source_filename, source_version, status, chapters_changed, chapters_added")
    .eq("id", id)
    .single();

  if (!syncRun) notFound();

  const { data: changes } = await supabase
    .from("sync_staged_changes")
    .select("id, chapter_number, title, is_new_chapter, old_body_text, new_body_text, old_keywords, new_keywords, approved")
    .eq("sync_run_id", id)
    .order("chapter_number", { ascending: true });

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10">
        <SyncReviewClient
          syncRun={syncRun}
          changes={changes ?? []}
          canPublish={canManageUsers(role?.role)}
        />
      </main>
    </div>
  );
}
