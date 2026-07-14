"use client";

import { useEffect, useState } from "react";

const KEY = "goto.pins.v1";

export type PinnedItem = { slug: string; title: string; code: string | null };

function readPins(): PinnedItem[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return (Array.isArray(stored) ? stored : []).filter(
      (item): item is PinnedItem => Boolean(item) && typeof item.slug === "string"
    );
  } catch {
    return [];
  }
}

// Pin/favorite a procedure for the homepage command center.
// Device-local only; nothing is written to the database.
export function PinButton({ slug, title, code = null }: PinnedItem & { code?: string | null }) {
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() =>
      setPinned(readPins().some((item) => item.slug === slug))
    );
    return () => window.cancelAnimationFrame(frame);
  }, [slug]);

  function toggle() {
    const pins = readPins();
    const next = pinned
      ? pins.filter((item) => item.slug !== slug)
      : [{ slug, title, code }, ...pins].slice(0, 8);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      return;
    }
    setPinned(!pinned);
    window.dispatchEvent(new CustomEvent("goto:pins-changed"));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={pinned}
      className={`press inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold transition-colors ${
        pinned
          ? "border-orange-200 bg-orange-50 text-accent"
          : "border-border bg-white text-ink-muted hover:border-accent hover:text-accent"
      }`}
    >
      <svg className="h-3.5 w-3.5" fill={pinned ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.48 3.5a.56.56 0 011.04 0l2.13 5.11 5.52.44a.56.56 0 01.32.98l-4.2 3.6 1.28 5.38a.56.56 0 01-.84.61L12 16.73l-4.73 2.89a.56.56 0 01-.84-.61l1.28-5.38-4.2-3.6a.56.56 0 01.32-.98l5.52-.44 2.13-5.11z" />
      </svg>
      {pinned ? "Pinned" : "Pin"}
    </button>
  );
}
