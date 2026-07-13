"use client";

import Link from "next/link";
import { useState } from "react";

export type DecisionFlowCard = {
  id: string;
  title: string;
  slug: string;
  service_code: string | null;
  service_type: string | null;
};

export type DecisionFlowArea = {
  name: string;
  cards: DecisionFlowCard[];
};

// Guided "What's the issue?" flow: work area -> service card -> procedure page.
// Pure navigation over already-published cards; no policy content is generated here.
export function DecisionFlow({ areas }: { areas: DecisionFlowArea[] }) {
  const [activeArea, setActiveArea] = useState<string | null>(null);

  const visibleAreas = areas.filter((area) => area.cards.length > 0);
  if (visibleAreas.length === 0) return null;

  const selected = visibleAreas.find((area) => area.name === activeArea) ?? null;

  return (
    <section className="content-card border-t-2 border-t-navy p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            Guided lookup
          </p>
          <h2 className="mt-0.5 font-display text-base font-semibold text-ink">
            {selected ? selected.name : "What is the passenger issue about?"}
          </h2>
        </div>
        {selected && (
          <button
            type="button"
            onClick={() => setActiveArea(null)}
            className="rounded border border-border bg-white px-2.5 py-1 text-xs font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent"
          >
            &larr; All areas
          </button>
        )}
      </div>

      {!selected ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {visibleAreas.map((area) => (
            <button
              key={area.name}
              type="button"
              onClick={() => setActiveArea(area.name)}
              className="rounded-md border border-border bg-white px-3 py-2.5 text-left transition-colors hover:border-accent"
            >
              <span className="block text-[13px] font-semibold leading-5 text-ink">
                {area.name}
              </span>
              <span className="mt-0.5 block text-[11px] font-medium text-ink-faint">
                {area.cards.length} service{area.cards.length === 1 ? "" : "s"}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {selected.cards.map((card) => (
            <Link
              key={card.id}
              href={`/procedure/${card.slug}`}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-white px-3 py-2 transition-colors hover:border-accent"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold leading-5 text-ink">
                  {card.title}
                </span>
                {(card.service_code || card.service_type) && (
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    {card.service_code && (
                      <span className="rounded-sm border border-orange-200 bg-orange-50 px-1.5 py-px font-mono text-[10px] font-bold text-accent">
                        {card.service_code}
                      </span>
                    )}
                    {card.service_type && (
                      <span className="truncate text-[11px] font-medium text-ink-faint">
                        {card.service_type}
                      </span>
                    )}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs font-semibold text-sky">Open</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
