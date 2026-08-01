"use client";

import Link from "next/link";
import type { CockpitSearchResult } from "./CockpitSearch";

// Submitted-scenario panels (OPS-1): multi-topic, deliberate ambiguity, unsafe
// guidance, no-match/source fallback, and calm network failure. Presentation
// only — safety and candidate ordering come from the OI resolver and the
// existing search ranking. Never marks one option as definitive for ambiguous
// or unsafe wording, and never exposes internal concept IDs or safety codes.

export type SuggestionsVariant =
  | { kind: "multi-topic"; items: CockpitSearchResult[] }
  | { kind: "ambiguous"; items: CockpitSearchResult[] }
  | { kind: "unsafe"; message: string; items: CockpitSearchResult[] }
  | { kind: "no-match"; firstChapterSlug: string | null }
  | { kind: "network-failure" };

export function CockpitSuggestions({
  variant,
  query,
  onPick,
  onReset,
}: {
  variant: SuggestionsVariant;
  query: string;
  onPick: (result: CockpitSearchResult) => void;
  onReset: () => void;
}) {
  const searchAllHref = `/search?q=${encodeURIComponent(query)}`;

  if (variant.kind === "network-failure") {
    return (
      <section className="mt-5 rounded-2xl border border-border bg-white p-5" aria-label="Search unavailable">
        <h2 className="font-display text-base font-semibold text-ink">
          We couldn&rsquo;t load results just now
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-ink-muted">
          Try again, or open the full search page.
        </p>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <Link href={searchAllHref} className="agent-primary touch-target inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold focus-visible:outline-none">
            Search all results
          </Link>
          <ResetButton onReset={onReset} />
        </div>
      </section>
    );
  }

  if (variant.kind === "no-match") {
    return (
      <section className="mt-5 rounded-2xl border border-border bg-white p-5" aria-label="No operational match">
        <h2 className="font-display text-base font-semibold text-ink">
          No reviewed operational answer was found.
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-ink-muted">
          You can search all results or review the source material directly.
        </p>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <Link href={searchAllHref} className="agent-primary touch-target inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold focus-visible:outline-none">
            Search all results
          </Link>
          {variant.firstChapterSlug ? (
            <Link
              href={`/chapter/${encodeURIComponent(variant.firstChapterSlug)}`}
              className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
            >
              Open source reference
            </Link>
          ) : null}
          <ResetButton onReset={onReset} />
        </div>
      </section>
    );
  }

  const heading =
    variant.kind === "multi-topic"
      ? "Multiple topics detected"
      : variant.kind === "ambiguous"
        ? "Possible matches"
        : "Related procedures";
  const helper =
    variant.kind === "multi-topic"
      ? "Open one topic at a time."
      : variant.kind === "ambiguous"
        ? "Pick the one that fits the case."
        : null;

  return (
    <section className="mt-5" aria-label={heading}>
      {variant.kind === "unsafe" ? (
        <div role="note" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          {variant.message}
        </div>
      ) : null}

      {variant.items.length > 0 ? (
        <>
          <h2 className={`font-display text-base font-semibold text-ink ${variant.kind === "unsafe" ? "mt-4" : ""}`}>
            {heading}
          </h2>
          {helper ? <p className="mt-1 text-sm text-ink-muted">{helper}</p> : null}
          <div className="mt-3 space-y-2.5">
            {variant.items.slice(0, 3).map((item) => (
              <article key={item.slug} className="rounded-xl border border-border bg-white p-4">
                <h3 className="font-display text-[15px] font-semibold text-ink">{item.title}</h3>
                {item.summary ? (
                  <p className="mt-0.5 text-sm leading-6 text-ink-muted">{item.summary}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onPick(item)}
                    className="agent-primary touch-target inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold focus-visible:outline-none"
                  >
                    Open answer
                  </button>
                  <Link
                    href={`/procedure/${item.slug}`}
                    className="agent-secondary touch-target inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-xs font-semibold focus-visible:outline-none"
                  >
                    Open procedure
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2.5">
        <Link
          href={searchAllHref}
          className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
        >
          Search all results
        </Link>
        <ResetButton onReset={onReset} />
      </div>
    </section>
  );
}

function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <button
      type="button"
      onClick={onReset}
      className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
    >
      Search another issue
    </button>
  );
}
