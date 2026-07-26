import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { AgentPage } from "@/components/agent/AgentPage";
import { OperationalAnswer } from "@/components/agent/OperationalAnswer";
import { RelatedProcedureRow, MoreResults, type RelatedItem } from "@/components/agent/RelatedProcedures";
import { SourceReferences, type SourceRef } from "@/components/agent/SourceReferences";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  buildSearchTerms,
  MIN_SEARCH_QUERY_LENGTH,
  plainSnippet,
  rankSearchResults,
  scoreOperationalCard,
} from "@/lib/search";
import { getWorkflowAvailability } from "@/lib/decision-engine/availability";
import { deriveOperationalAnswer } from "@/lib/operational-answer";
import type { JsonValue, SearchResult } from "@/lib/types";

export const metadata = {
  title: "Search results | GO TO",
  description: "Find the right operational guidance for the customer's request.",
};

// Full operational card fields needed to derive the operational answer. Scoring
// is unchanged; this only widens what we carry through to rendering.
type OperationalRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  service_code: string | null;
  service_type: string | null;
  summary: string | null;
  when_to_use: string | null;
  cut_off_time: string | null;
  channels: JsonValue[] | null;
  who_can_action: JsonValue[] | null;
  required_information: JsonValue[] | null;
  system_steps: JsonValue[] | null;
  passenger_advice: JsonValue[] | null;
  allowed: JsonValue[] | null;
  not_allowed: JsonValue[] | null;
  escalation_points: JsonValue[] | null;
  fees_charges: string | null;
  keywords: string[] | null;
  aliases: string[] | null;
  source_version: string | null;
};

const EXAMPLE_SEARCHES = [
  "passenger has a plaster cast",
  "wrong name on the booking",
  "customer missed the flight",
  "passenger needs oxygen",
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const { operational, sources } =
    query.length >= MIN_SEARCH_QUERY_LENGTH
      ? await runSearch(query)
      : { operational: [] as OperationalRow[], sources: [] as SourceRef[] };

  // Derive compact answers + guided availability for every operational result.
  const derived = operational.map((card) => {
    const availability = getWorkflowAvailability({
      slug: card.slug,
      is_published: true,
      review_status: "approved",
      source_version: card.source_version,
    });
    return {
      slug: card.slug,
      answer: deriveOperationalAnswer(card),
      guided: { available: availability.available, hasTree: availability.hasTree },
    };
  });

  const best = derived[0] ?? null;
  const relatedItems: RelatedItem[] = derived.slice(1, 4).map(toRelatedItem);
  const moreItems: RelatedItem[] = derived.slice(4).map(toRelatedItem);
  const hasSources = sources.length > 0;

  return (
    <div className="dashboard-shell flex min-h-full flex-col">
      <SiteHeader />
      <AgentPage>
        <Link
          href="/"
          className="agent-secondary touch-target inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold focus-visible:outline-none"
        >
          &larr; Back to Home
        </Link>

        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-ink">
          Search results
        </h1>
        <form action="/search" method="get" role="search" className="mt-3">
          <label htmlFor="search-q" className="sr-only">
            Search the operational guide
          </label>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <input
              id="search-q"
              name="q"
              type="search"
              defaultValue={query}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="search"
              placeholder="Describe the customer's request…"
              aria-label="Search the operational guide"
              className="agent-search-input touch-target min-w-0 flex-1 px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint"
            />
            <button
              type="submit"
              className="agent-primary touch-target inline-flex items-center justify-center rounded-xl px-6 py-3 text-[15px] font-semibold focus-visible:outline-none"
            >
              Search
            </button>
          </div>
        </form>
        <p className="mt-2 text-sm text-ink-muted">
          Showing the most relevant operational guidance first.
        </p>
        <p className="sr-only" role="status" aria-live="polite">
          {query.length >= MIN_SEARCH_QUERY_LENGTH
            ? `${operational.length} operational result${operational.length === 1 ? "" : "s"} for ${query}.`
            : ""}
        </p>

        {query.length < MIN_SEARCH_QUERY_LENGTH ? (
          <StartState />
        ) : best ? (
          <>
            <div className="mt-6">
              <OperationalAnswer
                answer={best.answer}
                slug={best.slug}
                guided={best.guided}
                hasSourceRefs={hasSources}
              />
            </div>

            {relatedItems.length > 0 && (
              <section className="mt-8" aria-label="Related procedures">
                <h2 className="font-display text-base font-semibold text-ink">Related procedures</h2>
                <div className="mt-3 space-y-2.5">
                  {relatedItems.map((item) => (
                    <RelatedProcedureRow key={`rel-${item.slug}`} item={item} />
                  ))}
                </div>
                <MoreResults items={moreItems} />
              </section>
            )}

            <SourceReferences refs={sources} />
          </>
        ) : hasSources ? (
          <NoOperationalMatch query={query} sources={sources} />
        ) : (
          <NoResults />
        )}
      </AgentPage>
    </div>
  );
}

