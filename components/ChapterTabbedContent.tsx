import Link from "next/link";
import type { ContentBlock } from "@/lib/types";

type TextPiece = {
  kind: "text";
  text: string;
};

type ImagePiece = {
  kind: "image";
  title: string;
  url: string;
};

type LinkPiece = {
  kind: "link";
  title: string;
  url: string;
};

type FilePiece = {
  kind: "file";
  title: string;
};

type Piece = TextPiece | ImagePiece | LinkPiece | FilePiece;

type GuideSection = {
  title: string;
  pieces: Piece[];
};

type Tab = {
  id: string;
  label: string;
  summary: string;
  sections: GuideSection[];
};

export function ChapterTabbedContent({
  blocks,
  activeSection = "guide",
  baseHref,
  editHref,
}: {
  blocks: ContentBlock[];
  activeSection?: string;
  baseHref: string;
  editHref?: string;
}) {
  const tabs = buildTabs(blocks);
  const activeTab = tabs.find((tab) => tab.id === activeSection) ?? tabs[0];

  if (!blocks || blocks.length === 0 || tabs.length === 0) {
    return (
      <div className="content-card p-6 text-sm text-ink-muted">
        No content extracted for this chapter yet.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto rounded-xl border border-border bg-white p-2 soft-shadow">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`${baseHref}?section=${tab.id}`}
            className={`min-w-max rounded-lg px-4 py-3 text-left transition-colors ${
              tab.id === activeTab.id
                ? "bg-ink text-white shadow-sm"
                : "text-ink-muted hover:bg-sky-soft hover:text-sky"
            }`}
          >
            <span className="block font-display text-sm font-semibold">{tab.label}</span>
            <span
              className={`block text-[11px] ${
                tab.id === activeTab.id ? "text-white/70" : "text-ink-faint"
              }`}
            >
              {tab.sections.length} sections
            </span>
          </Link>
        ))}
      </div>

      <section className="content-card overflow-hidden">
        <div className="border-b border-border bg-sky-soft px-5 py-4">
          <p className="font-display text-lg font-semibold text-ink">{activeTab.label}</p>
          <p className="mt-1 text-sm text-ink-muted">{activeTab.summary}</p>
          {editHref && (
            <Link
              href={editHref}
              className="mt-3 inline-flex rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent"
            >
              Edit chapter
            </Link>
          )}
        </div>

        {activeTab.sections.length > 1 && (
          <nav className="border-b border-border bg-white px-5 py-3">
            <div className="flex gap-2 overflow-x-auto">
              {activeTab.sections.slice(0, 16).map((section, index) => (
                <a
                  key={`${section.title}-nav-${index}`}
                  href={`#${sectionId(section, index)}`}
                  className="min-w-max rounded-md border border-border bg-sky-soft px-3 py-1.5 text-xs font-semibold text-sky transition-colors hover:border-sky hover:bg-white"
                >
                  {section.title}
                </a>
              ))}
            </div>
          </nav>
        )}

        <div className="space-y-4 p-4 sm:p-5">
          {activeTab.sections.map((section, index) => (
            <article
              key={`${section.title}-${index}`}
              id={sectionId(section, index)}
              className="scroll-mt-24 rounded-lg border border-border bg-white p-4"
            >
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-orange-50 font-mono text-xs font-semibold text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-semibold leading-snug text-ink">
                    {section.title}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-sm leading-6 text-ink-muted">
                    {sectionPreview(section)}
                  </span>
                </span>
                <a
                  href={`#${sectionId(section, index)}`}
                  className="rounded-md bg-sky-soft px-2 py-1 text-xs font-semibold text-sky transition-colors hover:bg-white"
                  aria-label={`Copy link to ${section.title}`}
                >
                  Link
                </a>
                {editHref && (
                  <Link
                    href={editHref}
                    className="rounded-md bg-orange-50 px-2 py-1 text-xs font-semibold text-accent transition-colors hover:bg-white"
                  >
                    Edit
                  </Link>
                )}
              </div>

              <div className="space-y-3 border-t border-border pt-3">
                {section.pieces.map((piece, pieceIndex) =>
                  piece.kind === "image" ? (
                    <figure
                      key={`${piece.title}-${pieceIndex}`}
                      className="inline-block max-w-full overflow-hidden rounded-md border border-border bg-white p-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={piece.url}
                        alt={piece.title}
                        className="h-auto max-h-[420px] max-w-full rounded bg-white object-contain"
                        loading="lazy"
                      />
                      {humanImageTitle(piece.title) && (
                        <figcaption className="mt-2 text-xs font-medium text-ink-faint">
                          {humanImageTitle(piece.title)}
                        </figcaption>
                      )}
                    </figure>
                  ) : piece.kind === "link" ? (
                    <a
                      key={`${piece.url}-${pieceIndex}`}
                      href={piece.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center justify-between gap-3 rounded-lg border border-blue-200 bg-sky-soft px-4 py-3 text-sm font-semibold text-sky transition-colors hover:border-sky hover:bg-white"
                    >
                      <span className="truncate">{piece.title}</span>
                      <span aria-hidden="true">Open</span>
                    </a>
                  ) : piece.kind === "file" ? (
                    <div
                      key={`${piece.title}-${pieceIndex}`}
                      className="inline-flex max-w-full items-center gap-3 rounded-lg border border-amber-200 bg-amber-soft px-4 py-3 text-sm text-ink"
                    >
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-warn">
                        File
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{piece.title}</span>
                        <span className="block text-xs text-ink-muted">
                          This file is referenced in the PDF, but no link URL is available yet.
                        </span>
                      </span>
                    </div>
                  ) : (
                    <FormattedText key={`${piece.text.slice(0, 24)}-${pieceIndex}`} text={piece.text} />
                  )
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function buildTabs(blocks: ContentBlock[]): Tab[] {
  const sections = buildGuideSections(blocks);
  const stepSections = sections.filter((section) => sectionMatches(section, STEP_PATTERN));
  const ruleSections = sections.filter((section) => sectionMatches(section, RULE_PATTERN));
  const imageSections = sections.filter((section) =>
    section.pieces.some((piece) => piece.kind === "image")
  );

  return [
    {
      id: "guide",
      label: "Guide",
      summary: "Read the procedure in order with screenshots placed inside the explanation.",
      sections,
    },
    {
      id: "steps",
      label: "Steps",
      summary: "The action-oriented parts agents need while solving a live case.",
      sections: stepSections.length ? stepSections : sections.slice(0, 6),
    },
    {
      id: "rules",
      label: "Rules",
      summary: "Conditions, restrictions, exceptions, and important notes.",
      sections: ruleSections.length ? ruleSections : sections.slice(0, 6),
    },
    {
      id: "images",
      label: "Images",
      summary: "Screenshots shown with their nearest explanation, not detached at the bottom.",
      sections: imageSections,
    },
  ].filter((tab) => tab.sections.length > 0);
}

function buildGuideSections(blocks: ContentBlock[]): GuideSection[] {
  const sections: GuideSection[] = [];
  let current: GuideSection | null = null;
  let previousText = "";

  function ensureSection(title = "Procedure") {
    if (!current) {
      current = { title, pieces: [] };
      sections.push(current);
    }
    return current;
  }

  for (const block of blocks) {
    if (block.type === "image" && block.url) {
      ensureSection().pieces.push({
        kind: "image",
        title: block.filename ?? "Reference screenshot",
        url: block.url,
      });
      continue;
    }

    if (block.type === "link" && block.url) {
      ensureSection().pieces.push({
        kind: "link",
        title: block.title ?? block.text ?? "Open reference",
        url: block.url,
      });
      continue;
    }

    if (block.type !== "text" || !block.text?.trim()) continue;

    const paragraphs = splitText(block.text);
    for (const paragraph of paragraphs) {
      if (paragraph === previousText) continue;
      previousText = paragraph;
      if (isLinkedFilesHeading(paragraph)) continue;
      if (isClickMeLine(paragraph)) continue;
      if (isNumberOnly(paragraph)) continue;

      const fileReference = fileReferenceTitle(paragraph);
      if (fileReference) {
        ensureSection("File references").pieces.push({ kind: "file", title: fileReference });
        continue;
      }

      if (isSkLine(paragraph)) {
        ensureSection("Search keywords").pieces.push({ kind: "text", text: cleanSkLine(paragraph) });
        continue;
      }

      if (isHeading(paragraph)) {
        current = {
          title: cleanHeading(paragraph),
          pieces: [],
        };
        sections.push(current);
        continue;
      }

      ensureSection(sectionTitleFromText(paragraph, sections.length + 1)).pieces.push({
        kind: "text",
        text: paragraph,
      });
    }
  }

  return rebalanceTrailingImages(sections.filter((section) => section.pieces.length > 0));
}

function rebalanceTrailingImages(sections: GuideSection[]) {
  const imageSections = sections.filter((section) =>
    section.pieces.some((piece) => piece.kind === "image")
  );

  if (imageSections.length !== 1) return sections;

  const source = imageSections[0];
  const images = source.pieces.filter((piece): piece is ImagePiece => piece.kind === "image");
  if (images.length < 3) return sections;

  source.pieces = source.pieces.filter((piece) => piece.kind !== "image");

  const sourceIndex = sections.indexOf(source);
  const candidateSections = sections
    .slice(0, sourceIndex + 1)
    .filter((section) => {
      if (section.title === "Search keywords" || section.title === "File references") return false;
      return section.pieces.some((piece) => piece.kind === "text");
    });

  const targets = candidateSections.slice(-images.length);
  images.forEach((image, index) => {
    const target = targets[index] ?? source;
    target.pieces.push(image);
  });

  return sections.filter((section) => section.pieces.length > 0);
}

function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const bulletLines = lines.filter((line) => BULLET_PATTERN.test(line) || STEP_LINE_PATTERN.test(line));
  const shortKeywordList =
    lines.length === 1 &&
    text.length < 180 &&
    text.includes(",") &&
    !/[.!?]\s/.test(text);

  if (shortKeywordList) {
    return (
      <div className="flex flex-wrap gap-2">
        {text
          .split(",")
          .map((keyword) => keyword.trim())
          .filter(Boolean)
          .slice(0, 12)
          .map((keyword) => (
            <span
              key={keyword}
              className="rounded-full border border-sky/20 bg-sky-soft px-3 py-1 text-xs font-medium text-sky"
            >
              {keyword}
            </span>
          ))}
      </div>
    );
  }

  if (lines.length >= 2 && bulletLines.length / lines.length > 0.45) {
    return (
      <ul className="grid gap-2">
        {lines.map((line, index) => (
          <li
            key={`${line}-${index}`}
            className="rounded-md border border-border/80 bg-sky-soft/45 px-3 py-2 text-[15px] leading-7 text-ink"
          >
            <span className="mr-2 font-semibold text-accent">{index + 1}.</span>
            <span>{stripListMarker(line)}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-3 text-[15px] leading-7 text-ink">
      {lines.map((line, index) => (
        <p key={`${line}-${index}`}>{cleanDisplayText(line)}</p>
      ))}
    </div>
  );
}

const STEP_PATTERN =
  /\b(step|process|agent|customer|passenger|click|select|retrieve|create|update|book|cancel|refund|payment|pnr|advise|inform|verify|check)\b/i;
const RULE_PATTERN =
  /\b(must|should|cannot|not allowed|only|if|eligible|valid|condition|restriction|note|important|exception|required|allowed|applicable)\b/i;
const BULLET_PATTERN = /^([\u2022\u25aa\-*]|\d+[.)]|[a-z][.)])\s+/i;
const STEP_LINE_PATTERN = /^step\s*#?\s*\d+/i;

function splitText(text: string) {
  return text
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .flatMap((paragraph) => splitDenseParagraph(paragraph))
    .map((paragraph) => normalizeText(paragraph))
    .filter(Boolean);
}

function splitDenseParagraph(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 5) return [text];

  const chunks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const startsNewPoint =
      BULLET_PATTERN.test(line) ||
      STEP_LINE_PATTERN.test(line) ||
      (current.length >= 3 && /^[A-Z][A-Za-z /&'():-]{4,85}\.?$/.test(line));

    if (startsNewPoint && current.length > 0) {
      chunks.push(current.join("\n"));
      current = [];
    }

    current.push(line);
  }

  if (current.length > 0) chunks.push(current.join("\n"));

  return chunks.length > 1 ? chunks : [text];
}

function normalizeText(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !isClickMeLine(line))
    .filter((line) => !isNumberOnly(line))
    .map((line) => cleanDisplayText(line))
    .filter(Boolean)
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function isHeading(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (isNumberOnly(compact)) return false;
  if (fileReferenceTitle(compact)) return false;
  if (compact.length > 95) return false;
  if (isSkLine(compact)) return false;
  if (/^(\d{1,2}\.)?\s*[A-Z][A-Za-z0-9 /&'\u2019():-]{3,}$/.test(compact)) return true;
  return /^\d+(?:\.\d+)*\.?\s+[A-Z].{3,70}$/.test(compact);
}

function isNumberOnly(text: string) {
  return /^\d+(?:\.\d+)*\.?$/.test(text.trim());
}

function cleanHeading(text: string) {
  return cleanDisplayText(text.replace(/\s+/g, " ")).trim();
}

function sectionTitleFromText(text: string, fallbackNumber: number) {
  const firstLine = text.split("\n").find(Boolean)?.trim() ?? "";
  const compact = cleanDisplayText(firstLine.replace(/\s+/g, " "));
  const numbered = compact.match(/^(\d+(?:\.\d+)*)\.?\s+(.{4,60})/);
  if (numbered) return cleanHeading(numbered[0]);
  if (compact.length > 0 && compact.length <= 58) return compact;
  return `Procedure part ${fallbackNumber}`;
}

function isClickMeLine(text: string) {
  return /^\(?click me to view file\)?$/i.test(text.trim());
}

function isLinkedFilesHeading(text: string) {
  return /^Linked files from PDF page \d+$/i.test(text.trim());
}

function fileReferenceTitle(text: string) {
  const compact = text
    .replace(/\s+/g, " ")
    .replace(/\(click me to view file\)/gi, "")
    .trim();
  const match = compact.match(/([A-Za-z0-9][A-Za-z0-9 _.,&()'\u2019+-]{2,}\.(?:pdf|pptx?|docx?|xlsx?))$/i);
  return match ? match[1].trim() : null;
}

function stripSectionNumber(text: string) {
  return text
    .replace(/^\s*\d+(?:\.\d+)+\.?\s*[-\u2013\u2014:]?\s+/, "")
    .replace(/^\s*\d+\.\s+(?=[A-Z][A-Za-z])/, "")
    .replace(/^\s*\d+(?:\.\d+)+\.?\s*$/, "")
    .trim();
}

function cleanDisplayText(text: string) {
  return stripSectionNumber(text)
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function isSkLine(text: string) {
  return /^\(?SK:/i.test(text.trim());
}

function cleanSkLine(text: string) {
  return text.replace(/^\(?SK:\s*/i, "").replace(/\)?$/, "").replace(/,+/g, ", ").trim();
}

function sectionMatches(section: GuideSection, pattern: RegExp) {
  return pattern.test(
    `${section.title}\n${section.pieces
      .filter((piece): piece is TextPiece => piece.kind === "text")
      .map((piece) => piece.text)
      .join("\n")}`
  );
}

function sectionId(section: GuideSection, index: number) {
  const slug = section.title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `section-${index + 1}-${slug || "item"}`;
}

function sectionPreview(section: GuideSection) {
  const text = section.pieces.find((piece): piece is TextPiece => piece.kind === "text")?.text;
  if (!text) {
    const image = section.pieces.find((piece): piece is ImagePiece => piece.kind === "image");
    return image ? "Reference image in context." : "Open this section for details.";
  }

  return text
    .replace(/\s+/g, " ")
    .replace(/^[-*\u2022]\s*/, "")
    .slice(0, 180);
}

function stripListMarker(text: string) {
  return text.replace(BULLET_PATTERN, "").replace(/^step\s*#?\s*\d+\s*[:.-]?\s*/i, "").trim();
}

function humanImageTitle(title: string) {
  return title
    .replace(/\.(png|jpe?g|webp)$/i, "")
    .replace(/^ch\d+-/i, "")
    .replace(/-\d+$/i, "")
    .replace(/-/g, " ")
    .trim();
}
