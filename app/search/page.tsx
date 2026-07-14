import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SearchBar } from "@/components/SearchBar";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  buildSearchTerms,
  compactTimingPreview,
  containsArabic,
  detectFieldQuery,
  fieldQueryMessage,
  isReferenceCard,
  MIN_SEARCH_QUERY_LENGTH,
  operationalCardPreview,
  plainSnippet,
  rankSearchResults,
  readableJsonItems,
  scoreOperationalCard,
  timingLabelForCard,
} from "@/lib/search";
import type { ChapterSearchResult, OperationalCardSearchResult, SearchResult, UnifiedSearchResult } from "@/lib/types";

type ProcedureSearchRow = Parameters<typeof scoreOperationalCard>[0] & {
  id: string;
  title: string;
  slug: string;
  category: string;
  channels: OperationalCardSearchResult["channels"] | null;
  passenger_advice: OperationalCardSearchResult["passenger_advice"] | null;
  system_steps: OperationalCardSearchResult["system_steps"] | null;
  required_approval: string | null;
  source_pages: number[] | null;
  source_version: string | null;
  summary: string | null;
};

type InstantAnswerSection = {
  label: string;
  text?: string;
  items?: string[];
};

type InstantAnswerData = {
  title: string;
  slug: string;
  service_code: string | null;
  service_type: string | null;
  category: string;
  source_version: string | null;
  source_pages: number[];
  sections: InstantAnswerSection[];
};
const EMPTY_SUGGESTIONS = ["MCT", "EXST", "CBBG", "SPEQ", "Falcon", "OLCI Lounge", "FDIS", "WCHR"];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const { results, answer } =
    query.length >= MIN_SEARCH_QUERY_LENGTH
      ? await search(query)
      : { results: [], answer: null };
  const fieldMessage = fieldQueryMessage(detectFieldQuery(query));

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      <main id="main" className="reveal mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
        <Link
          href="/"
          className="mb-5 inline-flex items-center gap-2 rounded border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent"
        >
          &larr; Back to chapters
        </Link>

        <section className="content-card mb-5 border-t-2 border-t-navy p-5">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            Operational search
          </p>
          <h1 className="mb-2 font-display text-2xl font-semibold tracking-tight text-ink">
            {query ? `Results for "${query}"` : "Search the GO TO guide"}
          </h1>
          <p className="mb-4 max-w-2xl text-sm leading-6 text-ink-muted">
            Search by passenger issue, SSR code, process name, system keyword, or operational shorthand.
          </p>
          <SearchBar defaultValue={query} />
        </section>

        {answer ? <InstantAnswerPanel answer={answer} /> : null}

        {fieldMessage && results.length > 0 ? (
          <p className="mb-4 rounded-md border border-blue-200 bg-sky-soft px-4 py-2.5 text-sm font-semibold text-sky">
            {fieldMessage}
          </p>
        ) : null}

        {query.length < MIN_SEARCH_QUERY_LENGTH ? (
          <EmptyState message="Type at least two characters to search by issue, SSR, process, or keyword." />
        ) : results.length === 0 ? (
          <EmptyState
            message={
              containsArabic(query)
                ? "Search works best with English service names or SSR codes. Try EXST, CBBG, MCT, SPEQ, FDIS, WCHR."
                : "No matching results found. Try a shorter keyword, process name, or SSR code."
            }
          />
        ) : (
          <div className="space-y-3">
            {results.map((result) => (
              result.type === "operational_card" ? (
                <OperationalCardResult key={`card-${result.id}`} result={result} query={query} />
              ) : (
                <SearchResultCard key={`chapter-${result.id}`} result={result} />
              )
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

async function search(
  query: string
): Promise<{ results: UnifiedSearchResult[]; answer: InstantAnswerData | null }> {
  const supabase = await createServerSupabaseClient();
  const terms = buildSearchTerms(query);

  if (!terms) return { results: [], answer: null };

  const { results: cardResults, answer } = await searchOperationalCards(supabase, query);
  const { data, error } = await supabase.rpc("search_chapters", {
    query: terms,
  });

  if (error || !data) return { results: cardResults, answer };

  const results = data as SearchResult[];
  const ids = results.map((result) => result.id).filter(Boolean);
  if (ids.length === 0) return { results: cardResults, answer };

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, page_start, page_end, search_keywords, source_version, body_text")
    .in("id", ids);

  const metadata = new Map(
    (chapters ?? []).map((chapter) => [
      chapter.id,
      {
        page_start: chapter.page_start,
        page_end: chapter.page_end,
        search_keywords: chapter.search_keywords,
        source_version: chapter.source_version,
        body_text: chapter.body_text,
      },
    ])
  );

  const chapterResults = rankSearchResults(
    results.map((result) => ({ ...result, ...metadata.get(result.id) })),
    query
  ).map((result) => {
    const chapter = { ...result, type: "chapter" as const };
    delete chapter.body_text;
    return chapter;
  });

  return { results: [...cardResults, ...chapterResults].slice(0, 24), answer };
}

async function searchOperationalCards(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  query: string
): Promise<{ results: OperationalCardSearchResult[]; answer: InstantAnswerData | null }> {
  const { data } = await supabase
    .from("procedure_cards")
    .select(
      [
        "id",
        "title",
        "slug",
        "category",
        "service_code",
        "service_type",
        "cut_off_time",
        "channels",
        "who_can_action",
        "required_information",
        "system_steps",
        "passenger_advice",
        "allowed",
        "not_allowed",
        "escalation_points",
        "fees_charges",
        "required_approval",
        "keywords",
        "aliases",
        "summary",
        "when_to_use",
        "source_pages",
        "source_version",
        "priority",
      ].join(", ")
    )
    .eq("is_published", true)
    .eq("review_status", "approved")
    .limit(100);

  const scored = ((data ?? []) as unknown as ProcedureSearchRow[])
    .map((card) => ({ card, score: scoreOperationalCard(card, query) }))
    .filter(({ score }) => score >= 2500)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const answer = scored.length > 0 ? buildInstantAnswer(scored[0].card, query) : null;

  const results = scored.map(({ card, score }) => ({
      type: "operational_card" as const,
      id: card.id,
      title: card.title,
      slug: card.slug,
      rank: score,
      service_code: card.service_code ?? null,
      service_type: card.service_type ?? null,
      category: card.category,
      cut_off_time: card.cut_off_time ?? null,
      channels: card.channels ?? [],
      passenger_advice: card.passenger_advice ?? [],
      system_steps: card.system_steps ?? [],
      source_pages: card.source_pages ?? [],
      source_version: card.source_version ?? null,
      summary: card.summary ?? null,
      snippet: operationalCardPreview(card),
    }));

  return { results, answer };
}

// Instant answer: shows the exact card field the agent asked about, or a
// compact decision summary for exact service-code queries. Values are taken
// verbatim from approved+published card fields; sections with no data are
// omitted entirely.
function buildInstantAnswer(card: ProcedureSearchRow, query: string): InstantAnswerData | null {
  const fieldKind = detectFieldQuery(query);
  const compactQuery = query.trim().replace(/\s+/g, "").toUpperCase();
  const isExactCode = Boolean(card.service_code && card.service_code.toUpperCase() === compactQuery);

  if (!fieldKind && !isExactCode) return null;

  const sections: InstantAnswerSection[] = [];
  const timingLabel = timingLabelForCard(card);
  const channels = readableJsonItems(card.channels);
  const whoCanAction = readableJsonItems(card.who_can_action);

  if (fieldKind === "cut_off" && card.cut_off_time?.trim()) {
    sections.push({ label: timingLabel, text: card.cut_off_time.trim() });
  } else if (fieldKind === "restrictions") {
    const items = readableJsonItems(card.not_allowed);
    if (items.length) sections.push({ label: "Restrictions / not allowed", items });
  } else if (fieldKind === "passenger_advice") {
    const items = readableJsonItems(card.passenger_advice);
    if (items.length) sections.push({ label: "Passenger advice", items });
  } else if (fieldKind === "who_can_action") {
    if (whoCanAction.length) sections.push({ label: "Who can action", items: whoCanAction });
  } else if (fieldKind === "channel") {
    if (channels.length) sections.push({ label: "Channels", items: channels });
  } else if (fieldKind === "approval" && card.required_approval?.trim()) {
    sections.push({ label: "Required approval", text: card.required_approval.trim() });
  } else if (isExactCode) {
    if (card.cut_off_time?.trim()) sections.push({ label: timingLabel, text: card.cut_off_time.trim() });
    if (whoCanAction.length) sections.push({ label: "Who can action", items: whoCanAction.slice(0, 4) });
    if (channels.length) sections.push({ label: "Channels", items: channels.slice(0, 4) });
  }

  if (sections.length === 0) return null;

  return {
    title: card.title,
    slug: card.slug,
    service_code: card.service_code ?? null,
    service_type: card.service_type ?? null,
    category: card.category,
    source_version: card.source_version ?? null,
    source_pages: card.source_pages ?? [],
    sections,
  };
}

function InstantAnswerPanel({ answer }: { answer: InstantAnswerData }) {
  const pages = sourcePagesLabel(answer.source_pages);

  return (
    <section className="content-card mb-5 border-t-2 border-t-accent p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            Instant answer
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {answer.service_code && (
              <span className="rounded-sm border border-orange-200 bg-orange-50 px-2 py-0.5 font-mono text-xs font-bold text-accent">
                {answer.service_code}
              </span>
            )}
            <h2 className="font-display text-lg font-semibold leading-snug text-ink">
              {answer.title}
            </h2>
          </div>
        </div>
        <Link
          href={`/procedure/${answer.slug}`}
          className="inline-flex shrink-0 items-center justify-center rounded bg-navy px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent"
        >
          Open full card
        </Link>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {answer.sections.map((section) => (
          <div
            key={section.label}
            className="rounded-md border border-border bg-slate-50/60 px-3.5 py-3"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-sky">
              {section.label}
            </p>
            {section.text ? (
              <p className="mt-1.5 whitespace-pre-line text-sm font-semibold leading-6 text-ink">
                {section.text}
              </p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {(section.items ?? []).map((item) => (
                  <li key={item} className="flex gap-2 text-sm font-medium leading-5 text-ink">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {(answer.source_version || pages) && (
        <p className="mt-3 text-[11px] font-medium text-ink-faint">
          Source: {[answer.source_version, pages].filter(Boolean).join(" · ")} — always verify on the full card.
        </p>
      )}
    </section>
  );
}

function OperationalCardResult({ result, query }: { result: OperationalCardSearchResult; query: string }) {
  const channels = readableJsonItems(result.channels).slice(0, 3);
  const pages = sourcePagesLabel(result.source_pages);
  const timingLabel = timingLabelForCard(result);
  const openLabel = isReferenceCard(result) ? "Open card" : "Open service";
  const timingLines = result.cut_off_time ? compactTimingPreview(result.cut_off_time, result, 2) : [];
  const matchLabel = operationalMatchLabel(result, query);

  return (
    <article className="content-card hover-lift p-4 hover:border-accent">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="blue">Operational Card</Badge>
            <Badge tone="neutral">{matchLabel}</Badge>
            {result.service_code ? <Badge tone="orange">{result.service_code}</Badge> : null}
            <Badge tone="neutral">{result.service_type || result.category}</Badge>
            {pages ? <Badge tone="neutral">{pages}</Badge> : null}
            {result.source_version ? <Badge tone="neutral">{result.source_version}</Badge> : null}
          </div>
          <h2 className="font-display text-lg font-semibold leading-snug text-ink">
            {result.title}
          </h2>
          {result.cut_off_time ? (
            <div className="mt-3 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-ink">
              <p className="text-accent">{timingLabel}:</p>
              <ul className="mt-1 space-y-1">
                {timingLines.map((line) => (
                  <li key={line} className="text-xs leading-5 text-ink">
                    {line}
                  </li>
                ))}
              </ul>
              {isReferenceCard(result) ? (
                <p className="mt-2 text-[11px] font-semibold text-accent">Open card for full rule</p>
              ) : null}
            </div>
          ) : null}
          {result.snippet ? (
            <p className="mt-3 max-w-4xl text-sm leading-6 text-ink-muted">{result.snippet}</p>
          ) : null}
          {channels.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {channels.map((channel) => (
                <span
                  key={channel}
                  className="rounded-sm border border-blue-200 bg-sky-soft px-2 py-0.5 text-[11px] font-semibold text-sky"
                >
                  {channel}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <Link
          href={`/procedure/${result.slug}`}
          className="inline-flex shrink-0 items-center justify-center rounded bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-dim"
        >
          {openLabel}
        </Link>
      </div>
    </article>
  );
}

function SearchResultCard({ result }: { result: ChapterSearchResult }) {
  const snippet = plainSnippet(result.snippet);
  const pages = pageLabel(result.page_start, result.page_end);

  return (
    <article className="content-card quick-card hover-lift p-4 hover:border-accent">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="blue">Chapter</Badge>
            <Badge tone="neutral">Source chapter</Badge>
            <Badge tone="orange">Ch. {String(result.chapter_number).padStart(2, "0")}</Badge>
            {pages ? <Badge tone="neutral">{pages}</Badge> : null}
            {result.source_version ? <Badge tone="neutral">{result.source_version}</Badge> : null}
          </div>
          <h2 className="font-display text-lg font-semibold leading-snug text-ink">
            {result.title}
          </h2>
          {snippet ? (
            <p className="mt-3 max-w-4xl text-sm leading-6 text-ink-muted">{snippet}</p>
          ) : null}
          {result.search_keywords?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {result.search_keywords.slice(0, 8).map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-sm border border-blue-200 bg-sky-soft px-2 py-0.5 text-[11px] font-semibold text-sky"
                >
                  {keyword}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <Link
          href={`/chapter/${result.slug}`}
          className="inline-flex shrink-0 items-center justify-center rounded bg-navy px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent"
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
        {EMPTY_SUGGESTIONS.map((example) => (
          <Link
            key={example}
            href={`/search?q=${encodeURIComponent(example)}`}
            className="rounded border border-border bg-white px-2.5 py-1 text-xs font-semibold text-sky transition-colors hover:border-accent hover:text-accent"
          >
            {example}
          </Link>
        ))}
      </div>
    </div>
  );
}

function operationalMatchLabel(result: OperationalCardSearchResult, query: string) {
  const normalized = query.trim().toLowerCase();
  if (result.service_code && normalized === result.service_code.toLowerCase()) return "Exact match";
  if (detectFieldQuery(query)) return "Field match";
  return "Operational match";
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
    <span className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

function pageLabel(start?: number | null, end?: number | null) {
  if (!start && !end) return "";
  if (start && end && start !== end) return `Pages ${start}-${end}`;
  return `Page ${start ?? end}`;
}

function sourcePagesLabel(pages: number[]) {
  if (!pages.length) return "";
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  if (sorted.length === 1) return `Page ${sorted[0]}`;
  const contiguous = sorted.every((page, index) => index === 0 || page === sorted[index - 1] + 1);
  return contiguous ? `Pages ${sorted[0]}-${sorted[sorted.length - 1]}` : `Pages ${sorted.join(", ")}`;
}
