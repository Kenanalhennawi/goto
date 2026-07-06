"use client";

import { useState } from "react";

export function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copyLink}
      className="inline-flex rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-ink-muted shadow-sm transition-colors hover:border-accent hover:text-accent"
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
