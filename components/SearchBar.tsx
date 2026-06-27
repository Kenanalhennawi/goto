"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "@/lib/types";

export function SearchBar({
  autoFocus = false,
  defaultValue = "",
}: {
  autoFocus?: boolean;
  defaultValue?: string;
}) {
  const [query, setQuery] = useState(defaultValue);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const json = (await res.json()) as { results?: SearchResult[] };
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

  return (
    <div ref={wrapRef} className="relative">
      <form className="relative" action="/search">
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
          name="q"
          type="text"
          autoFocus={autoFocus}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder="Search by issue, SSR, process, keyword..."
          className="w-full rounded-lg border border-border bg-white py-3.5 pl-12 pr-28 font-body text-[15px] text-ink transition-colors placeholder:text-ink-faint focus:border-accent"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent"
        >
          Search
        </button>
      </form>

      {open && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-2 max-h-96 w-full overflow-y-auto rounded-lg border border-border bg-white shadow-2xl shadow-slate-900/15">
          {loading && <p className="px-4 py-3 text-sm text-ink-muted">Searching...</p>}
          {!loading && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-ink-muted">
              No matches. Try a shorter word, SSR code, or passenger issue.
            </p>
          )}
          {!loading &&
            results.map((result) => (
              <Link
                key={result.id}
                href={`/chapter/${result.slug}`}
                onClick={() => setOpen(false)}
                className="block border-b border-border px-4 py-3 last:border-0 hover:bg-panel-hover"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-md bg-orange-50 px-2 py-1 font-mono text-xs font-semibold text-accent">
                    {String(result.chapter_number).padStart(2, "0")}
                  </span>
                  <span className="font-display text-sm font-semibold text-ink">
                    {result.title}
                  </span>
                </div>
                <p
                  className="line-clamp-2 text-xs leading-relaxed text-ink-muted"
                  dangerouslySetInnerHTML={{ __html: result.snippet }}
                />
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
