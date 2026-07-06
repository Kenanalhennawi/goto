import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SearchBar } from "@/components/SearchBar";
import { SEARCH_EXAMPLES } from "@/lib/operational-content";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { buildSearchTerms, MIN_SEARCH_QUERY_LENGTH, plainSnippet } from "@/lib/search";
import type { SearchResult } from "@/lib/types";

type EnrichedSearchResult = SearchResult & {
  page_start?: number | null;
  page_end?: number | null;
  search_keywords?: string[] | null;
  source_version?: string | null;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query.length >= MIN_SEARCH_QUERY_LENGTH ? await search(query) : [];

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-ink-muted shadow-sm ring-1 ring-border transition-colors hover:text-accent"
        >
          &larr; Back to chapters
        </Link>

        <section className="content-card mb-6 p-5 sm:p-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Operational search
          </p>
          <h1 className="mb-3 font-display text-3xl font-semibold tracking-tight text-ink">
            {query ? `Results for "${query}"` : "Search the GO TO guide"}
          </h1>
          <p className="mb-5 max-w-2xl text-sm leading-6 text-ink-muted">
            Search by passenger issue, SSR code, process name, system keyword, or operational shorthand.
          </p>
          <SearchBar defaultValue={query} />
        </section>

        {query.length < MIN_SEARCH_QUERY_LENGTH ? (
          <EmptyState message="Type at least two characters to search by issue, SSR, process, or keyword." />
        ) : results.length === 0 ? (
          <EmptyState message="No matching chapters found. Try a shorter keyword, process name, or SSR code." />
        ) : (
          <div className="space-y-4">
            {results.map((result) => (
              <SearchResultCard key={result.id} result={result} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

async function search(query: string): Promise<EnrichedSearchResult[]> {
  const supabase = await createServerSupabaseClient();
  const terms = buildSearchTerms(query);

  if (!terms) return [];

  const { data, error } = await supabase.rpc("search_chapters", {
    query: terms,
  });

  if (error || !data) return [];

  const results = data as SearchResult[];
  const ids = results.map((result) => result.id).filter(Boolean);
  if (ids.length === 0) return results;

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, page_start, page_end, search_keywords, source_version")
    .in("id", ids);

  const metadata = new Map(
    (chapters ?? []).map((chapter) => [
      chapter.id,
      {
        page_start: chapter.page_start,
        page_end: chapter.page_end,
        search_keywords: chapter.search_keywords,
        source_version: chapter.source_version,
      },
    ])
  );

  return results.map((result) => ({ ...result, ...metadata.get(result.id) }));
}

function SearchResultCard({ result }: { result: EnrichedSearchResult }) {
  const snippet = plainSnippet(result.snippet);
  const pages = pageLabel(result.page_start, result.page_end);

  return (
    <article className="content-card quick-card p-4 transition-all hover:-translate-y-0.5 hover:border-accent sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="blue">Chapter</Badge>
            <Badge tone="orange">Ch. {String(result.chapter_number).padStart(2, "0")}</Badge>
            {pages ? <Badge tone="neutral">{pages}</Badge> : null}
            {result.source_version ? <Badge tone="neutral">{result.source_version}</Badge> : null}
          </div>
          <h2 className="font-display text-xl font-semibold leading-snug text-ink">
            {result.title}
          </h2>
          {snippet ? (
            <p className="mt-3 max-w-4xl text-sm leading-6 text-ink-muted">{snippet}</p>
          ) : null}
          {result.search_keywords?.length ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {result.search_keywords.slice(0, 8).map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full border border-blue-200 bg-sky-soft px-2.5 py-1 text-[11px] font-semibold text-sky"
                >
                  {keyword}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <Link
          href={`/chapter/${result.slug}`}
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent"
        >
          Open chapter
        </Link>
      </div>
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="content-card p-6">
      <p className="text-sm font-semibold text-ink">{message}</p>
      <p className="mt-2 text-sm text-ink-muted">Try one of these common operational searches:</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {SEARCH_EXAMPLES.map((example) => (
          <Link
            key={example}
            href={`/search?q=${encodeURIComponent(example)}`}
            className="rounded-full border border-blue-200 bg-sky-soft px-3 py-1.5 text-xs font-semibold text-sky transition-colors hover:border-accent hover:text-accent"
          >
            {example}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "orange" | "blue" | "neutral";
}) {
  const tones = {
    orange: "bg-orange-50 text-accent border-orange-200",
    blue: "bg-sky-soft text-sky border-blue-200",
    neutral: "bg-slate-50 text-ink-muted border-border",
  };
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function pageLabel(start?: number | null, end?: number | null) {
  if (!start && !end) return "";
  if (start && end && start !== end) return `Pages ${start}-${end}`;
  return `Page ${start ?? end}`;
}
