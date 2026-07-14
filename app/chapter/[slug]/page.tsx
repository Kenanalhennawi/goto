import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SiteHeader } from "@/components/SiteHeader";
import { ChapterBadge } from "@/components/ChapterBadge";
import { ChapterTabbedContent } from "@/components/ChapterTabbedContent";
import { CollapsibleManualContent } from "@/components/chapter/CollapsibleManualContent";
import { OperationalSummary } from "@/components/chapter/OperationalSummary";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { RecentTracker } from "@/components/RecentTracker";
import { ReportIssueButton } from "@/components/ReportIssueButton";
import { fetchRelatedCards } from "@/lib/fetch-related-cards";
import { normalizeExternalUrl } from "@/lib/links";
import type { Chapter, ContentBlock } from "@/lib/types";
import { canEditProcedures, canReviewProcedures } from "@/lib/permissions";
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
  const canEdit = canEditProcedures(role?.role);
  const canReviewCards = canReviewProcedures(role?.role);

  const { data: neighbors } = await supabase
    .from("chapters")
    .select("chapter_number, title, slug")
    .in("chapter_number", [ch.chapter_number - 1, ch.chapter_number + 1]);

  const prev = neighbors?.find((n) => n.chapter_number === ch.chapter_number - 1);
  const next = neighbors?.find((n) => n.chapter_number === ch.chapter_number + 1);
  const chapterPath = `/chapter/${ch.slug}`;
  const overview = chapterOverview(ch);
  const references = keyReferences(ch.content_blocks);
  const relatedCards = await fetchRelatedCards(supabase, ch, { includeDrafts: canReviewCards });

  return (
    <div className="dashboard-shell flex min-h-full flex-col">
      <SiteHeader />
      <RecentTracker kind="chapter" slug={ch.slug} title={ch.title} />

      <div className="glass-light sticky top-[3.25rem] z-30 border-b border-border lg:top-0">
        <div className="mx-auto flex h-11 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <span className="shrink-0 rounded-sm border border-orange-200 bg-orange-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-accent">
            Ch. {String(ch.chapter_number).padStart(2, "0")}
          </span>
          <span className="truncate text-sm font-semibold text-ink">{ch.title}</span>
          <nav className="ml-auto flex shrink-0 items-center gap-0.5" aria-label="Chapter sections">
            {["guide", "steps", "rules", "images"].map((tab) => (
              <Link
                key={tab}
                href={`/chapter/${ch.slug}?section=${tab}`}
                className={`rounded px-2 py-1 text-xs font-semibold capitalize transition-colors ${
                  (section ?? "guide") === tab
                    ? "bg-navy text-white"
                    : "text-ink-muted hover:bg-sky-soft hover:text-sky"
                }`}
              >
                {tab}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
        <Link
          href="/"
          className="mb-5 inline-flex items-center gap-2 rounded border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent"
        >
          &larr; Back to chapters
        </Link>

        <section className="hero-panel mb-5 overflow-hidden rounded-lg">
          <div className="hero-main p-5">
              <div className="flex items-start gap-4">
              <div className="opacity-70">
                <ChapterBadge number={ch.chapter_number} size="lg" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                  Agent operational guide
                </p>
                <h1 className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">
                  {ch.title}
                </h1>
                {ch.search_keywords?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {ch.search_keywords.slice(0, 8).map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-sm border border-blue-200 bg-sky-soft px-2 py-0.5 text-xs font-medium text-sky"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <CopyLinkButton path={chapterPath} />
                  <ReportIssueButton chapterId={ch.id} chapterSlug={ch.slug} />
                {canEdit && (
                  <Link
                    href={`/admin/chapter/${ch.slug}`}
                      className="inline-flex rounded bg-accent px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-dim"
                  >
                    Edit chapter
                  </Link>
                )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-band mb-5 p-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="content-card quick-card p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                Operational overview
              </p>
              <h2 className="mt-1.5 font-display text-lg font-semibold text-ink">
                What this chapter is about
              </h2>
              {overview ? (
                <p className="mt-2.5 max-w-3xl text-sm leading-6 text-ink-muted">{overview}</p>
              ) : (
                <p className="mt-2.5 text-sm leading-6 text-ink-muted">
                  Open the full manual content below for the extracted chapter details.
                </p>
              )}

              {ch.search_keywords?.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                    Best used for
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ch.search_keywords.slice(0, 10).map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-sm border border-blue-200 bg-sky-soft px-2 py-0.5 text-xs font-semibold text-sky"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <a
                href="#manual-content"
                className="mt-4 inline-flex rounded bg-navy px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent"
              >
                Open full manual content
              </a>
            </div>

            <div className="content-card quick-card p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                Linked references
              </p>
              {references.length > 0 ? (
                <div className="mt-3 space-y-1.5">
                  {references.map((reference) =>
                    reference.url ? (
                      <a
                        key={`${reference.kind}-${reference.title}`}
                        href={reference.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-sky-soft px-3 py-2 text-xs font-semibold text-sky transition-colors hover:border-sky hover:bg-white"
                      >
                        <span className="truncate">{reference.title}</span>
                        <span className="shrink-0">Open</span>
                      </a>
                    ) : (
                      <div
                        key={`${reference.kind}-${reference.title}`}
                        className="rounded-md border border-border bg-white px-3 py-2 text-xs text-ink-muted"
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

        <OperationalSummary
          cards={relatedCards}
          canReview={canReviewCards}
          showEmpty={canReviewCards}
        />

        <SourceAuditDetails chapter={ch} references={references} />

        <CollapsibleManualContent defaultOpen={Boolean(section)}>
          <ChapterTabbedContent
            blocks={ch.content_blocks}
            activeSection={section}
            baseHref={`/chapter/${ch.slug}`}
            editHref={canEdit ? `/admin/chapter/${ch.slug}` : undefined}
          />
        </CollapsibleManualContent>

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

function SourceAuditDetails({
  chapter,
  references,
}: {
  chapter: Chapter;
  references: { kind: string; title: string; url?: string }[];
}) {
  return (
    <details className="content-card mb-6 overflow-hidden">
      <summary className="cursor-pointer list-none px-5 py-4 marker:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint">
              Source & audit details
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              PDF source information and extracted references.
            </p>
          </div>
          <span className="rounded border border-border bg-white px-3 py-1 text-xs font-semibold text-ink-muted">
            Show audit details
          </span>
        </div>
      </summary>
      <div className="border-t border-border p-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Chapter" value={String(chapter.chapter_number).padStart(2, "0")} />
          <Fact label="Words" value={String(chapter.word_count ?? "-")} />
          {chapter.source_version && <Fact label="Source" value={chapter.source_version} />}
          {pageRange(chapter.page_start, chapter.page_end) && (
            <Fact label="Pages" value={pageRange(chapter.page_start, chapter.page_end)} />
          )}
          {safeDate(chapter.updated_at) && <Fact label="Last updated" value={safeDate(chapter.updated_at)} />}
        </dl>

        {references.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Linked references
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {references.map((reference) =>
                reference.url ? (
                  <a
                    key={`${reference.kind}-${reference.title}`}
                    href={reference.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded border border-blue-200 bg-sky-soft px-2.5 py-1 text-xs font-semibold text-sky hover:bg-white"
                  >
                    {reference.title}
                  </a>
                ) : (
                  <span
                    key={`${reference.kind}-${reference.title}`}
                    className="rounded border border-border bg-slate-50 px-2.5 py-1 text-xs font-semibold text-ink-muted"
                  >
                    {reference.kind}: {reference.title}
                  </span>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </details>
  );
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
