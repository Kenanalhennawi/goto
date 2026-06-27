"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminActionButton({
  endpoint,
  method = "POST",
  label,
  runningLabel = "Working...",
  confirmText,
}: {
  endpoint: string;
  method?: "POST" | "DELETE";
  label: string;
  runningLabel?: string;
  confirmText?: string;
}) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    if (confirmText && !window.confirm(confirmText)) return;

    setRunning(true);
    setMessage(null);
    const res = await fetch(endpoint, { method });
    const data = await res.json().catch(() => ({}));
    setRunning(false);

    if (!res.ok) {
      setMessage(data.error ?? "Action failed.");
      return;
    }

    setMessage(typeof data.deleted === "number" ? `Deleted ${data.deleted}.` : "Done.");
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? runningLabel : label}
      </button>
      {message && <span className="max-w-48 text-right text-[11px] text-ink-faint">{message}</span>}
    </span>
  );
}
