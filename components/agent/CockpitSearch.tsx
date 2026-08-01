"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

// Cockpit scenario input (OPS-1). Ports the proven PrimarySearch behaviour
// (GET /api/search, debounce, AbortController, combobox semantics, STAB-1
// no-setState-in-effect pattern) but resolves results INSIDE the Cockpit via
// callbacks instead of navigating. The native GET form to /search remains as
// the no-JS fallback, and "Search all results" is the explicit /search handoff.
// Nothing typed is persisted anywhere.

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

// Full operational-card row from /api/search — everything the Cockpit answer
// needs to reuse deriveOperationalAnswer without a second request.
export type CockpitSearchResult = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  snippet: string;
  category: string;
  service_code: string | null;
  cut_off_time: string | null;
  when_to_use: string | null;
  who_can_action: unknown[];
  required_information: unknown[];
  system_steps: unknown[];
  passenger_advice: unknown[];
  allowed: unknown[];
  not_allowed: unknown[];
  escalation_points: unknown[];
  fees_charges: string | null;
  source_version: string | null;
  chapterSlug: string | null;
};

export type CockpitSearchPayload = {
  query: string;
  results: CockpitSearchResult[];
  firstChapterSlug: string | null;
  failed: boolean;
};

type ApiResult = {
  type: string;
  id?: string;
  slug: string;
  title: string;
  summary?: string | null;
  snippet?: string | null;
  category?: string | null;
  service_code?: string | null;
  cut_off_time?: string | null;
  when_to_use?: string | null;
  who_can_action?: unknown[];
  required_information?: unknown[];
  system_steps?: unknown[];
  passenger_advice?: unknown[];
  allowed?: unknown[];
  not_allowed?: unknown[];
  escalation_points?: unknown[];
  fees_charges?: string | null;
  source_version?: string | null;
  chapter_slug?: string | null;
};

function mapResponse(query: string, json: { results?: ApiResult[] }): CockpitSearchPayload {
  const all = json.results ?? [];
  const results = all
    .filter((r) => r.type === "operational_card")
    .map((r) => ({
      id: r.id ?? r.slug,
      slug: r.slug,
      title: r.title,
      summary: r.summary ?? null,
      snippet: r.snippet ?? "",
      category: r.category ?? "",
      service_code: r.service_code ?? null,
      cut_off_time: r.cut_off_time ?? null,
      when_to_use: r.when_to_use ?? null,
      who_can_action: r.who_can_action ?? [],
      required_information: r.required_information ?? [],
      system_steps: r.system_steps ?? [],
      passenger_advice: r.passenger_advice ?? [],
      allowed: r.allowed ?? [],
      not_allowed: r.not_allowed ?? [],
      escalation_points: r.escalation_points ?? [],
      fees_charges: r.fees_charges ?? null,
      source_version: r.source_version ?? null,
      chapterSlug: r.chapter_slug ?? null,
    }));
  const firstChapter = all.find((r) => r.type === "chapter");
  return { query, results, firstChapterSlug: firstChapter?.slug ?? null, failed: false };
}

export function CockpitSearch({
  inputRef,
  onPick,
  onSubmitScenario,
  showGuidedLink = true,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  /** A suggestion was clicked / chosen with Enter — open its answer in place. */
  onPick: (result: CockpitSearchResult, payload: CockpitSearchPayload) => void;
  /** Plain Enter — resolve the submitted scenario in place. */
  onSubmitScenario: (payload: CockpitSearchPayload) => void;
  showGuidedLink?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [placeholder, setPlaceholder] = useState(EXAMPLES[0]);
  const [suggestions, setSuggestions] = useState<CockpitSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const indexRef = useRef(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Latest full response, reused on submit so no duplicate request is made.
  const lastPayloadRef = useRef<CockpitSearchPayload | null>(null);

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
  // cards only. Short queries are cleared in the change handler (STAB-1
  // pattern: no synchronous setState inside the effect).
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_CHARS) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const payload = mapResponse(trimmed, await res.json());
        lastPayloadRef.current = payload;
        setSuggestions(payload.results.slice(0, MAX_SUGGESTIONS));
        setActive(-1);
        setOpen(payload.results.length > 0);
      } catch {
        // Preview is best-effort; plain submit and /search still work.
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

  const listId = "cockpit-search-list";
  const belowMin = query.trim().length < MIN_CHARS;
  const showList = open && suggestions.length > 0 && !belowMin;
  const countMessage = useMemo(
    () => (showList ? `${suggestions.length} likely match${suggestions.length === 1 ? "" : "es"}` : ""),
    [showList, suggestions.length]
  );

  async function resolveScenario() {
    const trimmed = query.trim();
    if (trimmed.length < MIN_CHARS) return;
    setOpen(false);
    // Reuse the latest response when it matches the submitted text.
    const cached = lastPayloadRef.current;
    if (cached && cached.query === trimmed) {
      onSubmitScenario(cached);
      return;
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
      const payload = mapResponse(trimmed, await res.json());
      lastPayloadRef.current = payload;
      onSubmitScenario(payload);
    } catch {
      onSubmitScenario({ query: trimmed, results: [], firstChapterSlug: null, failed: true });
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (!showList) return; // plain Enter falls through to the form submit
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
        onPick(suggestions[active], lastPayloadRef.current ?? { query: query.trim(), results: suggestions, firstChapterSlug: null, failed: false });
      }
      // else: form onSubmit resolves the scenario in place
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      {/* Native GET form remains the no-JS fallback to /search. With JS the
          submit is intercepted and resolved inside the Cockpit. */}
      <form
        action="/search"
        method="get"
        role="search"
        className="w-full"
        onSubmit={(event) => {
          event.preventDefault();
          void resolveScenario();
        }}
      >
        <label htmlFor="agent-q" className="sr-only">
          What is the customer asking about?
        </label>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <input
            ref={inputRef}
            id="agent-q"
            name="q"
            type="search"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `cockpit-ahead-${active}` : undefined}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
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
              <li key={s.slug} id={`cockpit-ahead-${i}`} role="option" aria-selected={active === i}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onPick(s, lastPayloadRef.current ?? { query: query.trim(), results: suggestions, firstChapterSlug: null, failed: false });
                  }}
                  className={`touch-target block w-full rounded-lg px-3 py-2.5 text-left focus-visible:outline-none ${
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
                    <span className="shrink-0 text-xs font-semibold text-sky">Open answer</span>
                  </span>
                </button>
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

      {showGuidedLink ? (
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
      ) : null}

      <span role="status" aria-live="polite" className="sr-only">
        {countMessage}
      </span>
    </div>
  );
}
