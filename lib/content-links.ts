import type { Chapter, ContentBlock } from "@/lib/types";
import { normalizeExternalUrl } from "@/lib/links";

export type ReferenceCategory = "Files" | "Emails" | "Phones" | "Links" | "Other";

export type ChapterFileLink = {
  chapter_number: number;
  chapter_title: string;
  chapter_slug: string;
  title: string;
  url: string;
  file_type: string;
  reference_category: ReferenceCategory;
};

export type GroupedChapterFileLink = {
  title: string;
  url: string;
  file_type: string;
  reference_category: ReferenceCategory;
  chapters: Array<{
    chapter_number: number;
    chapter_title: string;
    chapter_slug: string;
  }>;
};

export function extractChapterFileLinks(
  chapter: Pick<Chapter, "chapter_number" | "title" | "slug" | "content_blocks">
) {
  const links: ChapterFileLink[] = [];

  for (const block of chapter.content_blocks ?? []) {
    if (!isLinkBlock(block)) continue;

    const url = normalizeExternalUrl(block.url);
    if (!url) continue;

    links.push({
      chapter_number: chapter.chapter_number,
      chapter_title: chapter.title,
      chapter_slug: chapter.slug,
      title: linkTitle(block.title ?? block.text, url),
      url,
      file_type: fileType(url),
      reference_category: referenceCategory(url),
    });
  }

  return links;
}

export function matchesFileLink(link: ChapterFileLink, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return [
    link.title,
    link.url,
    link.file_type,
    link.reference_category,
    link.chapter_title,
    String(link.chapter_number),
  ].some((value) => value.toLowerCase().includes(needle));
}

export function groupChapterFileLinks(links: ChapterFileLink[]) {
  const byUrl = new Map<string, GroupedChapterFileLink>();

  for (const link of links) {
    const existing = byUrl.get(link.url);
    if (!existing) {
      byUrl.set(link.url, {
        title: link.title,
        url: link.url,
        file_type: link.file_type,
        reference_category: link.reference_category,
        chapters: [
          {
            chapter_number: link.chapter_number,
            chapter_title: link.chapter_title,
            chapter_slug: link.chapter_slug,
          },
        ],
      });
      continue;
    }

    if (link.title.length > existing.title.length) {
      existing.title = link.title;
    }

    if (!existing.chapters.some((chapter) => chapter.chapter_slug === link.chapter_slug)) {
      existing.chapters.push({
        chapter_number: link.chapter_number,
        chapter_title: link.chapter_title,
        chapter_slug: link.chapter_slug,
      });
    }
  }

  return Array.from(byUrl.values()).sort((a, b) => a.title.localeCompare(b.title));
}

export function matchesGroupedFileLink(link: GroupedChapterFileLink, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return [
    link.title,
    link.url,
    link.file_type,
    link.reference_category,
    ...link.chapters.flatMap((chapter) => [
      chapter.chapter_title,
      String(chapter.chapter_number),
    ]),
  ].some((value) => value.toLowerCase().includes(needle));
}

function isLinkBlock(block: ContentBlock): block is ContentBlock & { url: string } {
  return block.type === "link" && typeof block.url === "string" && block.url.length > 0;
}

function linkTitle(title: string | undefined, url: string) {
  const trimmedTitle = title?.trim();
  const derivedTitle = titleFromUrl(url);

  if (trimmedTitle && !isGenericTitle(trimmedTitle) && !looksOpaqueTitle(trimmedTitle)) {
    return trimmedTitle;
  }

  return derivedTitle || trimmedTitle || "Open reference";
}

function fileType(url: string) {
  if (url.startsWith("mailto:")) return "EMAIL";
  if (url.startsWith("tel:")) return "PHONE";

  const pathname = safeUrl(url)?.pathname ?? "";
  const ext = pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toUpperCase();
  if (ext) return ext;
  return "LINK";
}

function referenceCategory(url: string): ReferenceCategory {
  if (url.startsWith("mailto:")) return "Emails";
  if (url.startsWith("tel:")) return "Phones";

  const type = fileType(url);
  if (type !== "LINK") return "Files";
  return looksUsefulWebLink(url) ? "Links" : "Other";
}

function titleFromUrl(url: string) {
  if (url.startsWith("mailto:")) {
    return `Email: ${decodeURIComponent(url.replace(/^mailto:/i, "")).split("?")[0]}`;
  }

  if (url.startsWith("tel:")) {
    return `Phone: ${decodeURIComponent(url.replace(/^tel:/i, ""))}`;
  }

  const parsed = safeUrl(url);
  if (!parsed) return "";

  const lastPath = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() ?? "").trim();
  if (lastPath && !looksOpaqueTitle(lastPath)) return lastPath;

  return `${parsed.hostname.replace(/^www\./, "")} reference`;
}

function safeUrl(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isGenericTitle(title: string) {
  return /^(open|copy|view|link|file|open reference link|open sharepoint reference)$/i.test(title);
}

function looksOpaqueTitle(title: string) {
  const compact = title.replace(/[^a-z0-9]/gi, "");
  return compact.length >= 12 && /^[a-f0-9]+$/i.test(compact);
}

function looksUsefulWebLink(url: string) {
  const parsed = safeUrl(url);
  if (!parsed) return false;

  if (parsed.hostname.includes("sharepoint.com")) return true;
  const lastPath = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() ?? "").trim();
  if (lastPath && looksOpaqueTitle(lastPath)) return false;
  if (parsed.pathname.length > 1) return true;
  return false;
}
