"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MIN_SEARCH_QUERY_LENGTH,
  isReferenceCard,
  plainSnippet,
  readableJsonItems,
} from "@/lib/search";
import { getWorkflowAvailability } from "@/lib/decision-engine/availability";
import type { UnifiedSearchResult } from "@/lib/types";

const RECENT_KEY = "goto.palette.recent.v1";
const MAX_RECENT = 6;
const SUGGESTIONS = ["MCT", "EXST", "WCHR", "FDIS", "Dubai Stopover", "Name Correction"];

type PaletteItem = {
  key: string;
  group: "Guided decisions" | "Operational cards" | "Source chapters";
  title: string;
  href: string;
  badge: string | null;
  meta: string | null;
  explanation: string;
  snippet: string;
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActiveIndex(0);
  }, []);

  const openPalette = useCallback(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
      if (Array.isArray(stored)) setRecent(stored.filter((item) => typeof item === "string"));
    } catch {
      // localStorage unavailable; recent searches simply stay empty
    }
    setOpen(true);
  }, []);

  const rememberQuery = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    try {
      const stored = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
      const list = (Array.isArray(stored) ? stored : []).filter(
        (item: unknown): item is string => typeof item === "string" && item !== trimmed
      );
      window.localStorage.setItem(
        RECENT_KEY,
        JSON.stringify([trimmed, ...list].slice(0, MAX_RECENT))
      );
    } catch {
      // non-fatal
    }
  }, []);

  // Global hotkeys: Ctrl/Cmd+K anywhere; "/" outside inputs.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette();
        return;
      }
      if (event.key === "/" && !inField) {
        event.preventDefault();
        openPalette();
      }
    }

    function onOpenEvent() {
      openPalette();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("goto:open-palette", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("goto:open-palette", onOpenEvent);
    };
  }, [openPalette]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Debounced search against the existing API; never shows unpublished cards
  // because the API already enforces approved+published visibility.
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < MIN_SEARCH_QUERY_LENGTH) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const json = (await res.json()) as { results?: UnifiedSearchResult[] };
        setResults(json.results ?? []);
        setActiveIndex(0);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 140);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  const items = useMemo(() => buildItems(results, query), [results, query]);

  const navigate = useCallback(
    (item: PaletteItem) => {
      rememberQuery(query);
      close();
      router.push(item.href);
    },
    [close, query, rememberQuery, router]
  );

  // Keyboard navigation within the palette.
  const onInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, items.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const item = items[activeIndex];
        if (item) {
          navigate(item);
        } else if (query.trim().length >= MIN_SEARCH_QUERY_LENGTH) {
          rememberQuery(query);
          close();
          router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        }
      }
    },
    [activeIndex, close, items, navigate, query, rememberQuery, router]
  );

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const trimmed = query.trim();
  const showEmptyHints = trimmed.length < MIN_SEARCH_QUERY_LENGTH;
  let renderedGroup: string | null = null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center bg-navy/30 px-4 pt-[12vh] backdrop-blur-sm"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      role="presentation"
    >
      <div
        className="reveal w-full max-w-xl overflow-hidden rounded-xl border border-border bg-white shadow-[var(--shadow-lg)]"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <svg className="h-4.5 w-4.5 shrink-0 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls="palette-results"
            aria-label="Search services, SSR codes, processes"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              if (value.trim().length < MIN_SEARCH_QUERY_LENGTH) {
                setResults([]);
                setLoading(false);
                setActiveIndex(0);
              }
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search services, SSR codes, passenger issues..."
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
          />
          <kbd className="shrink-0 rounded border border-border bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-faint">
            esc
          </kbd>
        </div>

        <div ref={listRef} id="palette-results" role="listbox" className="max-h-[52vh] overflow-y-auto p-2">
          {showEmptyHints ? (
            <div className="px-2 py-2">
              <button
                type="button"
                onClick={() => {
                  close();
                  router.push("/decision");
                }}
                className="mb-3 flex w-full items-center justify-between gap-3 rounded-md border border-sky/40 bg-sky-soft px-3 py-2 text-left transition-colors hover:border-sky"
              >
                <span className="text-sm font-semibold text-sky">Open Decision Assistant</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-sky/80">
                  Guided
                </span>
              </button>
              {recent.length > 0 && (
                <>
                  <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                    Recent
                  </p>
                  <div className="mb-3 grid gap-1">
                    {recent.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => setQuery(term)}
                        className="rounded-md px-2.5 py-1.5 text-left text-sm font-medium text-ink transition-colors hover:bg-sky-soft"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                Try
              </p>
              <div className="flex flex-wrap gap-1.5 px-1">
                {SUGGESTIONS.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setQuery(term)}
                    className="rounded border border-border bg-white px-2.5 py-1 text-xs font-semibold text-sky transition-colors hover:border-accent hover:text-accent"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          ) : loading && items.length === 0 ? (
            <div className="space-y-2 p-2">
              <div className="skeleton h-12" />
              <div className="skeleton h-12" />
              <div className="skeleton h-12" />
            </div>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-muted">
              No matches. Try an SSR code, service name, or passenger issue.
            </p>
          ) : (
            items.map((item, index) => {
              const groupHeading = item.group !== renderedGroup ? item.group : null;
              renderedGroup = item.group;
              return (
                <div key={item.key}>
                  {groupHeading && (
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                      {groupHeading}
                    </p>
                  )}
                  <button
                    type="button"
                    data-index={index}
                    role="option"
                    aria-selected={index === activeIndex}
                    onClick={() => navigate(item)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                      index === activeIndex ? "bg-sky-soft" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        {item.badge && (
                          <span className="shrink-0 rounded-sm border border-orange-200 bg-orange-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent">
                            {item.badge}
                          </span>
                        )}
                        <span className="truncate text-sm font-semibold text-ink">
                          <Highlighted text={item.title} query={trimmed} />
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                        {item.explanation}
                      </span>
                    </span>
                    {(item.snippet || item.meta) && (
                      <span className="mt-0.5 block truncate text-xs text-ink-muted">
                        {item.meta ? `${item.meta} · ` : ""}
                        {item.snippet}
                      </span>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border bg-slate-50/70 px-4 py-2 text-[11px] font-medium text-ink-faint">
          <span>
            <kbd className="font-mono">↑↓</kbd> navigate · <kbd className="font-mono">↵</kbd> open ·{" "}
            <kbd className="font-mono">esc</kbd> close
          </span>
          {trimmed.length >= MIN_SEARCH_QUERY_LENGTH && (
            <button
              type="button"
              onClick={() => {
                rememberQuery(query);
                close();
                router.push(`/search?q=${encodeURIComponent(trimmed)}`);
              }}
              className="font-semibold text-sky transition-colors hover:text-accent"
            >
              Full results &rarr;
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function buildItems(results: UnifiedSearchResult[], query: string): PaletteItem[] {
  const guided: PaletteItem[] = [];
  const cards: PaletteItem[] = [];
  const chapters: PaletteItem[] = [];

  for (const result of results.slice(0, 12)) {
    if (result.type === "operational_card") {
      const channels = readableJsonItems(result.channels).slice(0, 2).join(", ");
      cards.push({
        key: `card-${result.id}`,
        group: "Operational cards",
        title: result.title,
        href: `/procedure/${result.slug}`,
        badge: result.service_code,
        meta: result.service_type || result.category,
        explanation: explainCardMatch(result, query),
        snippet: channels || plainSnippet(result.snippet).slice(0, 90),
      });
      // Direct entry for available guided workflows (search already returns
      // only approved+published cards; availability then needs a matching tree).
      const availability = getWorkflowAvailability({
        slug: result.slug,
        is_published: true,
        review_status: "approved",
        source_version: result.source_version,
      });
      if (availability.available) {
        guided.push({
          key: `guided-${result.id}`,
          group: "Guided decisions",
          title: result.title,
          href: availability.href,
          badge: result.service_code,
          meta: "Deterministic",
          explanation: "Guided",
          snippet: "Answer verified questions to reach the outcome",
        });
      }
    } else {
      chapters.push({
        key: `chapter-${result.id}`,
        group: "Source chapters",
        title: result.title,
        href: `/chapter/${result.slug}`,
        badge: `Ch. ${String(result.chapter_number ?? "-").padStart(2, "0")}`,
        meta: null,
        explanation: "Source manual",
        snippet: plainSnippet(result.snippet).slice(0, 90),
      });
    }
  }

  return [...guided.slice(0, 4), ...cards.slice(0, 6), ...chapters.slice(0, 5)];
}

function explainCardMatch(
  result: Extract<UnifiedSearchResult, { type: "operational_card" }>,
  query: string
) {
  const compact = query.trim().replace(/\s+/g, "").toUpperCase();
  if (result.service_code && result.service_code.toUpperCase() === compact) return "Exact code";
  if (result.title.toLowerCase().includes(query.trim().toLowerCase())) return "Title match";
  if (isReferenceCard(result)) return "Reference";
  return "Operational match";
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const tokens = query.toLowerCase().split(/\s+/).filter((token) => token.length >= 2);
  if (tokens.length === 0) return <>{text}</>;

  const pattern = new RegExp(
    `(${tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "ig"
  );
  const parts = text.split(pattern);
  const matcher = new RegExp(pattern.source, "i");

  return (
    <>
      {parts.map((part, index) =>
        matcher.test(part) ? (
          <mark key={`${part}-${index}`} className="rounded-sm bg-amber-soft px-0.5 text-ink">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  );
}
