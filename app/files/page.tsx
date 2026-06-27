import { SiteHeader } from "@/components/SiteHeader";
import { FilesSearchClient } from "@/components/FilesSearchClient";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { extractChapterFileLinks } from "@/lib/content-links";
import type { Chapter } from "@/lib/types";

export const revalidate = 60;

type ChapterLinkSource = Pick<Chapter, "chapter_number" | "title" | "slug" | "content_blocks">;

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q, type } = await searchParams;
  const query = q?.trim() ?? "";
  const selectedType = type?.trim().toUpperCase() ?? "ALL";
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("chapters")
    .select("chapter_number, title, slug, content_blocks")
    .order("chapter_number", { ascending: true });

  const allLinks = ((data as ChapterLinkSource[] | null) ?? []).flatMap(extractChapterFileLinks);
  const types = Array.from(new Set(allLinks.map((link) => link.file_type))).sort();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
        <FilesSearchClient
          links={allLinks}
          types={types}
          initialQuery={query}
          initialType={selectedType}
        />
      </main>
    </div>
  );
}
