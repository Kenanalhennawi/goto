import type { Chapter, ContentBlock } from "./types";
import { normalizeExternalUrl } from "./links";

export type ReferenceCategory = "Files" | "Emails" | "Phones" | "Links" | "Needs review" | "Other";

export type ChapterFileLink = {
  chapter_number: number;
  chapter_title: string;
  chapter_slug: string;
  title: string;
  url: string | null;
  file_type: string;
  reference_category: ReferenceCategory;
  context: string;
  note?: string;
};

export type GroupedChapterFileLink = {
  title: string;
  url: string | null;
  file_type: string;
  reference_category: ReferenceCategory;
  context: string;
  note?: string;
  chapters: Array<{
    chapter_number: number;
    chapter_title: string;
    chapter_slug: string;
  }>;
};

type ContactMention = {
  value: string;
  url: string;
  fileType: "EMAIL" | "PHONE";
  category: "Emails" | "Phones";
  context: string;
};

export function extractChapterFileLinks(
  chapter: Pick<Chapter, "chapter_number" | "title" | "slug" | "content_blocks">
) {
  const links: ChapterFileLink[] = [];
  const linkedFileNames = new Set<string>();
  const linkedContacts = new Set<string>();
  const mentionedFiles: ChapterFileLink[] = [];
  const mentionedContacts: ChapterFileLink[] = [];
  let recentText = "";

  for (const block of chapter.content_blocks ?? []) {
    if (block.type === "text") {
      recentText = block.text ?? recentText;
      const shouldExtractContacts = !isSuppressedContactList(block.text ?? "");
      for (const contact of shouldExtractContacts ? contactMentions(block.text ?? "", chapter.title) : []) {
        mentionedContacts.push({
          chapter_number: chapter.chapter_number,
          chapter_title: chapter.title,
          chapter_slug: chapter.slug,
          title: `${contact.fileType === "EMAIL" ? "Email" : "Phone"}: ${contact.value}`,
          url: contact.url,
          file_type: contact.fileType,
          reference_category: contact.category,
          context: knownContactContext(contact.value) || contact.context,
        });
      }
      for (const fileName of fileMentions(block.text ?? "")) {
        const title = prettifyReferenceTitle(fileName, chapter.title);
        mentionedFiles.push({
          chapter_number: chapter.chapter_number,
          chapter_title: chapter.title,
          chapter_slug: chapter.slug,
          title,
          url: null,
          file_type: fileTypeFromFilename(fileName),
          reference_category: "Needs review",
          context: contextFromText(block.text ?? "", fileName, chapter.title),
          note: "Mentioned in the guide, but no clickable link was found in the PDF.",
        });
      }
      continue;
    }

    if (!isLinkBlock(block)) continue;

    const url = normalizeExternalUrl(block.url);
    if (!url) continue;
    if ((url.startsWith("mailto:") || url.startsWith("tel:")) && isSuppressedContactList(recentText)) {
      continue;
    }

    const title = linkTitle(block.title ?? block.text, url, chapter.title);
    if (url.startsWith("mailto:") || url.startsWith("tel:")) {
      linkedContacts.add(contactKey(url));
    }
    linkedFileNames.add(normalizedFileName(title));
    const urlFileName = fileNameFromUrl(url);
    if (urlFileName) linkedFileNames.add(normalizedFileName(urlFileName));

    links.push({
      chapter_number: chapter.chapter_number,
      chapter_title: chapter.title,
      chapter_slug: chapter.slug,
      title,
      url,
      file_type: fileType(url),
      reference_category: referenceCategory(url),
      context: contactContext(url, recentText, chapter.title),
    });
  }

  for (const mention of mentionedFiles) {
    if (!linkedFileNames.has(normalizedFileName(mention.title))) {
      links.push(mention);
    }
  }

  for (const mention of mentionedContacts) {
    if (mention.url && !linkedContacts.has(contactKey(mention.url))) {
      links.push(mention);
      linkedContacts.add(contactKey(mention.url));
    }
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
    fileTypeLabel(link.file_type),
    link.reference_category,
    link.context,
    link.chapter_title,
    String(link.chapter_number),
  ].some((value) => String(value ?? "").toLowerCase().includes(needle));
}

