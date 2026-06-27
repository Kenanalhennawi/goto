import type { Chapter, ContentBlock } from "@/lib/types";
import { normalizeExternalUrl } from "@/lib/links";

export type ChapterFileLink = {
  chapter_number: number;
  chapter_title: string;
  chapter_slug: string;
  title: string;
  url: string;
  file_type: string;
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
    link.chapter_title,
    String(link.chapter_number),
  ].some((value) => value.toLowerCase().includes(needle));
}

function isLinkBlock(block: ContentBlock): block is ContentBlock & { url: string } {
  return block.type === "link" && typeof block.url === "string" && block.url.length > 0;
}

function linkTitle(title: string | undefined, url: string) {
  if (title && !/^open (reference link|sharepoint reference)$/i.test(title.trim())) {
    return title.trim();
  }

  const lastPath = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "").trim();
  return lastPath || title || "Open reference";
}

function fileType(url: string) {
  const pathname = new URL(url).pathname;
  const ext = pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toUpperCase();
  if (ext) return ext;
  if (url.startsWith("mailto:")) return "EMAIL";
  if (url.startsWith("tel:")) return "PHONE";
  return "LINK";
}
