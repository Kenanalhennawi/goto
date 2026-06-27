"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Chapter, ContentBlock, EditHistoryEntry } from "@/lib/types";
import Link from "next/link";

interface Props {
  chapter: Chapter;
  history: Pick<
    EditHistoryEntry,
    | "id"
    | "edited_by_email"
    | "change_type"
    | "created_at"
    | "previous_body_text"
    | "new_body_text"
    | "previous_content_blocks"
    | "new_content_blocks"
  >[];
}

export function ChapterEditor({ chapter, history }: Props) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(
    Array.isArray(chapter.content_blocks) && chapter.content_blocks.length > 0
      ? chapter.content_blocks
      : [{ type: "text", text: chapter.body_text }]
  );
  const [keywords, setKeywords] = useState(chapter.search_keywords.join(", "));
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  const bodyText = blocksToText(blocks);
  const originalBlocks: ContentBlock[] =
    Array.isArray(chapter.content_blocks) && chapter.content_blocks.length > 0
      ? chapter.content_blocks
      : [{ type: "text", text: chapter.body_text }];
  const previousSavedBlocks = restoreBlocksFromHistory(history, originalBlocks);
  const hasChanges =
    bodyText !== chapter.body_text ||
    keywords !== chapter.search_keywords.join(", ") ||
    JSON.stringify(blocks) !== JSON.stringify(chapter.content_blocks ?? []);

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
      body: JSON.stringify({ body_text: bodyText, search_keywords: parsedKeywords, content_blocks: blocks }),
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

  function discardUnsavedChanges() {
    setBlocks(originalBlocks);
    setKeywords(chapter.search_keywords.join(", "));
    setMessage({ type: "success", text: "Unsaved changes were discarded." });
  }

  function restorePreviousVersion() {
    if (!previousSavedBlocks) {
      setMessage({ type: "error", text: "No previous saved version is available yet." });
      return;
    }

    setBlocks(previousSavedBlocks);
    setMessage({
      type: "success",
      text: "Previous version loaded. Review it, then click Save changes to publish it.",
    });
  }

  return (
    <div>
      <Link href="/admin" className="text-xs text-ink-muted hover:text-accent transition-colors inline-flex items-center gap-1 mb-6">
        Back to dashboard
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">
            Ch. {String(chapter.chapter_number).padStart(2, "0")} - {chapter.title}
          </h1>
          <p className="text-xs text-ink-faint mt-1 font-mono">
            Last updated {new Date(chapter.updated_at).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={restorePreviousVersion}
            disabled={!previousSavedBlocks || saving}
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-ink hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Restore previous
          </button>
          <button
            onClick={discardUnsavedChanges}
            disabled={!hasChanges || saving}
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-ink-muted hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Discard changes
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="bg-accent text-base font-medium rounded-lg px-4 py-2 text-sm hover:bg-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
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
          These keywords improve search matching - include SSR codes, abbreviations, and common agent phrasing.
        </p>
      </div>

      <div className="mb-8">
        <label className="block text-xs text-ink-muted mb-2">Chapter blocks</label>
        <div className="space-y-3">
          {blocks.map((block, index) => (
            <BlockEditor
              key={`${block.type}-${index}`}
              block={block}
              index={index}
              onChange={(nextBlock) =>
                setBlocks((prev) => prev.map((item, itemIndex) => (itemIndex === index ? nextBlock : item)))
              }
            />
          ))}
        </div>
        <p className="text-xs text-ink-faint mt-2">
          Edit text and links in place. Images are kept read-only so their placement is not accidentally broken.
        </p>
      </div>

      {history.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowHistory((value) => !value)}
            className="text-xs font-semibold uppercase tracking-wider text-ink-faint transition-colors hover:text-accent"
          >
            {showHistory ? "Hide restore history" : "Show restore history"}
          </button>
          {showHistory && (
            <div className="mt-3 bg-panel border border-border rounded-lg divide-y divide-border">
              {history.map((h) => (
                <div key={h.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                  <span className="text-ink-muted">
                    {h.edited_by_email ?? "Unknown"} - {h.change_type.replace("_", " ")}
                  </span>
                  <span className="text-ink-faint font-mono">
                    {new Date(h.created_at).toLocaleString()}
                  </span>
                  <span className="text-ink-faint">
                    {wordDelta(h.previous_body_text, h.new_body_text)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function restoreBlocksFromHistory(
  history: Pick<EditHistoryEntry, "previous_body_text" | "previous_content_blocks">[],
  currentBlocks: ContentBlock[]
): ContentBlock[] | null {
  const latest = history.find((entry) => entry.previous_content_blocks?.length || entry.previous_body_text);
  if (!latest) return null;

  if (latest.previous_content_blocks?.length) {
    return latest.previous_content_blocks;
  }

  const attachments = currentBlocks.filter((block) => block.type !== "text");
  return [{ type: "text", text: latest.previous_body_text ?? "" }, ...attachments];
}

function wordDelta(previous: string | null, next: string | null) {
  const before = previous?.split(/\s+/).filter(Boolean).length ?? 0;
  const after = next?.split(/\s+/).filter(Boolean).length ?? 0;
  const delta = after - before;
  if (delta === 0) return "No word change";
  return `${delta > 0 ? "+" : ""}${delta} words`;
}

function BlockEditor({
  block,
  index,
  onChange,
}: {
  block: ContentBlock;
  index: number;
  onChange: (block: ContentBlock) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          {String(index + 1).padStart(2, "0")} - {block.type}
        </span>
      </div>

      {block.type === "text" ? (
        <textarea
          value={block.text ?? ""}
          onChange={(event) => onChange({ ...block, text: event.target.value })}
          rows={Math.min(12, Math.max(4, (block.text ?? "").split("\n").length + 1))}
          className="w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-sm leading-relaxed text-ink focus:border-accent"
        />
      ) : block.type === "link" ? (
        <div className="grid gap-2">
          <input
            value={block.title ?? block.text ?? ""}
            onChange={(event) => onChange({ ...block, title: event.target.value })}
            placeholder="Link title"
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink focus:border-accent"
          />
          <input
            value={block.url ?? ""}
            onChange={(event) => onChange({ ...block, url: event.target.value })}
            placeholder="https://..."
            className="w-full rounded-lg border border-border bg-white px-3 py-2 font-mono text-xs text-ink focus:border-accent"
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-ink-muted">
          {block.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={block.url} alt="" className="h-16 w-24 rounded border border-border object-contain bg-white" />
          )}
          <span>{block.filename ?? "Reference screenshot"}</span>
        </div>
      )}
    </div>
  );
}

function blocksToText(blocks: ContentBlock[]) {
  return blocks
    .filter((block) => block.type === "text" && block.text?.trim())
    .map((block) => block.text?.trim())
    .join("\n\n");
}

