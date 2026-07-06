import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SiteHeader } from "@/components/SiteHeader";
import { ChapterBadge } from "@/components/ChapterBadge";
import { ChapterTabbedContent } from "@/components/ChapterTabbedContent";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { ReportIssueButton } from "@/components/ReportIssueButton";
import { normalizeExternalUrl } from "@/lib/links";
import type { Chapter, ContentBlock } from "@/lib/types";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 60;

export default async function ChapterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { slug } = await params;
  const { section } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, chapter_number, title, slug, search_keywords, body_text, content_blocks, page_start, page_end, word_count, source_version, updated_at")
    .eq("slug", slug)
    .single();

  if (!chapter) notFound();

  const ch = chapter as Chapter;

  const { data: role } = user
    ? await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single()
    : { data: null };
  const canEdit = !!role && ["quality", "admin", "owner"].includes(role.role);

  const { data: neighbors } = await supabase
    .from("chapters")
    .select("chapter_number, title, slug")
    .in("chapter_number", [ch.chapter_number - 1, ch.chapter_number + 1]);

  const prev = neighbors?.find((n) => n.chapter_number === ch.chapter_number - 1);
  const next = neighbors?.find((n) => n.chapter_number === ch.chapter_number + 1);
  const chapterPath = `/chapter/${ch.slug}`;
  const overview = chapterOverview(ch);
  const references = keyReferences(ch.content_blocks);
  const sourceFacts = [
    ch.source_version ? { label: "Source", value: ch.source_version } : null,
    pageRange(ch.page_start, ch.page_end) ? { label: "Pages", value: pageRange(ch.page_start, ch.page_end) } : null,
    safeDate(ch.updated_at) ? { label: "Updated", value: safeDate(ch.updated_at) } : null,
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact));

  return (
    <div className="dashboard-shell flex min-h-full flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-ink-muted shadow-sm ring-1 ring-border transition-colors hover:text-accent"
        >
          &larr; Back to chapters
        </Link>

        <section className="hero-panel mb-6 overflow-hidden rounded-[22px]">
          <div className="grid gap-0 lg:grid-cols-[1fr_300px]">
            <div className="hero-main border-b border-border/80 p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <div className="flex items-start gap-4">
              <ChapterBadge number={ch.chapter_number} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                  Chapter {String(ch.chapter_number).padStart(2, "0")}
                </p>
                <h1 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
                  {ch.title}
                </h1>
                {sourceFacts.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {sourceFacts.map((fact) => (
                      <span
                        key={fact.label}
                        className="rounded-full border border-border bg-white/80 px-3 py-1 text-xs font-semibold text-ink-muted"
                      >
                        {fact.label}: <span className="text-ink">{fact.value}</span>
                      </span>
                    ))}
                  </div>
                )}
                {ch.search_keywords?.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {ch.search_keywords.slice(0, 8).map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-full border border-blue-200 bg-sky-soft px-3 py-1 text-xs font-medium text-sky"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <CopyLinkButton path={chapterPath} />
                  <ReportIssueButton chapterId={ch.id} chapterSlug={ch.slug} />
                {canEdit && (
                  <Link
                    href={`/admin/chapter/${ch.slug}`}
                      className="inline-flex rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-dim"
                  >
                    Edit chapter
                  </Link>
                )}
                </div>
              </div>
            </div>
          </div>

            <aside className="bg-white/75 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Source evidence
            </p>
              <dl className="mt-4 space-y-3 text-sm">
                <Fact label="Words" value={String(ch.word_count ?? "-")} />
                {ch.source_version && <Fact label="Source" value={ch.source_version} />}
                {pageRange(ch.page_start, ch.page_end) && (
                  <Fact label="Pages" value={pageRange(ch.page_start, ch.page_end)} />
                )}
                {safeDate(ch.updated_at) && <Fact label="Updated" value={safeDate(ch.updated_at)} />}
            </dl>
          </aside>
          </div>
        </section>

        <section className="section-band mb-6 p-4 sm:p-5 lg:p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="content-card quick-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Operational overview
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
                What this chapter is about
              </h2>
              {overview ? (
                <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-muted">{overview}</p>
              ) : (
                <p className="mt-3 text-sm leading-7 text-ink-muted">
                  Open the full manual content below for the extracted chapter details.
                </p>
              )}

              {ch.search_keywords?.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                    Best used for
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ch.search_keywords.slice(0, 10).map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-full border border-blue-200 bg-sky-soft px-3 py-1 text-xs font-semibold text-sky"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <a
                href="#manual-content"
                className="mt-5 inline-flex rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent"
              >
                Open full manual content
              </a>
            </div>

            <div className="content-card quick-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Linked references
              </p>
              {references.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {references.map((reference) =>
                    reference.url ? (
                      <a
                        key={`${reference.kind}-${reference.title}`}
                        href={reference.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-sky-soft px-3 py-2 text-xs font-semibold text-sky transition-colors hover:border-sky hover:bg-white"
                      >
                        <span className="truncate">{reference.title}</span>
                        <span className="shrink-0">Open</span>
                      </a>
                    ) : (
                      <div
                        key={`${reference.kind}-${reference.title}`}
                        className="rounded-lg border border-border bg-white px-3 py-2 text-xs text-ink-muted"
                      >
                        <span className="font-semibold text-ink">{reference.kind}</span>:{" "}
                        {reference.title}
                      </div>
                    )
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-ink-muted">
                  No separate linked references were detected for this chapter.
                </p>
              )}
            </div>
          </div>
        </section>

        <div id="manual-content" className="scroll-mt-24">
        <ChapterTabbedContent
          blocks={ch.content_blocks}
          activeSection={section}
          baseHref={`/chapter/${ch.slug}`}
          editHref={canEdit ? `/admin/chapter/${ch.slug}` : undefined}
        />
        </div>

        <nav className="mt-8 grid grid-cols-1 gap-3 border-t border-border pt-6 sm:grid-cols-2">
          {prev ? (
            <Link
              href={`/chapter/${prev.slug}`}
              className="content-card group p-4 text-left transition-colors hover:border-accent"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Previous
              </span>
              <span className="mt-1 block text-sm font-semibold text-ink group-hover:text-accent">
                {prev.title}
              </span>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={`/chapter/${next.slug}`}
              className="content-card group p-4 text-left transition-colors hover:border-accent sm:text-right"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Next
              </span>
              <span className="mt-1 block text-sm font-semibold text-ink group-hover:text-accent">
                {next.title}
              </span>
            </Link>
          ) : (
            <div />
          )}
        </nav>
      </main>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

function pageRange(start: number | null, end: number | null) {
  if (!start && !end) return "";
  if (start === end || !end) return String(start ?? end);
  return `${start}-${end}`;
}

function safeDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function chapterOverview(chapter: Chapter) {
  const source = chapter.body_text || textFromBlocks(chapter.content_blocks);
  return source
    .replace(/\s+/g, " ")
    .replace(/\(click me to view file\)/gi, "")
    .trim()
    .slice(0, 320);
}

function textFromBlocks(blocks: ContentBlock[]) {
  return blocks
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join(" ");
}

function keyReferences(blocks: ContentBlock[]) {
  const references: { kind: string; title: string; url?: string }[] = [];
  let imageCount = 0;

  for (const block of blocks) {
    if (references.length >= 5) break;

    if (block.type === "link" && block.url) {
      const url = normalizeExternalUrl(block.url);
      if (!url) continue;
      references.push({
        kind: "Link",
        title: safeReferenceTitle(block.title ?? block.text ?? "Open reference"),
        url,
      });
      continue;
    }

    if (block.type === "image" && block.url) {
      imageCount += 1;
      continue;
    }

    if (block.type === "text" && block.text) {
      const file = fileReferenceTitle(block.text);
      if (file) {
        references.push({ kind: "File", title: file });
      }
    }
  }

  if (imageCount > 0 && references.length < 5) {
    references.push({
      kind: "Images",
      title: `${imageCount} screenshot${imageCount === 1 ? "" : "s"} in context below`,
    });
  }

  return references;
}

function safeReferenceTitle(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 90);
}

function fileReferenceTitle(text: string) {
  const compact = text
    .replace(/\s+/g, " ")
    .replace(/\(click me to view file\)/gi, "")
    .trim();
  const match = compact.match(/([A-Za-z0-9][A-Za-z0-9 _.,&()'\u2019+-]{2,}\.(?:pdf|pptx?|docx?|xlsx?))/i);
  return match ? match[1].trim() : null;
}
