"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { RecentPage } from "@/components/RecentTracker";

const KEY = "goto.recent.pages.v1";
const PINS_KEY = "goto.pins.v1";

type PinnedItem = { slug: string; title: string; code: string | null };

// Personal workspace strip: continue where you left off + recents.
// Reads only from this browser's localStorage; renders nothing when empty.
export function WorkspaceStrip() {
  const [pages, setPages] = useState<RecentPage[]>([]);
  const [pins, setPins] = useState<PinnedItem[]>([]);

  useEffect(() => {
    function loadPins() {
      try {
        const stored = JSON.parse(window.localStorage.getItem(PINS_KEY) ?? "[]");
        if (Array.isArray(stored)) {
          setPins(
            stored.filter(
              (item): item is PinnedItem => Boolean(item) && typeof item.slug === "string"
            )
          );
        }
      } catch {
        // no pins
      }
    }
    const pinsFrame = window.requestAnimationFrame(loadPins);
    window.addEventListener("goto:pins-changed", loadPins);
    const cleanupPins = () => {
      window.cancelAnimationFrame(pinsFrame);
      window.removeEventListener("goto:pins-changed", loadPins);
    };
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
        if (Array.isArray(stored)) {
          setPages(
            stored.filter(
              (item): item is RecentPage =>
                Boolean(item) && typeof item.slug === "string" && typeof item.title === "string"
            )
          );
        }
      } catch {
        // no recents available
      }
    });
    return () => {
      window.cancelAnimationFrame(frame);
      cleanupPins();
    };
  }, []);

  if (pages.length === 0 && pins.length === 0) return null;

  const [latest, ...rest] = pages;

  return (
    <section className="content-card reveal p-4" aria-label="Your recent work">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
          Your workspace
        </p>
        <span className="text-[11px] font-medium text-ink-faint">Stored on this device</span>
      </div>
      {pins.length > 0 && (
        <div className="mb-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {pins.slice(0, 4).map((pin) => (
            <Link
              key={`pin-${pin.slug}`}
              href={`/procedure/${pin.slug}`}
              className="hover-lift rounded-md border border-orange-200 bg-orange-50/60 px-3 py-2.5"
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-accent">
                Pinned
              </span>
              <span className="mt-0.5 block truncate text-[13px] font-semibold text-ink">
                {pin.code ? `${pin.code} · ` : ""}
                {pin.title}
              </span>
            </Link>
          ))}
        </div>
      )}
      {pages.length > 0 && (
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href={hrefFor(latest)}
          className="hover-lift rounded-md border border-border border-l-[3px] border-l-accent bg-white px-3 py-2.5"
        >
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-sky">
            Continue
          </span>
          <span className="mt-0.5 block truncate text-[13px] font-semibold text-ink">
            {latest.code ? `${latest.code} · ` : ""}
            {latest.title}
          </span>
        </Link>
        {rest.slice(0, 3).map((page) => (
          <Link
            key={`${page.kind}-${page.slug}`}
            href={hrefFor(page)}
            className="hover-lift rounded-md border border-border bg-white px-3 py-2.5"
          >
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
              Recent {page.kind === "procedure" ? "service" : "chapter"}
            </span>
            <span className="mt-0.5 block truncate text-[13px] font-semibold text-ink">
              {page.code ? `${page.code} · ` : ""}
              {page.title}
            </span>
          </Link>
        ))}
      </div>
      )}
    </section>
  );
}

function hrefFor(page: RecentPage) {
  return page.kind === "procedure" ? `/procedure/${page.slug}` : `/chapter/${page.slug}`;
}
