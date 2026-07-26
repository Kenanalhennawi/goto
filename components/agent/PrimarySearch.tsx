"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Primary agent search (UX-R1A). A real GET form that submits to /search?q=,
// so it reuses the existing search route and scoring unchanged. A secondary
// action links to the guided decision route. The rotating example is text-only
// and pauses under prefers-reduced-motion.
const EXAMPLES = [
  "Passenger has a plaster cast and wants to travel",
  "Customer needs oxygen",
  "Wrong name on the booking",
  "Passenger missed the flight",
  "Customer has two identical bookings",
  "Passenger is travelling with a service dog",
];

export function PrimarySearch() {
  const [placeholder, setPlaceholder] = useState(EXAMPLES[0]);
  const indexRef = useRef(0);

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

  return (
    <form action="/search" method="get" role="search" className="w-full">
      <label htmlFor="agent-q" className="sr-only">
        What is the customer asking about?
      </label>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input
          id="agent-q"
          name="q"
          type="search"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
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
      <div className="mt-3 flex items-center gap-3">
        <Link
          href="/decision"
          className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
        >
          Start guided decision
        </Link>
        <span className="hidden text-xs text-ink-faint sm:inline">
          or press{" "}
          <kbd className="rounded border border-border bg-white px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted">
            Ctrl
          </kbd>{" "}
          <kbd className="rounded border border-border bg-white px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted">
            K
          </kbd>{" "}
          for quick search
        </span>
      </div>
    </form>
  );
}