export function groupChapterFileLinks(links: ChapterFileLink[]) {
  const byUrl = new Map<string, GroupedChapterFileLink>();

  for (const link of links) {
    const groupKey = link.url ?? `${link.chapter_slug}:${link.title}`;
    const existing = byUrl.get(groupKey);
    if (!existing) {
      byUrl.set(groupKey, {
        title: link.title,
        url: link.url,
        file_type: link.file_type,
        reference_category: link.reference_category,
        context: link.context,
        note: link.note,
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

    if (link.context.length > existing.context.length) {
      existing.context = link.context;
    }

    if (!existing.note && link.note) {
      existing.note = link.note;
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
    fileTypeLabel(link.file_type),
    link.reference_category,
    link.context,
    link.note ?? "",
    ...link.chapters.flatMap((chapter) => [
      chapter.chapter_title,
      String(chapter.chapter_number),
    ]),
  ].some((value) => String(value ?? "").toLowerCase().includes(needle));
}

function isLinkBlock(block: ContentBlock): block is ContentBlock & { url: string } {
  return block.type === "link" && typeof block.url === "string" && block.url.length > 0;
}

function linkTitle(title: string | undefined, url: string, chapterTitle: string) {
  const trimmedTitle = title?.trim();
  const derivedTitle = titleFromUrl(url, chapterTitle);

  if (trimmedTitle && !isGenericTitle(trimmedTitle) && !looksOpaqueTitle(trimmedTitle)) {
    return prettifyReferenceTitle(trimmedTitle, chapterTitle);
  }

  return derivedTitle || trimmedTitle || "Open reference";
}

function fileType(url: string) {
  if (url.startsWith("mailto:")) return "EMAIL";
  if (url.startsWith("tel:")) return "PHONE";

  const parsed = safeUrl(url);
  const fileParam = parsed?.searchParams.get("file");
  const filename = fileParam ? decodeURIComponent(fileParam) : parsed?.pathname ?? "";
  const ext = filename.match(/\.([a-z0-9]+)$/i)?.[1]?.toUpperCase();
  if (ext) return ext;
  return "LINK";
}

function fileTypeFromFilename(filename: string) {
  return filename.match(/\.([a-z0-9]+)$/i)?.[1]?.toUpperCase() ?? "FILE";
}

function fileTypeLabel(type: string) {
  const labels: Record<string, string> = {
    XLS: "Excel spreadsheet",
    XLSX: "Excel spreadsheet",
    PPT: "PowerPoint presentation",
    PPTX: "PowerPoint presentation",
    DOC: "Word document",
    DOCX: "Word document",
    PDF: "PDF document",
  };
  return labels[type] ?? type;
}

function referenceCategory(url: string): ReferenceCategory {
  if (url.startsWith("mailto:")) return "Emails";
  if (url.startsWith("tel:")) return "Phones";

  const type = fileType(url);
  if (needsReview(url)) return "Needs review";
  if (type !== "LINK") return "Files";
  return looksUsefulWebLink(url) ? "Links" : "Other";
}

function titleFromUrl(url: string, chapterTitle: string) {
  if (url.startsWith("mailto:")) {
    return `Email: ${decodeURIComponent(url.replace(/^mailto:/i, "")).split("?")[0]}`;
  }

  if (url.startsWith("tel:")) {
    return `Phone: ${decodeURIComponent(url.replace(/^tel:/i, ""))}`;
  }

  const parsed = safeUrl(url);
  if (!parsed) return "";

  const fileParam = parsed.searchParams.get("file");
  if (fileParam) {
    return prettifyReferenceTitle(decodeURIComponent(fileParam), chapterTitle);
  }

  const lastPath = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() ?? "").trim();
  if (lastPath && !looksOpaqueTitle(lastPath)) {
    return prettifyReferenceTitle(lastPath, chapterTitle);
  }

  return `${parsed.hostname.replace(/^www\./, "")} reference`;
}

function contactContext(url: string, nearbyText: string, chapterTitle: string) {
  const value = decodeURIComponent(url.replace(/^(mailto:|tel:)/i, "")).split("?")[0];
  if (!url.startsWith("mailto:") && !url.startsWith("tel:")) {
    return chapterTitle;
  }

  return knownContactContext(value) || contextFromText(nearbyText, value, chapterTitle);
}

function knownContactContext(value: string) {
  const normalized = value.includes("@") ? normalizeEmail(value) : phoneDialValue(value);
  const emailContexts: Record<string, string> = {
    "ask@flydubai.com": "General customer support / Ask flydubai",
    "cc.quality@flydubai.com": "Contact Centre Quality team",
    "cargo@flydubai.com": "Cargo team",
    "baggageservices@flydubai.com": "Baggage services",
    "businessteam@flydubai.com": "Business team",
    "groupreservations@flydubai.com": "Group reservations",
    "agencysupportuae@flydubai.com": "UAE travel agency support",
    "agencysupport@flydubai.com": "Travel agency support",
    "stafftravel@flydubai.com": "Staff travel",
    "fzgds@flydubai.com": "GDS support",
    "reservationsupport@flydubai.com": "Reservation support",
    "letstalk@flydubai.com": "Customer feedback / Let’s Talk",
    "fcc@flydubai.com": "FCC online check-in escalation",
    "itsd@flydubai.com": "IT service desk escalation",
  };
  if (emailContexts[normalized]) return emailContexts[normalized];

  const phoneContexts: Record<string, string> = {
    "+971600544445": "flydubai contact centre",
    "+74952151630": "Russia call center",
    "+9221111225539": "Pakistan call center",
    "+97146033556": "flydubai Cargo / UAE contact number",
    "046033556": "flydubai Cargo / UAE contact number",
    "+97142111111": "dnata Cargo",
    "+971503040810": "Business team SMS",
    "+97143139999": "UAE Visa Amir service",
    "8005111": "UAE Visa Amir service",
    "+97316199399": "Car rental",
    "+97146033555": "Car rental",
    "+97146033090": "Agency support team for outstation travel agents",
    "+9718006274222": "Marhaba airport service",
    "+971523829090": "DUBZ home check-in third-party support",
    "046033635": "NCC customer care, available 24 hours",
  };
  return phoneContexts[normalized] ?? "";
}

function contextFromText(text: string, needle: string, fallback: string) {
  const cleanLines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/[•▪#]+/g, "").trim())
    .filter(Boolean);
  const needleIndex = cleanLines.findIndex((line) =>
    line.toLowerCase().includes(needle.toLowerCase())
  );
  const candidates = (needleIndex >= 0 ? cleanLines.slice(Math.max(0, needleIndex - 4), needleIndex) : cleanLines)
    .filter((line) => !/^(step|note|important note|sk:|\d+\.?\d*)/i.test(line))
    .filter((line) => line.length >= 3 && line.length <= 90);
  return candidates.at(-1) ?? fallback;
}

function fileMentions(text: string) {
  return Array.from(
    text.matchAll(/([A-Za-z0-9][A-Za-z0-9 _.,&()'’+-]{2,}\.(?:pdf|pptx?|docx?|xlsx?))/gi),
    (match) => match[1].replace(/\s+/g, " ").trim()
  );
}

function contactMentions(text: string, fallback: string): ContactMention[] {
  const mentions: ContactMention[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) continue;

    const matches = [
      ...Array.from(line.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi), (match) => ({
        raw: match[0],
        index: match.index ?? 0,
        kind: "EMAIL" as const,
      })),
      ...Array.from(line.matchAll(/(?:\+\d[\d ().-]{6,}\d|\b(?:971|800|0)\d[\d ().-]{5,}\d\b)/g), (match) => ({
        raw: match[0],
        index: match.index ?? 0,
        kind: "PHONE" as const,
      })),
    ]
      .filter((match) => match.kind === "EMAIL" || isLikelyPhone(match.raw))
      .sort((a, b) => a.index - b.index);

    let cursor = 0;
    let lastLabel = "";
    for (const match of matches) {
      const label = contactLabelFromSegment(line.slice(cursor, match.index), lastLabel, fallback);
      const value =
        match.kind === "EMAIL" ? normalizeEmail(match.raw) : normalizePhoneDisplay(match.raw);
      const url =
        match.kind === "EMAIL" ? `mailto:${value}` : `tel:${phoneDialValue(value)}`;

      mentions.push({
        value,
        url,
        fileType: match.kind,
        category: match.kind === "EMAIL" ? "Emails" : "Phones",
        context: label,
      });

      lastLabel = label;
      cursor = match.index + match.raw.length;
    }
  }

  return mentions;
}

function isSuppressedContactList(text: string) {
  const normalized = text.toLowerCase();
  const travelAgentNames = [
    "smart travel",
    "clear tour",
    "travelers choice",
    "arooha",
    "go kite",
    "princess travel",
    "smart trip",
    "nawi saadi",
    "khyber",
    "hadaf",
    "akbar",
  ];
  const hits = travelAgentNames.filter((name) => normalized.includes(name)).length;
  return hits >= 5 && normalized.includes("visa change flights");
}

function isLikelyPhone(value: string) {
  if (isTimeRange(value)) return false;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  if (/^(19|20)\d{2}$/.test(digits)) return false;
  return /^(?:\+|0|971|800)/.test(value.trim());
}

function isTimeRange(value: string) {
  const match = value.trim().match(/^([01]\d|2[0-3])[:.]?([0-5]\d)\s*[-–]\s*([01]\d|2[0-3])[:.]?([0-5]\d)$/);
  return Boolean(match);
}

function contactKey(url: string) {
  const raw = decodeURIComponent(url)
    .replace(/^(mailto:|tel:)/i, "")
    .split("?")[0]
    .toLowerCase();
  return raw.includes("@") ? normalizeEmail(raw) : phoneDialValue(raw);
}

function normalizeEmail(value: string) {
  return value.trim().replace(/[),.;:]+$/g, "").toLowerCase();
}

function normalizePhoneDisplay(value: string) {
  return value
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+/g, "-")
    .trim();
}

function phoneDialValue(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (/^0[2-9]\d{7,8}$/.test(digits)) return `+971${digits.slice(1)}`;
  return digits;
}

function contactLabelFromSegment(segment: string, previousLabel: string, fallback: string) {
  const cleaned = segment
    .replace(/\b(?:email|mailbox|telephone|mobile|sms|call|team|number|contact|for|id)\b/gi, " ")
    .replace(/[:;,.()[\]{}#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length >= 3 && cleaned.length <= 70) return cleaned;
  return previousLabel || fallback;
}

function fileNameFromUrl(url: string) {
  const parsed = safeUrl(url);
  if (!parsed) return "";
  const fileParam = parsed.searchParams.get("file");
  if (fileParam) return decodeURIComponent(fileParam);
  return decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() ?? "");
}

function normalizedFileName(value: string) {
  return value
    .replace(/\.(pdf|pptx?|docx?|xlsx?)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function prettifyReferenceTitle(title: string, chapterTitle: string) {
  const withoutQuery = title.split("?")[0];
  const withoutExtension = withoutQuery.replace(/\.(pdf|pptx?|docx?|xlsx?)$/i, "");
  const words = withoutExtension
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = words.replace(/^(\d{4})\s+FZ\s+Newsletter$/i, "FZ Newsletter $1");

  if (/newsletter/i.test(normalized) && chapterTitle) {
    return `${normalized} - ${chapterTitle}`;
  }

  return normalized || title;
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

function needsReview(url: string) {
  const parsed = safeUrl(url);
  if (!parsed) return true;
  if (parsed.searchParams.get("file")?.match(/\.(pdf|pptx?|docx?|xlsx?)$/i)) return false;

  const lastPath = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() ?? "").trim();
  if (!lastPath) return fileType(url) === "LINK";
  if (looksOpaqueTitle(lastPath)) return true;
  if (/^open reference/i.test(lastPath)) return true;
  return false;
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
