import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SiteHeader } from "@/components/SiteHeader";
import { ChapterBadge } from "@/components/ChapterBadge";
import { ChapterTabbedContent } from "@/components/ChapterTabbedContent";
import { ReportIssueButton } from "@/components/ReportIssueButton";
import type { Chapter } from "@/lib/types";
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

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-ink-muted shadow-sm ring-1 ring-border transition-colors hover:text-accent"
        >
          &larr; Back to chapters
        </Link>

        <section className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
          <div className="content-card p-6">
            <div className="flex items-start gap-4">
              <ChapterBadge number={ch.chapter_number} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                  Chapter {String(ch.chapter_number).padStart(2, "0")}
                </p>
                <h1 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight text-ink">
                  {ch.title}
                </h1>
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
                {canEdit && (
                  <Link
                    href={`/admin/chapter/${ch.slug}`}
                    className="mt-5 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-dim"
                  >
                    Edit chapter
                  </Link>
                )}
                <ReportIssueButton chapterId={ch.id} chapterSlug={ch.slug} />
              </div>
            </div>
          </div>

          <aside className="content-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Quick facts
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <Fact label="Words" value={String(ch.word_count ?? "-")} />
              <Fact label="Source" value={ch.source_version ?? "Manual"} />
              <Fact label="Pages" value={pageRange(ch.page_start, ch.page_end)} />
            </dl>
          </aside>
        </section>

        <ChapterTabbedContent
          blocks={ch.content_blocks}
          activeSection={section}
          baseHref={`/chapter/${ch.slug}`}
          editHref={canEdit ? `/admin/chapter/${ch.slug}` : undefined}
        />

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
  if (!start && !end) return "-";
  if (start === end || !end) return String(start);
  return `${start}-${end}`;
}
