import type { ContentBlock } from "@/lib/types";

export function ChapterContent({ blocks }: { blocks: ContentBlock[] }) {
  if (!blocks || blocks.length === 0) {
    return <p className="text-sm text-ink-faint">No content extracted for this chapter yet.</p>;
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        if (block.type === "image" && block.url) {
          return (
            <figure key={i} className="my-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={block.url}
                alt="Reference screenshot"
                className="rounded-lg border border-border max-w-full"
                loading="lazy"
              />
            </figure>
          );
        }

        if (block.type === "text" && block.text) {
          return (
            <p key={i} className="text-[15px] leading-relaxed text-ink whitespace-pre-line">
              {block.text}
            </p>
          );
        }

        return null;
      })}
    </div>
  );
}
