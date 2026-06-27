import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SiteHeader } from "@/components/SiteHeader";
import { redirect, notFound } from "next/navigation";
import { ChapterEditor } from "@/components/ChapterEditor";

export default async function AdminChapterEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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

  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, chapter_number, title, slug, search_keywords, body_text, content_blocks, page_start, page_end, word_count, source_version, updated_at")
    .eq("slug", slug)
    .single();

  if (!chapter) notFound();

  const { data: history } = await supabase
    .from("edit_history")
    .select("id, edited_by_email, change_type, created_at, previous_body_text, new_body_text, previous_content_blocks, new_content_blocks")
    .eq("chapter_id", chapter.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
        <ChapterEditor chapter={chapter} history={history ?? []} />
      </main>
    </div>
  );
}
