import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { extractChapterFileLinks, matchesFileLink } from "@/lib/content-links";
import type { Chapter } from "@/lib/types";

export const revalidate = 60;

type ChapterLinkSource = Pick<Chapter, "chapter_number" | "title" | "slug" | "content_blocks">;

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q, type } = await searchParams;
  const query = q?.trim() ?? "";
  const selectedType = type?.trim().toUpperCase() ?? "ALL";
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("chapters")
    .select("chapter_number, title, slug, content_blocks")
    .order("chapter_number", { ascending: true });

  const allLinks = ((data as ChapterLinkSource[] | null) ?? []).flatMap(extractChapterFileLinks);
  const links = allLinks
    .filter((link) => selectedType === "ALL" || link.file_type === selectedType)
    .filter((link) => matchesFileLink(link, query));
  const types = Array.from(new Set(allLinks.map((link) => link.file_type))).sort();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
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
            <form className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <input
                name="q"
                defaultValue={query}
                placeholder="Search files..."
                className="min-w-0 rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent"
              />
              <select
                name="type"
                defaultValue={selectedType}
                className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium text-ink focus:border-accent"
              >
                <option value="ALL">All types</option>
                {types.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <button className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent">
                Search
              </button>
            </form>
          </div>
        </section>

        <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wider text-ink-faint">
          <span>{links.length} references</span>
          <Link href="/" className="font-semibold text-sky hover:text-accent">
            Back to manifest
          </Link>
        </div>

        <div className="grid gap-3">
          {links.map((link, index) => (
            <article key={`${link.url}-${index}`} className="content-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-md bg-sky-soft px-2 py-1 text-[11px] font-semibold text-sky">
                      {link.file_type}
                    </span>
                    <Link
                      href={`/chapter/${link.chapter_slug}`}
                      className="text-xs font-medium text-ink-muted hover:text-accent"
                    >
                      Ch. {String(link.chapter_number).padStart(2, "0")} - {link.chapter_title}
                    </Link>
                  </div>
                  <h2 className="truncate font-display text-base font-semibold text-ink">
                    {link.title}
                  </h2>
                  <p className="mt-1 truncate text-xs text-ink-faint">{link.url}</p>
                </div>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-sky-soft px-4 py-2 text-sm font-semibold text-sky transition-colors hover:border-sky hover:bg-white"
                >
                  Open
                </a>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
