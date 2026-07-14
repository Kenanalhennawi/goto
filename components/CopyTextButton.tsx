"use client";

import { useState } from "react";

// One-click copy for customer scripts and SPRINT/Salesforce templates.
export function CopyTextButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="press inline-flex items-center gap-1.5 rounded border border-border bg-white px-2.5 py-1 text-xs font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        {copied ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v10a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.6a1 1 0 01.7.3l2.4 2.4a1 1 0 01.3.7V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8" />
        )}
      </svg>
      {copied ? "Copied" : label}
    </button>
  );
}
