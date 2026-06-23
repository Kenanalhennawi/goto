import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SiteHeader } from "@/components/SiteHeader";
import { ChapterBadge } from "@/components/ChapterBadge";
import { ChapterImageGallery } from "@/components/ChapterImageGallery";
import type { ChapterWithImages } from "@/lib/types";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 60;

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: chapter } = await supabase
    .from("chapters")
    .select("*, chapter_images(*)")
    .eq("slug", slug)
    .single();

  if (!chapter) notFound();

  const ch = chapter as ChapterWithImages;
  const paragraphs = ch.body_text.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  // Fetch prev/next for sequential navigation, since agents often work chapter-by-chapter
  const { data: neighbors } = await supabase
    .from("chapters")
    .select("chapter_number, title, slug")
    .in("chapter_number", [ch.chapter_number - 1, ch.chapter_number + 1]);

  const prev = neighbors?.find((n) => n.chapter_number === ch.chapter_number - 1);
  const next = neighbors?.find((n) => n.chapter_number === ch.chapter_number + 1);

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
        <Link href="/" className="text-xs text-ink-muted hover:text-accent transition-colors inline-flex items-center gap-1 mb-6">
          ← Back to manifest
        </Link>

        <div className="flex items-start gap-4 mb-2">
          <ChapterBadge number={ch.chapter_number} size="lg" />
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink leading-tight">
              {ch.title}
            </h1>
            <p className="text-xs text-ink-faint mt-1 font-mono">
              {ch.page_start && ch.page_end ? `GO TO pages ${ch.page_start}–${ch.page_end}` : ""}
              {ch.source_version ? ` · v${ch.source_version}` : ""}
            </p>
          </div>
        </div>

        {ch.search_keywords?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4 mb-8">
            {ch.search_keywords.map((kw) => (
              <span
                key={kw}
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-panel border border-border text-ink-faint"
              >
                {kw}
              </span>
            ))}
          </div>
        )}

        <article className="prose-content space-y-4">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-[15px] leading-relaxed text-ink whitespace-pre-line">
              {p.trim()}
            </p>
          ))}
        </article>

        <ChapterImageGallery images={ch.chapter_images} />

        <nav className="mt-12 pt-6 border-t border-border flex items-center justify-between gap-4">
          {prev ? (
            <Link
              href={`/chapter/${prev.slug}`}
              className="flex-1 text-left group"
            >
              <span className="text-xs text-ink-faint block">← Previous</span>
              <span className="text-sm text-ink-muted group-hover:text-accent transition-colors line-clamp-1">
                {prev.title}
              </span>
            </Link>
          ) : (
            <div className="flex-1" />
          )}
          {next ? (
            <Link
              href={`/chapter/${next.slug}`}
              className="flex-1 text-right group"
            >
              <span className="text-xs text-ink-faint block">Next →</span>
              <span className="text-sm text-ink-muted group-hover:text-accent transition-colors line-clamp-1">
                {next.title}
              </span>
            </Link>
          ) : (
            <div className="flex-1" />
          )}
        </nav>
      </main>
    </div>
  );
}
