"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { SEARCH_EXAMPLES } from "@/lib/operational-content";
import {
  containsArabic,
  isReferenceCard,
  MAX_SEARCH_QUERY_LENGTH,
  MIN_SEARCH_QUERY_LENGTH,
  plainSnippet,
  readableJsonItems,
  compactTimingPreview,
  timingLabelForCard,
} from "@/lib/search";
import type { ChapterSearchResult, OperationalCardSearchResult, UnifiedSearchResult } from "@/lib/types";

type ResultKind = "All" | "Steps" | "Rules" | "Images";

export function SearchBar({
  autoFocus = false,
  defaultValue = "",
}: {
  autoFocus?: boolean;
  defaultValue?: string;
}) {
  const [query, setQuery] = useState(defaultValue);
  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [kind, setKind] = useState<ResultKind>("All");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_SEARCH_QUERY_LENGTH) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const json = (await res.json()) as { results?: UnifiedSearchResult[] };
        setResults(json.results ?? []);
        setOpen(true);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setOpen(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 160);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const filteredResults = results.filter((result) => {
    if (kind === "All") return true;
    if (result.type === "operational_card") return kind !== "Images";
    return resultKind(result) === kind;
  });
  const visibleResults = filteredResults.slice(0, 5);
  const isArabicNoResult = containsArabic(query) && !loading && filteredResults.length === 0;
  const trimmedQuery = query.trim();
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmedQuery) return;
    window.location.href = `/search?q=${encodeURIComponent(trimmedQuery)}`;
  };

  return (
    <div ref={wrapRef} className="relative z-50">
      <form className="relative" autoComplete="off" onSubmit={submitSearch}>
        <svg
          className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z"
          />
        </svg>
        <input
          name="goto_operational_lookup"
          type="text"
          aria-label="Search GO TO guide"
          autoComplete="new-password"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={MAX_SEARCH_QUERY_LENGTH}
          onFocus={() => query.trim().length >= MIN_SEARCH_QUERY_LENGTH && setOpen(true)}
          placeholder="Search by issue, SSR, process, keyword..."
          className="w-full rounded-lg border border-border bg-white py-3.5 pl-12 pr-24 font-body text-[15px] text-ink transition-colors placeholder:text-ink-faint focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/15"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent"
        >
          Search
        </button>
      </form>

      {open && query.trim().length >= MIN_SEARCH_QUERY_LENGTH && (
        <div className="absolute left-0 right-0 top-full z-[90] mt-3 max-h-[min(32rem,calc(100vh-8rem))] w-full overflow-y-auto rounded-2xl border border-blue-100 bg-white p-2 shadow-2xl shadow-slate-900/20 ring-1 ring-sky/10">
          <div className="sticky top-0 z-10 rounded-xl border border-border bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
            <div className="flex gap-1 overflow-x-auto">
              {(["All", "Steps", "Rules", "Images"] as ResultKind[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setKind(option)}
                  className={`min-w-max rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    kind === option
                      ? "bg-ink text-white"
                      : "bg-sky-soft text-ink-muted hover:text-sky"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          {loading && (
            <div className="space-y-2 px-2 py-3">
              <div className="h-4 w-1/3 animate-pulse rounded bg-sky-soft" />
              <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            </div>
          )}
          {!loading && filteredResults.length === 0 && (
            <div className="m-2 rounded-xl border border-border bg-slate-50 px-4 py-4">
              <p className="text-sm font-semibold text-ink">
                {isArabicNoResult ? "Try SSR code or English keyword" : "Try an operational shortcut"}
              </p>
              <p className="mt-1 text-xs leading-5 text-ink-muted">
                {isArabicNoResult
                  ? "Search works best with English service names or SSR codes."
                  : "Search by SSR code, process name, passenger issue, or internal shorthand."}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(isArabicNoResult ? ["EXST", "CBBG", "MCT", "SPEQ", "FDIS", "WCHR"] : SEARCH_EXAMPLES.slice(0, 10)).map((example) => (
                  <Link
                    key={example}
                    href={`/search?q=${encodeURIComponent(example)}`}
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-blue-200 bg-sky-soft px-2.5 py-1 text-[11px] font-semibold text-sky hover:border-accent hover:text-accent"
                  >
                    {example}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {!loading &&
            visibleResults.map((result) => (
              result.type === "operational_card" ? (
                <OperationalDropdownItem
                  key={`card-${result.id}`}
                  result={result}
                  onOpen={() => setOpen(false)}
                />
              ) : (
                <ChapterDropdownItem
                  key={`chapter-${result.id}`}
                  result={result}
                  onOpen={() => setOpen(false)}
                />
              )
            ))}
          {!loading && filteredResults.length > 0 && (
            <Link
              href={`/search?q=${encodeURIComponent(trimmedQuery)}`}
              onClick={() => setOpen(false)}
              className="sticky bottom-0 mt-2 block rounded-xl border border-blue-100 bg-white px-4 py-3 text-center text-xs font-bold text-sky shadow-sm hover:text-accent"
            >
              View all results for &quot;{trimmedQuery}&quot;
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function OperationalDropdownItem({
  result,
  onOpen,
}: {
  result: OperationalCardSearchResult;
  onOpen: () => void;
}) {
  const timingLabel = timingLabelForCard(result);
  const openLabel = isReferenceCard(result) ? "Open card" : "Open service";
  const channels = readableJsonItems(result.channels).slice(0, 2);
  const timingLines = result.cut_off_time ? compactTimingPreview(result.cut_off_time, result, 1) : [];

  return (
    <Link
      href={`/procedure/${result.slug}`}
      onClick={onOpen}
      className="my-2 block rounded-xl border border-border bg-white px-3 py-3 shadow-sm transition-colors hover:border-sky hover:bg-panel-hover focus:border-sky focus:bg-panel-hover"
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="blue">Operational Card</Badge>
        {result.service_code ? <Badge tone="orange">{result.service_code}</Badge> : null}
        <Badge tone="neutral">{result.service_type || result.category}</Badge>
      </div>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <span className="min-w-0 font-display text-sm font-semibold leading-5 text-ink">
          {result.title}
        </span>
        <span className="shrink-0 rounded-full bg-orange-50 px-2 py-1 text-[11px] font-semibold text-accent">
          {openLabel}
        </span>
      </div>
      {result.cut_off_time ? (
        <div className="mt-2 rounded-lg border border-orange-100 bg-orange-50 px-2.5 py-1.5">
          <p className="line-clamp-1 text-xs font-semibold leading-5 text-ink">
            <span className="text-accent">{timingLabel}:</span>{" "}
            {timingLines[0] ?? plainSnippet(result.cut_off_time)}
          </p>
          {isReferenceCard(result) ? (
            <p className="mt-0.5 text-[11px] font-semibold text-orange-700">
              Open card for full rule
            </p>
          ) : null}
        </div>
      ) : null}
      {plainSnippet(result.snippet) ? (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">
          {plainSnippet(result.snippet)}
        </p>
      ) : null}
      {channels.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {channels.map((channel) => (
            <span
              key={channel}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-ink-muted"
            >
              {channel}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

function ChapterDropdownItem({
  result,
  onOpen,
}: {
  result: ChapterSearchResult;
  onOpen: () => void;
}) {
  return (
    <Link
      href={`/chapter/${result.slug}?section=${sectionForResult(result)}`}
      onClick={onOpen}
      className="my-2 block rounded-xl border border-border bg-white px-3 py-3 shadow-sm transition-colors hover:border-sky hover:bg-panel-hover focus:border-sky focus:bg-panel-hover"
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="orange">Ch. {formatChapterNumber(result.chapter_number)}</Badge>
        <Badge tone="blue">Chapter</Badge>
        <Badge tone="neutral">{resultKind(result)}</Badge>
        {sourceMeta(result) ? <Badge tone="neutral">{sourceMeta(result)}</Badge> : null}
      </div>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <span className="min-w-0 font-display text-sm font-semibold leading-5 text-ink">
          {result.title}
        </span>
        <span className="shrink-0 rounded-full bg-orange-50 px-2 py-1 text-[11px] font-semibold text-accent">
          Open chapter
        </span>
      </div>
      {plainSnippet(result.snippet) ? (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">
          {plainSnippet(result.snippet)}
        </p>
      ) : null}
      {result.search_keywords?.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {result.search_keywords.slice(0, 4).map((keyword) => (
            <span
              key={keyword}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-ink-muted"
            >
              {keyword}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

function resultKind(result: ChapterSearchResult): ResultKind {
  const text = `${result.title} ${stripHtml(result.snippet)}`.toLowerCase();
  if (/\b(image|screenshot|screen|photo|picture)\b/.test(text)) return "Images";
  if (/\b(must|cannot|not allowed|only|eligible|valid|restriction|condition|exception|required|applicable)\b/.test(text)) {
    return "Rules";
  }
  return "Steps";
}

function sectionForResult(result: ChapterSearchResult) {
  const kind = resultKind(result);
  if (kind === "Images") return "images";
  if (kind === "Rules") return "rules";
  return "steps";
}

function stripHtml(value?: string | null) {
  return plainSnippet(value);
}

function formatChapterNumber(value?: number | null) {
  return String(value ?? "-").padStart(2, "0");
}

function sourceMeta(result: ChapterSearchResult) {
  const pages = pageLabel(result.page_start, result.page_end);
  if (pages && result.source_version) return `${result.source_version} - ${pages}`;
  return result.source_version ?? pages;
}

function pageLabel(start?: number | null, end?: number | null) {
  if (!start && !end) return "";
  if (start && end && start !== end) return `pp. ${start}-${end}`;
  return `p. ${start ?? end}`;
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
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
