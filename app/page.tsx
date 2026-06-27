import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SiteHeader } from "@/components/SiteHeader";
import { SearchBar } from "@/components/SearchBar";
import { ChapterBadge } from "@/components/ChapterBadge";
import type { Chapter } from "@/lib/types";
import Link from "next/link";

export const revalidate = 60;

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, chapter_number, title, slug, search_keywords, body_text, word_count, updated_at")
    .order("chapter_number", { ascending: true });

  const list = (chapters ?? []) as Pick<
    Chapter,
    "id" | "chapter_number" | "title" | "slug" | "search_keywords" | "body_text" | "word_count" | "updated_at"
  >[];

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-baseline gap-3 mb-2">
            <h1 className="font-display text-3xl font-semibold text-ink tracking-tight">
              The Manifest
            </h1>
            <span className="font-mono text-xs text-ink-faint">
              {list.length || "—"} chapters · live
            </span>
          </div>
          <p className="text-ink-muted text-sm max-w-2xl">
            Every booking, baggage, payment, and disruption procedure — searchable in seconds.
            No more flipping through 355 pages.
          </p>
        </div>

        <div className="mb-10">
          <SearchBar autoFocus />
        </div>

        {list.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {list.map((chapter) => (
              <Link
                key={chapter.id}
                href={`/chapter/${chapter.slug}`}
                className="group flex items-start gap-3 bg-panel border border-border rounded-lg p-4 hover:border-accent/40 hover:bg-panel-hover transition-all"
              >
                <ChapterBadge number={chapter.chapter_number} size="sm" />
                <div className="flex-1 min-w-0">
                  <h2 className="font-display font-medium text-sm text-ink leading-snug group-hover:text-accent transition-colors">
                    {chapter.title}
                  </h2>
                  <p className="text-xs text-ink-muted mt-1 line-clamp-2">
                    {chapter.body_text?.slice(0, 110).trim()}…
                  </p>
                  {chapter.search_keywords?.length > 0 && (
                    <p className="text-[11px] text-ink-faint mt-1.5 line-clamp-1 font-mono">
                      {chapter.search_keywords.slice(0, 3).join(" · ")}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-border py-6">
        <div className="max-w-6xl mx-auto px-6 text-xs text-ink-faint flex items-center justify-between">
          <span>Internal flydubai contact centre reference. Not for external distribution.</span>
          <span className="font-mono">v—</span>
        </div>
      </footer>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-border rounded-lg p-12 text-center">
      <p className="font-display text-lg text-ink mb-2">No chapters loaded yet</p>
      <p className="text-sm text-ink-muted max-w-md mx-auto">
        Once the database is connected and a PDF sync has run, the 78 chapters of the
        GO TO manual will appear here, fully searchable.
      </p>
    </div>
  );
}
