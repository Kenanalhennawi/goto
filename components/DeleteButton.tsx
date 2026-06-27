"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteButton({
  endpoint,
  label = "Delete",
  confirmText = "Delete this item?",
}: {
  endpoint: string;
  label?: string;
  confirmText?: string;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function remove() {
    if (!window.confirm(confirmText)) return;

    setDeleting(true);
    setError(null);
    const res = await fetch(endpoint, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);

    if (!res.ok) {
      setError(data.error ?? "Couldn't delete.");
      return;
    }

    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={remove}
        disabled={deleting}
        className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {deleting ? "Deleting..." : label}
      </button>
      {error && <span className="max-w-48 text-right text-[11px] text-accent">{error}</span>}
    </span>
  );
}
