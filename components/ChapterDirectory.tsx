import Link from "next/link";
import { ChapterBadge } from "@/components/ChapterBadge";
import type { Chapter } from "@/lib/types";

type DirectoryChapter = Pick<
  Chapter,
  "id" | "chapter_number" | "title" | "slug" | "search_keywords" | "word_count" | "updated_at"
>;

const GROUPS = [
  {
    id: "essentials",
    label: "Essentials",
    description: "Daily scripts, contact info, CRM, and core agent tools.",
    range: [1, 10],
  },
  {
    id: "booking",
    label: "Booking",
    description: "Fares, PNRs, tickets, payments, modifications, and SSRs.",
    range: [11, 40],
  },
  {
    id: "airport",
    label: "Airport",
    description: "Check-in, baggage, lounges, transfers, and airport handling.",
    range: [41, 65],
  },
  {
    id: "support",
    label: "Support",
    description: "Disruptions, refunds, edge cases, and service recovery.",
    range: [66, 73],
  },
  {
    id: "reference",
    label: "Reference",
    description: "Remaining policies, appendices, and quick lookup material.",
    range: [74, 999],
  },
];

export function ChapterDirectory({
  chapters,
  activeGroupId = "essentials",
}: {
  chapters: DirectoryChapter[];
  activeGroupId?: string;
}) {
  const grouped = GROUPS.map((group) => ({
    ...group,
    chapters: chapters.filter(
      (chapter) =>
        chapter.chapter_number >= group.range[0] &&
        chapter.chapter_number <= group.range[1]
    ),
  }));

  const activeGroup =
    grouped.find((group) => group.id === activeGroupId) ?? grouped[0];
  const highlighted = activeGroup.chapters[0];

  return (
    <section className="space-y-5">
      <div className="flex gap-2 overflow-x-auto rounded-xl border border-border bg-white p-2 soft-shadow">
        {grouped.map((group) => (
          <Link
            key={group.id}
            href={`/?group=${group.id}`}
            className={`min-w-max rounded-lg px-4 py-3 text-left transition-colors ${
              group.id === activeGroup.id
                ? "bg-accent text-white shadow-sm"
                : "text-ink-muted hover:bg-sky-soft hover:text-sky"
            }`}
          >
            <span className="block font-display text-sm font-semibold">{group.label}</span>
            <span
              className={`block text-[11px] ${
                group.id === activeGroup.id ? "text-white/80" : "text-ink-faint"
              }`}
            >
              {group.chapters.length} chapters
            </span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.95fr_2fr]">
        <aside className="content-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            {activeGroup.label}
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
            {activeGroup.description}
          </h2>
          {highlighted && (
            <Link
              href={`/chapter/${highlighted.slug}`}
              className="group mt-6 block rounded-lg border border-border bg-sky-soft p-4 transition-colors hover:border-sky"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-sky">
                Start here
              </span>
              <div className="mt-3 flex items-start gap-3">
                <ChapterBadge number={highlighted.chapter_number} size="sm" />
                <div>
                  <p className="font-display text-sm font-semibold text-ink group-hover:text-sky">
                    {highlighted.title}
                  </p>
                  <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-ink-muted">
                    {chapterUse(highlighted)}
                  </p>
                </div>
              </div>
            </Link>
          )}
        </aside>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {activeGroup.chapters.map((chapter) => (
            <Link
              key={chapter.id}
              href={`/chapter/${chapter.slug}`}
              className="group content-card flex items-start gap-3 p-4 transition-all hover:-translate-y-0.5 hover:border-accent hover:bg-panel-hover"
            >
              <ChapterBadge number={chapter.chapter_number} size="sm" />
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-sm font-semibold leading-snug text-ink group-hover:text-accent">
                  {chapter.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">
                  {chapterUse(chapter)}
                </p>
                {chapter.search_keywords?.length > 0 && (
                  <p className="mt-2 line-clamp-1 text-[11px] font-medium text-sky">
                    {chapter.search_keywords.slice(0, 4).join(" / ")}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function chapterUse(chapter: DirectoryChapter) {
  const keywords = chapter.search_keywords?.slice(0, 3).join(", ");
  if (keywords) return `Use for: ${keywords}. ${chapter.word_count ?? 0} words.`;
  return `Open for steps, rules, references, and screenshots. ${chapter.word_count ?? 0} words.`;
}
