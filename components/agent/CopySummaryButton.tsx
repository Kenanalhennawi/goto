"use client";

import { useState } from "react";

// Copy the quick operational summary (UX-R1C). The text is built on the server
// from source-backed card fields only and passed in as a prop, so this client
// component never touches source/review metadata, chapter text, or user answers.
// Provides accessible success feedback via an aria-live region.
export function CopySummaryButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={copy}
        className="agent-secondary touch-target inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          {copied ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7v10a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.6a1 1 0 01.7.3l2.4 2.4a1 1 0 01.3.7V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8"
            />
          )}
        </svg>
        {copied ? "Copied" : "Copy quick summary"}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Quick summary copied" : ""}
      </span>
    </span>
  );
}
