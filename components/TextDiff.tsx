"use client";

import { diffWords } from "diff";

export function TextDiff({ oldText, newText }: { oldText: string | null; newText: string }) {
  if (!oldText) {
    return (
      <div className="bg-good/5 border border-good/20 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-line">
        {newText}
      </div>
    );
  }

  const parts = diffWords(oldText, newText);

  return (
    <div className="bg-panel border border-border rounded-lg p-4 text-sm leading-relaxed whitespace-pre-line">
      {parts.map((part, i) => {
        if (part.added) {
          return (
            <span key={i} className="bg-good/20 text-good rounded px-0.5">
              {part.value}
            </span>
          );
        }
        if (part.removed) {
          return (
            <span key={i} className="bg-accent/20 text-accent rounded px-0.5 line-through">
              {part.value}
            </span>
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </div>
  );
}