function toRelatedItem(entry: {
  slug: string;
  answer: ReturnType<typeof deriveOperationalAnswer>;
  guided: { available: boolean; hasTree: boolean };
}): RelatedItem {
  return {
    slug: entry.slug,
    title: entry.answer.title,
    summary: entry.answer.summary,
    deadline: entry.answer.deadline,
    criticalBlocker: entry.answer.criticalBlocker,
    guidedAvailable: entry.guided.available,
  };
}

async function runSearch(
  query: string
): Promise<{ operational: OperationalRow[]; sources: SourceRef[] }> {
  const supabase = await createServerSupabaseClient();
  const terms = buildSearchTerms(query);
  if (!terms) return { operational: [], sources: [] };

  // Operational cards — same published+approved filter, same scoreOperationalCard
  // ranking, same threshold and cap as the existing search. Only the returned
  // shape is widened so the operational answer can be derived.
  const { data: cardData } = await supabase
    .from("procedure_cards")
    .select(
      [
        "id", "title", "slug", "category", "service_code", "service_type",
        "summary", "when_to_use", "cut_off_time", "channels", "who_can_action",
        "required_information", "system_steps", "passenger_advice", "allowed",
        "not_allowed", "escalation_points", "fees_charges", "keywords", "aliases",
        "source_version",
      ].join(", ")
    )
    .eq("is_published", true)
    .eq("review_status", "approved")
    .limit(100);

  const operational = ((cardData ?? []) as unknown as OperationalRow[])
    .map((card) => ({ card, score: scoreOperationalCard(card, query) }))
    .filter(({ score }) => score >= 2500)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ card }) => card);

  // Source/manual chapters — unchanged ranking; mapped to plain reference rows.
  const { data: chapterHits, error } = await supabase.rpc("search_chapters", { query: terms });
  if (error || !chapterHits) return { operational, sources: [] };

  const results = chapterHits as SearchResult[];
  const ids = results.map((r) => r.id).filter(Boolean);
  if (ids.length === 0) return { operational, sources: [] };

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, page_start, page_end, search_keywords, source_version, body_text")
    .in("id", ids);
  const metadata = new Map(
    (chapters ?? []).map((c) => [
      c.id,
      { page_start: c.page_start, page_end: c.page_end, search_keywords: c.search_keywords, source_version: c.source_version, body_text: c.body_text },
    ])
  );

  const sources: SourceRef[] = rankSearchResults(
    results.map((r) => ({ ...r, ...metadata.get(r.id) })),
    query
  )
    .slice(0, 6)
    .map((r) => ({
      slug: r.slug,
      title: r.title,
      excerpt: plainSnippet(r.snippet).slice(0, 200),
      page: pageLabel(r.page_start, r.page_end),
    }));

  return { operational, sources };
}

function pageLabel(start?: number | null, end?: number | null): string | null {
  if (!start && !end) return null;
  if (start && end && start !== end) return `Pages ${start}–${end}`;
  return `Page ${start ?? end}`;
}

function StartState() {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-border bg-white/60 px-6 py-10 text-center">
      <p className="font-display text-base font-semibold text-ink">
        Describe what the customer is asking about
      </p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-ink-muted">
        Type at least two characters. For example:
      </p>
      <ExampleLinks />
    </div>
  );
}

function NoOperationalMatch({ query, sources }: { query: string; sources: SourceRef[] }) {
  return (
    <>
      <div className="mt-6 rounded-2xl border border-border bg-white p-6">
        <h2 className="font-display text-lg font-semibold text-ink">
          No reviewed operational answer was found
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-ink-muted">
          You can review the related source material below or try a more specific description.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link
            href="/decision"
            className="agent-primary touch-target inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold focus-visible:outline-none"
          >
            Start guided decision
          </Link>
          <a
            href="#source-references"
            className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
          >
            View source references
          </a>
        </div>
      </div>
      <SourceReferences refs={sources} />
      <p className="sr-only">No operational procedure matched {query}.</p>
    </>
  );
}

function NoResults() {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-white p-6">
      <h2 className="font-display text-lg font-semibold text-ink">
        We couldn&rsquo;t find a matching procedure
      </h2>
      <ul className="mt-2 space-y-1.5 text-sm leading-6 text-ink-muted">
        <li>Describe the customer&rsquo;s request in different words.</li>
        <li>Search using a service name.</li>
        <li>Try a known code if you have one.</li>
        <li>Or start a guided decision.</li>
      </ul>
      <div className="mt-4">
        <Link
          href="/decision"
          className="agent-primary touch-target inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold focus-visible:outline-none"
        >
          Start guided decision
        </Link>
      </div>
      <ExampleLinks />
    </div>
  );
}

function ExampleLinks() {
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {EXAMPLE_SEARCHES.map((example) => (
        <Link
          key={example}
          href={`/search?q=${encodeURIComponent(example)}`}
          className="agent-tile touch-target inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold text-ink focus-visible:outline-none"
        >
          {example}
        </Link>
      ))}
    </div>
  );
}
