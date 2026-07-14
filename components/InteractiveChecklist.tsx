"use client";

import { useState } from "react";

// Live-call checklist: agents tick items while gathering information.
// State is per-visit only (resets on reload), nothing is stored.
export function InteractiveChecklist({ title, items }: { title: string; items: string[] }) {
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false));
  const done = checked.filter(Boolean).length;

  if (items.length === 0) return null;

  return (
    <section className="content-card quick-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-sky">{title}</h2>
        <span
          className={`rounded-sm px-2 py-0.5 text-[11px] font-bold ${
            done === items.length
              ? "bg-mint-soft text-good"
              : "bg-sky-soft text-sky"
          }`}
        >
          {done}/{items.length}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm leading-6 transition-colors ${
                checked[index]
                  ? "border-border bg-slate-50 text-ink-faint line-through decoration-ink-faint/50"
                  : "border-border bg-white text-ink hover:border-sky"
              }`}
            >
              <input
                type="checkbox"
                checked={checked[index]}
                onChange={() =>
                  setChecked((state) => state.map((value, i) => (i === index ? !value : value)))
                }
                className="mt-1 h-4 w-4 shrink-0 accent-[#075fae]"
              />
              <span>{item}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
