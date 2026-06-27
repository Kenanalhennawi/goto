"use client";

import { useState } from "react";

export function ReportIssueButton({
  chapterId,
  chapterSlug,
}: {
  chapterId: string;
  chapterSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setStatus(null);
    const res = await fetch("/api/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapter_id: chapterId, chapter_slug: chapterSlug, message }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setStatus(data.error ?? "Couldn't send the issue.");
      return;
    }

    setMessage("");
    setOpen(false);
    setStatus("Sent. The quality team can review it in Admin.");
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent"
      >
        Report issue
      </button>

      {open && (
        <div className="mt-3 rounded-lg border border-border bg-white p-3">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="What is wrong or missing in this chapter?"
            className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-ink focus:border-accent"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-ink-faint">{message.length}/2000</span>
            <button
              type="button"
              onClick={submit}
              disabled={saving || message.trim().length < 3}
              className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      )}

      {status && <p className="mt-2 text-xs text-ink-muted">{status}</p>}
    </div>
  );
}
