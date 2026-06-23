"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { SearchResult } from "@/lib/types";

export function SearchBar({ autoFocus = false }: { autoFocus?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timeout = setTimeout(async () => {
      // Sanitize query for to_tsquery — wrap terms with prefix matching
      const terms = query
        .trim()
        .split(/\s+/)
        .map((t) => t.replace(/[^\w]/g, ""))
        .filter(Boolean)
        .map((t) => `${t}:*`)
        .join(" & ");

      if (!terms) return;

      const { data, error } = await supabase.rpc("search_chapters", {
        query: terms,
      });

      if (!error && data) {
        setResults(data as SearchResult[]);
        setIsOpen(true);
        setActiveIndex(-1);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [query, supabase]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      router.push(`/chapter/${results[activeIndex].slug}`);
      setIsOpen(false);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-faint"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
        </svg>
        <input
          type="text"
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search procedures — e.g. baggage, wheelchair, EXST, Tabby..."
          className="w-full bg-panel border border-border rounded-lg pl-12 pr-4 py-3.5 text-ink placeholder:text-ink-faint focus:border-accent transition-colors font-body text-[15px]"
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-2 w-full bg-panel border border-border rounded-lg shadow-2xl shadow-black/40 overflow-hidden max-h-96 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={r.id}
              onClick={() => {
                router.push(`/chapter/${r.slug}`);
                setIsOpen(false);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full text-left px-4 py-3 border-b border-border last:border-0 transition-colors ${
                i === activeIndex ? "bg-panel-hover" : "hover:bg-panel-hover"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-accent tabular-nums">
                  {String(r.chapter_number).padStart(2, "0")}
                </span>
                <span className="font-display font-medium text-sm text-ink">{r.title}</span>
              </div>
              <p
                className="text-xs text-ink-muted line-clamp-1"
                dangerouslySetInnerHTML={{ __html: r.snippet }}
              />
            </button>
          ))}
        </div>
      )}

      {isOpen && query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-50 mt-2 w-full bg-panel border border-border rounded-lg p-4 text-sm text-ink-muted">
          No matches for &ldquo;{query}&rdquo;. Try a different term or SSR code.
        </div>
      )}
    </div>
  );
}
