import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SiteHeader } from "@/components/SiteHeader";
import { AgentPage } from "@/components/agent/AgentPage";
import { ChapterTabbedContent } from "@/components/ChapterTabbedContent";
import { CollapsibleManualContent } from "@/components/chapter/CollapsibleManualContent";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { RecentTracker } from "@/components/RecentTracker";
import { ReportIssueButton } from "@/components/ReportIssueButton";
import { fetchRelatedCards } from "@/lib/fetch-related-cards";
import { getWorkflowAvailability } from "@/lib/decision-engine/availability";
import { normalizeExternalUrl } from "@/lib/links";
import type { Chapter, ContentBlock, ProcedureCard } from "@/lib/types";
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
    ? await supabase.from("user_roles").select("role").eq("user_id", user.id).single()
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
  // Ordinary agents only ever see published+approved related cards.
  const relatedCards = (await fetchRelatedCards(supabase, ch, { includeDrafts: canReviewCards })) as ProcedureCard[];
  const agentRelated = relatedCards
    .filter((card) => card.is_published && card.review_status === "approved")
    .slice(0, 5);

  return (
    <div className="dashboard-shell flex min-h-full flex-col">
      <SiteHeader />
      <RecentTracker kind="chapter" slug={ch.slug} title={ch.title} />

      <AgentPage>
        <Link
          href="/search"
          className="agent-secondary touch-target inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold focus-visible:outline-none"
        >
          &larr; Back to search
        </Link>

        {/* Plain title + short source-reference explanation (no chapter number,
            source version, or review metadata at the top for agents). */}
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Source reference</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{ch.title}</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-muted">
          This page contains the original manual content. Use the related operational guidance first when available.
        </p>
        {overview ? <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">{overview}</p> : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CopyLinkButton path={chapterPath} />
          <ReportIssueButton chapterId={ch.id} chapterSlug={ch.slug} />
        </div>

        {/* Related operational guidance — first, before the manual */}
        <section className="mt-8" aria-label="Related operational guidance">
          <h2 className="font-display text-base font-semibold text-ink">Related operational guidance</h2>
          {agentRelated.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">
              No reviewed operational guidance is linked to this source yet.
            </p>
          ) : (
            <div className="mt-3 space-y-2.5">
              {agentRelated.map((card) => {
                const availability = getWorkflowAvailability({
                  slug: card.slug,
                  is_published: true,
                  review_status: "approved",
                  source_version: card.source_version,
                });
                return (
                  <article key={card.id} className="rounded-xl border border-border bg-white p-4">
                    <h3 className="font-display text-[15px] font-semibold text-ink">{card.title}</h3>
                    {card.summary ? (
                      <p className="mt-0.5 text-sm leading-6 text-ink-muted">{card.summary}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/procedure/${card.slug}`}
                        className="agent-secondary touch-target inline-flex items-center rounded-lg px-3.5 py-2 text-xs font-semibold focus-visible:outline-none"
                      >
                        Open procedure
                      </Link>
                      {availability.available ? (
                        <Link
                          href={`/decision?procedure=${encodeURIComponent(card.slug)}`}
                          className="agent-secondary touch-target inline-flex items-center rounded-lg px-3.5 py-2 text-xs font-semibold focus-visible:outline-none"
                        >
                          Guided decision
                        </Link>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Full source manual — collapsed, preserves fidelity (tables, images, links) */}
        <div className="mt-8">
          <CollapsibleManualContent defaultOpen={Boolean(section)}>
            <ChapterTabbedContent
              blocks={ch.content_blocks}
              activeSection={section}
              baseHref={`/chapter/${ch.slug}`}
              editHref={canEdit ? `/admin/chapter/${ch.slug}` : undefined}
            />
          </CollapsibleManualContent>
        </div>

        {/* Source details — role-gated (reviewers/admins only) */}
        {canReviewCards ? (
          <SourceDetails chapter={ch} references={references} linkedCount={relatedCards.length} canEdit={canEdit} />
        ) : null}

        {/* Chapter navigation (plain titles) */}
        <nav className="mt-8 grid grid-cols-1 gap-3 border-t border-border pt-6 sm:grid-cols-2" aria-label="Chapter navigation">
          {prev ? (
            <Link href={`/chapter/${prev.slug}`} className="agent-tile touch-target p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Previous</span>
              <span className="mt-0.5 block text-sm font-semibold text-ink">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/chapter/${next.slug}`} className="agent-tile touch-target p-4 sm:text-right">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Next</span>
              <span className="mt-0.5 block text-sm font-semibold text-ink">{next.title}</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </AgentPage>
    </div>
  );
}

function SourceDetails({
  chapter,
  references,
  linkedCount,
  canEdit,
}: {
  chapter: Chapter;
  references: { kind: string; title: string; url?: string }[];
  linkedCount: number;
  canEdit: boolean;
}) {
  return (
    <details className="mt-6 rounded-xl border border-dashed border-border bg-white/70">
      <summary className="touch-target flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Source details (reviewers only)
        </span>
        <span className="rounded border border-border bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
          Chapter {String(chapter.chapter_number).padStart(2, "0")}
        </span>
      </summary>
      <div className="border-t border-border px-4 py-3">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {chapter.source_version ? <SourceFact label="Source version" value={chapter.source_version} /> : null}
          {safeDate(chapter.updated_at) ? <SourceFact label="Updated" value={safeDate(chapter.updated_at)} /> : null}
          {pageRange(chapter.page_start, chapter.page_end) ? (
            <SourceFact label="Pages" value={pageRange(chapter.page_start, chapter.page_end)} />
          ) : null}
          <SourceFact label="Linked procedures" value={String(linkedCount)} />
          {chapter.word_count ? <SourceFact label="Words" value={String(chapter.word_count)} /> : null}
        </dl>
        {references.length > 0 ? (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Linked references</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
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
        ) : null}
        {canEdit ? (
          <Link
            href={`/admin/chapter/${chapter.slug}`}
            className="agent-secondary touch-target mt-3 inline-flex items-center rounded-lg px-3.5 py-2 text-xs font-semibold focus-visible:outline-none"
          >
            Edit chapter
          </Link>
        ) : null}
      </div>
    </details>
  );
}

function SourceFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5 last:border-0">
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
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", year: "numeric" }).format(date);
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
      references.push({ kind: "Link", title: safeReferenceTitle(block.title ?? block.text ?? "Open reference"), url });
      continue;
    }
    if (block.type === "image" && block.url) {
      imageCount += 1;
      continue;
    }
    if (block.type === "text" && block.text) {
      const file = fileReferenceTitle(block.text);
      if (file) references.push({ kind: "File", title: file });
    }
  }

  if (imageCount > 0 && references.length < 5) {
    references.push({ kind: "Images", title: `${imageCount} screenshot${imageCount === 1 ? "" : "s"} in context below` });
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
  const match = compact.match(/([A-Za-z0-9][A-Za-z0-9 _.,&()'’+-]{2,}\.(?:pdf|pptx?|docx?|xlsx?))/i);
  return match ? match[1].trim() : null;
}
