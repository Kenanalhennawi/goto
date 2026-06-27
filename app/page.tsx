import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SiteHeader } from "@/components/SiteHeader";
import { SearchBar } from "@/components/SearchBar";
import { ChapterDirectory } from "@/components/ChapterDirectory";
import type { Chapter } from "@/lib/types";

export const revalidate = 60;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const { group } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, chapter_number, title, slug, search_keywords, word_count, updated_at")
    .order("chapter_number", { ascending: true });

  const list = (chapters ?? []) as Pick<
    Chapter,
    "id" | "chapter_number" | "title" | "slug" | "search_keywords" | "word_count" | "updated_at"
  >[];

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              flydubai contact centre
            </p>
            <h1 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              GO TO procedures, sorted for real desk work.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-ink-muted">
              Search the full manual, then browse by practical tabs so booking, airport,
              support, and reference procedures are easy to scan.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Stat label="Chapters" value={String(list.length || "-")} tone="orange" />
            <Stat label="Live search" value="On" tone="blue" />
            <Stat label="Mode" value="Guide" tone="green" />
          </div>
        </section>

        <section className="mb-7 content-card p-3 sm:p-4">
          <SearchBar autoFocus />
        </section>

        {list.length === 0 ? (
          <EmptyState />
        ) : (
          <ChapterDirectory chapters={list} activeGroupId={group} />
        )}
      </main>

      <footer className="border-t border-border bg-white/70 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>Internal flydubai contact centre reference. Not for external distribution.</span>
          <span className="font-mono">v80.8</span>
        </div>
      </footer>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "orange" | "blue" | "green";
}) {
  const tones = {
    orange: "bg-orange-50 text-accent border-orange-200",
    blue: "bg-sky-soft text-sky border-blue-200",
    green: "bg-mint-soft text-good border-green-200",
  };

  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <p className="font-display text-2xl font-semibold leading-none">{value}</p>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider opacity-75">
        {label}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="content-card p-12 text-center">
      <p className="font-display text-lg font-semibold text-ink">No chapters loaded yet</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
        Once the database is connected and a PDF sync has run, the manual will appear here.
      </p>
    </div>
  );
}
