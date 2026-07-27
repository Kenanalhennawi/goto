"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

// Primary agent search (UX-R1A; search-ahead UX-R1G). A real GET form that
// submits to /search?q= (reusing the existing route and scoring unchanged),
// enhanced with a lightweight "Likely matches" preview over the existing
// /api/search endpoint. No new endpoint, no ranking change, no AI, and nothing
// typed is persisted. The preview is purely additive: if it fails, the normal
// GET search still works.
const EXAMPLES = [
  "Passenger has a plaster cast and wants to travel",
  "Customer needs oxygen",
  "Wrong name on the booking",
  "Passenger missed the flight",
  "Customer has two identical bookings",
  "Passenger is travelling with a service dog",
];

const MIN_CHARS = 3;
const MAX_SUGGESTIONS = 3;

type Suggestion = { slug: string; title: string; summary: string | null };

export function PrimarySearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [placeholder, setPlaceholder] = useState(EXAMPLES[0]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const indexRef = useRef(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Rotating example (text only; paused for reduced motion).
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      indexRef.current = (indexRef.current + 1) % EXAMPLES.length;
      setPlaceholder(EXAMPLES[indexRef.current]);
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  // Debounced suggestion fetch over the existing API. Published operational
  // cards only; chapter/source results are ignored in the preview.
  useEffect(() => {
    const trimmed = query.trim();
    // Short queries are cleared in the input change handler; nothing to fetch
    // here (and no synchronous state updates inside the effect).
    if (trimmed.length < MIN_CHARS) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const json = (await res.json()) as { results?: { type: string; slug: string; title: string; summary?: string | null }[] };
        const items = (json.results ?? [])
          .filter((r) => r.type === "operational_card")
          .slice(0, MAX_SUGGESTIONS)
          .map((r) => ({ slug: r.slug, title: r.title, summary: r.summary ?? null }));
        setSuggestions(items);
        setActive(-1);
        setOpen(items.length > 0);
      } catch {
        // Preview is best-effort; never block the normal search.
        setSuggestions([]);
        setOpen(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Close on outside pointer down.
  useEffect(() => {
    function onDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const listId = "search-ahead-list";
  // Derive the closed state from query length so a short query never shows
  // suggestions, even if the suggestions state has not been cleared yet.
  const belowMin = query.trim().length < MIN_CHARS;
  const showList = open && suggestions.length > 0 && !belowMin;
  const countMessage = useMemo(
    () => (showList ? `${suggestions.length} likely match${suggestions.length === 1 ? "" : "es"}` : ""),
    [showList, suggestions.length]
  );

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (!showList) return; // let Enter submit the form normally
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === "Enter") {
      if (active >= 0 && suggestions[active]) {
        event.preventDefault();
        setOpen(false);
        router.push(`/procedure/${suggestions[active].slug}`);
      }
      // else: no highlight → native form submit to /search?q=
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <form action="/search" method="get" role="search" className="w-full">
        <label htmlFor="agent-q" className="sr-only">
          What is the customer asking about?
        </label>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <input
            id="agent-q"
            name="q"
            type="search"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `search-ahead-${active}` : undefined}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              // Reset the preview from the change handler (not the effect) when
              // the query drops below the minimum, e.g. on clearing the input.
              if (value.trim().length < MIN_CHARS) {
                setSuggestions([]);
                setOpen(false);
                setActive(-1);
              }
            }}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label="Describe the passenger's request or problem"
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

      {showList && (
        <div
          id={listId}
          role="listbox"
          aria-label="Likely matches"
          className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-border bg-white shadow-[var(--shadow-lg)] sm:right-auto sm:w-[calc(100%-8.5rem)]"
        >
          <p className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Likely matches</p>
          <ul className="p-1.5">
            {suggestions.map((s, i) => (
              <li key={s.slug} id={`search-ahead-${i}`} role="option" aria-selected={active === i}>
                <Link
                  href={`/procedure/${s.slug}`}
                  onClick={() => setOpen(false)}
                  className={`touch-target block rounded-lg px-3 py-2.5 focus-visible:outline-none ${
                    active === i ? "bg-sky-soft" : "hover:bg-sky-soft/60"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold text-ink">{s.title}</span>
                      {s.summary ? (
                        <span className="mt-0.5 block truncate text-xs text-ink-muted">{s.summary}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-sky">Open procedure</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push(`/search?q=${encodeURIComponent(query.trim())}`);
            }}
            className="block w-full border-t border-border px-4 py-2.5 text-left text-sm font-semibold text-sky transition-colors hover:bg-sky-soft/60 focus-visible:outline-none"
          >
            Search all results
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <Link
          href="/decision"
          className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
        >
          Start guided decision
        </Link>
        <span className="hidden text-xs text-ink-faint sm:inline">
          or press{" "}
          <kbd className="rounded border border-border bg-white px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted">Ctrl</kbd>{" "}
          <kbd className="rounded border border-border bg-white px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted">K</kbd>{" "}
          for quick search
        </span>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {countMessage}
      </span>
    </div>
  );
}
