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
  const [showRestoreChoices, setShowRestoreChoices] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  const bodyText = blocksToText(blocks);
  const originalBlocks: ContentBlock[] =
    Array.isArray(chapter.content_blocks) && chapter.content_blocks.length > 0
      ? chapter.content_blocks
      : [{ type: "text", text: chapter.body_text }];
  const restoreChoices = restoreChoicesFromHistory(history, originalBlocks);
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

  function restoreVersion(choice: RestoreChoice) {
    setBlocks(choice.blocks);
    setShowRestoreChoices(false);
    setMessage({
      type: "success",
      text: `Version from ${new Date(choice.created_at).toLocaleString()} loaded. Review it, then click Save changes to publish it.`,
    });
  }

  function addBlock(type: "text" | "link") {
    const nextBlock: ContentBlock =
      type === "text"
        ? { type: "text", text: "" }
        : { type: "link", title: "Open reference", url: "" };
    setBlocks((prev) => [...prev, nextBlock]);
  }

  function removeBlock(index: number) {
    if (!window.confirm("Delete this block from the chapter?")) return;
    setBlocks((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setBlocks((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
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
            onClick={() => setShowRestoreChoices((value) => !value)}
            disabled={restoreChoices.length === 0 || saving}
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-ink hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Restore version
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

      {showRestoreChoices && (
        <div className="mb-6 rounded-lg border border-border bg-white p-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Choose one of the last 3 saved versions
          </p>
          <div className="grid gap-2">
            {restoreChoices.map((choice, index) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => restoreVersion(choice)}
                className="rounded-lg border border-border bg-panel px-3 py-2 text-left transition-colors hover:border-accent hover:bg-white"
              >
                <span className="block text-sm font-semibold text-ink">
                  Version {index + 1} - {new Date(choice.created_at).toLocaleString()}
                </span>
                <span className="mt-1 block text-xs text-ink-muted">
                  {choice.edited_by_email ?? "Unknown"} - {choice.change_type.replace("_", " ")} - {choice.preview}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

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
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label className="block text-xs text-ink-muted">Chapter blocks</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => addBlock("text")}
              className="rounded-md border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent"
            >
              Add text
            </button>
            <button
              type="button"
              onClick={() => addBlock("link")}
              className="rounded-md border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent"
            >
              Add link
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {blocks.map((block, index) => (
            <BlockEditor
              key={`${block.type}-${index}`}
              block={block}
              index={index}
              isFirst={index === 0}
              isLast={index === blocks.length - 1}
              onChange={(nextBlock) =>
                setBlocks((prev) => prev.map((item, itemIndex) => (itemIndex === index ? nextBlock : item)))
              }
              onMove={(direction) => moveBlock(index, direction)}
              onRemove={() => removeBlock(index)}
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

type RestoreChoice = {
  id: string;
  created_at: string;
  edited_by_email: string | null;
  change_type: string;
  preview: string;
  blocks: ContentBlock[];
};

function restoreChoicesFromHistory(
  history: Pick<
    EditHistoryEntry,
    "id" | "created_at" | "edited_by_email" | "change_type" | "previous_body_text" | "previous_content_blocks"
  >[],
  currentBlocks: ContentBlock[]
): RestoreChoice[] {
  return history
    .filter((entry) => entry.previous_content_blocks?.length || entry.previous_body_text)
    .slice(0, 3)
    .map((entry) => {
      const blocks = entry.previous_content_blocks?.length
        ? entry.previous_content_blocks
        : fallbackTextRestoreBlocks(entry.previous_body_text, currentBlocks);

      return {
        id: entry.id,
        created_at: entry.created_at,
        edited_by_email: entry.edited_by_email,
        change_type: entry.change_type,
        preview: previewBlocks(blocks),
        blocks,
      };
    });
}

function fallbackTextRestoreBlocks(text: string | null, currentBlocks: ContentBlock[]): ContentBlock[] {
  const attachments = currentBlocks.filter((block) => block.type !== "text");
  return [{ type: "text", text: text ?? "" }, ...attachments];
}

function previewBlocks(blocks: ContentBlock[]) {
  const text = blocks.find((block) => block.type === "text" && block.text)?.text ?? "";
  return text.replace(/\s+/g, " ").slice(0, 120) || "No text preview";
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
  isFirst,
  isLast,
  onChange,
  onMove,
  onRemove,
}: {
  block: ContentBlock;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onChange: (block: ContentBlock) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          {String(index + 1).padStart(2, "0")} - {block.type}
        </span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            className="rounded-md border border-border bg-white px-2 py-1 text-[11px] font-semibold text-ink-muted hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Up
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isLast}
            className="rounded-md border border-border bg-white px-2 py-1 text-[11px] font-semibold text-ink-muted hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Down
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md border border-accent/20 bg-accent/10 px-2 py-1 text-[11px] font-semibold text-accent hover:bg-accent hover:text-white"
          >
            Delete
          </button>
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

