"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Chapter, EditHistoryEntry } from "@/lib/types";
import Link from "next/link";

interface Props {
  chapter: Chapter;
  history: Pick<EditHistoryEntry, "id" | "edited_by_email" | "change_type" | "created_at">[];
}

export function ChapterEditor({ chapter, history }: Props) {
  const [bodyText, setBodyText] = useState(chapter.body_text);
  const [keywords, setKeywords] = useState(chapter.search_keywords.join(", "));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  const hasChanges = bodyText !== chapter.body_text || keywords !== chapter.search_keywords.join(", ");

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    const parsedKeywords = keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    const res = await fetch(`/api/chapters/${chapter.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body_text: bodyText, search_keywords: parsedKeywords }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setMessage({ type: "error", text: data.error ?? "Couldn't save. Try again." });
      return;
    }

    setMessage({ type: "success", text: "Saved. The live site is updated." });
    router.refresh();
  }

  return (
    <div>
      <Link href="/admin" className="text-xs text-ink-muted hover:text-accent transition-colors inline-flex items-center gap-1 mb-6">
        ← Back to dashboard
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">
            Ch. {String(chapter.chapter_number).padStart(2, "0")} — {chapter.title}
          </h1>
          <p className="text-xs text-ink-faint mt-1 font-mono">
            Last updated {new Date(chapter.updated_at).toLocaleString()}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="bg-accent text-base font-medium rounded-lg px-4 py-2 text-sm hover:bg-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-lg px-4 py-2.5 text-sm border ${
            message.type === "success"
              ? "bg-good/10 text-good border-good/20"
              : "bg-accent/10 text-accent border-accent/20"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-6">
        <label className="block text-xs text-ink-muted mb-1.5">
          Search keywords (comma separated)
        </label>
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          className="w-full bg-panel border border-border rounded-lg px-4 py-2.5 text-ink font-mono text-sm focus:border-accent transition-colors"
        />
        <p className="text-xs text-ink-faint mt-1">
          These power search matching — include SSR codes, abbreviations, and common agent phrasing.
        </p>
      </div>

      <div className="mb-8">
        <label className="block text-xs text-ink-muted mb-1.5">Chapter content</label>
        <textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={24}
          className="w-full bg-panel border border-border rounded-lg px-4 py-3 text-ink text-sm leading-relaxed focus:border-accent transition-colors font-body resize-y"
        />
        <p className="text-xs text-ink-faint mt-1">
          Leave a blank line between paragraphs. Changes are logged and reversible by an admin.
        </p>
      </div>

      {history.length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-wider text-ink-faint mb-3">Edit history</h2>
          <div className="bg-panel border border-border rounded-lg divide-y divide-border">
            {history.map((h) => (
              <div key={h.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                <span className="text-ink-muted">
                  {h.edited_by_email ?? "Unknown"} · {h.change_type.replace("_", " ")}
                </span>
                <span className="text-ink-faint font-mono">
                  {new Date(h.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
