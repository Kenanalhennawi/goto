"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ChapterFileLink, ReferenceCategory } from "@/lib/content-links";
import { groupChapterFileLinks, matchesGroupedFileLink } from "@/lib/content-links";

type CategoryFilter = "All" | "Contacts" | ReferenceCategory;

const categoryOrder: CategoryFilter[] = [
  "All",
  "Files",
  "Contacts",
  "Emails",
  "Phones",
  "Links",
  "Needs review",
  "Other",
];

export function FilesSearchClient({
  links,
  types,
  initialQuery = "",
  initialType = "ALL",
}: {
  links: ChapterFileLink[];
  types: string[];
  initialQuery?: string;
  initialType?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedType, setSelectedType] = useState(initialType);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("Files");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const groupedLinks = useMemo(() => groupChapterFileLinks(links), [links]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<CategoryFilter, number>([["All", groupedLinks.length]]);
    for (const category of categoryOrder) counts.set(category, counts.get(category) ?? 0);
    for (const link of groupedLinks) {
      counts.set(link.reference_category, (counts.get(link.reference_category) ?? 0) + 1);
      if (isContact(link.reference_category)) {
        counts.set("Contacts", (counts.get("Contacts") ?? 0) + 1);
      }
    }
    return counts;
  }, [groupedLinks]);

  const filteredLinks = useMemo(
    () =>
      groupedLinks
        .filter((link) => {
          if (selectedCategory === "All") return true;
          if (selectedCategory === "Contacts") return isContact(link.reference_category);
          return link.reference_category === selectedCategory;
        })
        .filter((link) => selectedType === "ALL" || link.file_type === selectedType)
        .filter((link) => matchesGroupedFileLink(link, query)),
    [groupedLinks, query, selectedCategory, selectedType]
  );

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      window.setTimeout(() => setCopiedUrl(null), 1600);
    } catch {
      setCopiedUrl(null);
    }
  }

  return (
    <>
      <section className="mb-6 content-card p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Files and links
        </p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
              Manual references
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
              Find PDFs, SharePoint files, public links, emails, and phone references extracted from the guide.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search files, links, chapters..."
              className="min-w-0 rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent"
            />
            {selectedCategory === "Files" && (
              <select
                value={selectedType}
                onChange={(event) => setSelectedType(event.target.value)}
                className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium text-ink focus:border-accent"
              >
                <option value="ALL">All file types</option>
                {types
                  .filter((item) => !["EMAIL", "PHONE", "LINK"].includes(item))
                  .map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {categoryOrder.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => {
                setSelectedCategory(category);
                setSelectedType("ALL");
              }}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                selectedCategory === category
                  ? "border-accent bg-accent text-white"
                  : "border-border bg-white text-ink-muted hover:border-accent hover:text-accent"
              }`}
            >
              {category}{" "}
              <span className={selectedCategory === category ? "text-white/80" : "text-ink-faint"}>
                {categoryCounts.get(category) ?? 0}
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wider text-ink-faint">
        <span>
          {filteredLinks.length} unique references · {links.length} total uses
        </span>
        <Link href="/" className="font-semibold text-sky hover:text-accent">
          Back to manifest
        </Link>
      </div>

      <div className="grid gap-3">
        {filteredLinks.map((link, index) => (
          <article key={`${link.url}-${index}`} className="content-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-sky-soft px-2 py-1 text-[11px] font-semibold text-sky">
                    {link.reference_category}
                  </span>
                  <span className="rounded-md bg-panel px-2 py-1 text-[11px] font-semibold text-ink-muted">
                    {link.file_type}
                  </span>
                  <span className="text-xs font-medium text-ink-muted">
                    {isContact(link.reference_category) ? "Related to" : "Used in"} {link.chapters.length} chapter
                    {link.chapters.length === 1 ? "" : "s"}
                  </span>
                </div>
                <h2 className="truncate font-display text-base font-semibold text-ink">
                  {link.title}
                </h2>
                <ChapterUsage chapters={link.chapters} />
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => copyLink(link.url)}
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent"
                >
                  {copiedUrl === link.url ? "Copied" : "Copy"}
                </button>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-sky-soft px-4 py-2 text-sm font-semibold text-sky transition-colors hover:border-sky hover:bg-white"
                >
                  Open
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function isContact(category: ReferenceCategory) {
  return category === "Emails" || category === "Phones";
}

function shortTitle(title: string) {
  return title.length > 30 ? `${title.slice(0, 27)}...` : title;
}

function ChapterUsage({
  chapters,
}: {
  chapters: Array<{
    chapter_number: number;
    chapter_title: string;
    chapter_slug: string;
  }>;
}) {
  if (chapters.length <= 3) {
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chapters.map((chapter) => (
          <ChapterChip key={chapter.chapter_slug} chapter={chapter} />
        ))}
      </div>
    );
  }

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs font-semibold text-sky hover:text-accent">
        Show {chapters.length} chapters
      </summary>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chapters.map((chapter) => (
          <ChapterChip key={chapter.chapter_slug} chapter={chapter} />
        ))}
      </div>
    </details>
  );
}

function ChapterChip({
  chapter,
}: {
  chapter: {
    chapter_number: number;
    chapter_title: string;
    chapter_slug: string;
  };
}) {
  return (
    <Link
      href={`/chapter/${chapter.chapter_slug}`}
      title={chapter.chapter_title}
      className="rounded-md border border-border bg-white px-2 py-1 text-[11px] font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent"
    >
      {String(chapter.chapter_number).padStart(2, "0")} {shortTitle(chapter.chapter_title)}
    </Link>
  );
}
