import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SearchBar } from "@/components/SearchBar";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { SearchResult } from "@/lib/types";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query.length >= 2 ? await search(query) : [];

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-ink-muted shadow-sm ring-1 ring-border transition-colors hover:text-accent"
        >
          &larr; Back to chapters
        </Link>

        <section className="content-card mb-6 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Search
          </p>
          <h1 className="mb-4 font-display text-3xl font-semibold tracking-tight text-ink">
            {query ? `Results for "${query}"` : "Search the GO TO guide"}
          </h1>
          <SearchBar defaultValue={query} />
        </section>

        {query.length < 2 ? (
          <Empty message="Type at least two characters to search by issue, SSR, process, or keyword." />
        ) : results.length === 0 ? (
          <Empty message="No matching chapters found. Try a shorter keyword or an SSR code." />
        ) : (
          <div className="space-y-3">
            {results.map((result) => (
              <Link
                key={result.id}
                href={`/chapter/${result.slug}`}
                className="content-card group block p-4 transition-colors hover:border-accent hover:bg-panel-hover"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-md bg-orange-50 px-2 py-1 font-mono text-xs font-semibold tabular-nums text-accent">
                    {String(result.chapter_number).padStart(2, "0")}
                  </span>
                  <h2 className="font-display text-base font-semibold text-ink group-hover:text-accent">
                    {result.title}
                  </h2>
                </div>
                <p
                  className="text-sm leading-6 text-ink-muted"
                  dangerouslySetInnerHTML={{ __html: result.snippet }}
                />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

async function search(query: string) {
  const supabase = await createServerSupabaseClient();
  const terms = query
    .split(/\s+/)
    .map((term) => term.replace(/[^\w-]/g, ""))
    .filter(Boolean)
    .map((term) => `${term}:*`)
    .join(" & ");

  if (!terms) return [];

  const { data, error } = await supabase.rpc("search_chapters", {
    query: terms,
  });

  if (error || !data) return [];
  return data as SearchResult[];
}

function Empty({ message }: { message: string }) {
  return <div className="content-card p-8 text-sm text-ink-muted">{message}</div>;
}
