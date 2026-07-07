import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SiteHeader } from "@/components/SiteHeader";
import { SearchBar } from "@/components/SearchBar";
import { ChapterDirectory } from "@/components/ChapterDirectory";
import type { Chapter, JsonValue } from "@/lib/types";

export const revalidate = 60;

type HomeChapter = Pick<
  Chapter,
  | "id"
  | "chapter_number"
  | "title"
  | "slug"
  | "search_keywords"
  | "word_count"
  | "updated_at"
  | "source_version"
>;

type HomeServiceCard = {
  id: string;
  title: string;
  slug: string;
  category: string;
  service_code: string | null;
  service_type: string | null;
  cut_off_time: string | null;
  channels: JsonValue[] | null;
  priority: number | null;
};

const HERO_SHORTCUTS = [
  ["MCT", "MCT"],
  ["EXST", "EXST"],
  ["CBBG", "CBBG"],
  ["FDIS", "FDIS"],
  ["OLCI", "OLCI"],
  ["Falcon", "Falcon"],
  ["Auto Split", "Auto Split OD"],
  ["Dubai Stopover", "Dubai Stopover"],
  ["Sporting Equipment", "Sporting Equipment"],
  ["Name Correction", "Name Correction"],
];

const WORK_MODES = [
  {
    title: "Booking & Changes",
    line: "PNR, fares, names, seats.",
    query: "booking changes PNR name correction seat",
    chips: ["PNR", "Names", "Seats"],
  },
  {
    title: "Airport / Check-in",
    line: "OLCI, DCS, boarding, terminals.",
    query: "airport check-in OLCI DCS terminal",
    chips: ["OLCI", "DCS", "Terminal"],
  },
  {
    title: "Baggage & SSR",
    line: "Bags, SSRs, special handling.",
    query: "baggage SSR WorldTracer SPEQ",
    chips: ["Baggage", "SSR", "WT"],
  },
  {
    title: "Disruption",
    line: "FDIS, schedule changes, recovery.",
    query: "FDIS flight disruption schedule change",
    chips: ["FDIS", "Delay", "Recovery"],
  },
  {
    title: "Special Assistance",
    line: "Wheelchair, medical, service cases.",
    query: "WCHR WCHS WCHC MEDA DPNA",
    chips: ["WCHR", "MEDA", "DPNA"],
  },
  {
    title: "References",
    line: "Contacts, files, source material.",
    query: "contact details references files",
    chips: ["Contacts", "Files", "Source"],
  },
];

const CRITICAL_SHORTCUTS = [
  ["MCT", "MCT"],
  ["Auto Split OD", "Auto Split OD"],
  ["Dubai Stopover", "Dubai Stopover"],
  ["Lounge OLCI", "lounge access OLCI"],
  ["EXST / CBBG", "EXST CBBG extra seat"],
  ["Sporting Equipment", "SPEQ sporting equipment"],
  ["Falcon Handling", "falcon handling"],
  ["Baggage Upgrade", "baggage upgrade"],
  ["Wheelchair", "WCHR WCHS WCHC wheelchair"],
  ["Interline", "interline connection"],
  ["Government Deals", "government deals"],
];

const QUICK_CHECKS = [
  ["Cut-off times", "cut off time service deadline"],
  ["Add service", "add service SSR"],
  ["SSR codes", "SSR codes"],
  ["Baggage / CBBG", "baggage CBBG"],
  ["Check-in / OLCI", "check-in OLCI"],
  ["Disruption / FDIS", "disruption FDIS"],
  ["Special assistance", "special assistance WCHR MEDA"],
  ["Connection / MCT", "connection MCT minimum connection time"],
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const { group } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, chapter_number, title, slug, search_keywords, word_count, updated_at, source_version")
    .order("chapter_number", { ascending: true });
  const { data: serviceCards } = await supabase
    .from("procedure_cards")
    .select("id, title, slug, category, service_code, service_type, cut_off_time, channels, priority")
    .eq("is_published", true)
    .eq("review_status", "approved")
    .order("priority", { ascending: false })
    .order("title", { ascending: true })
    .limit(12);

  const list = ((chapters ?? []) as HomeChapter[]).filter(Boolean);
  const services = ((serviceCards ?? []) as HomeServiceCard[]).filter(Boolean);
  const recentlyUpdated = [...list]
    .filter((chapter) => Boolean(chapter.updated_at))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);
  const sourceVersion = latestSourceVersion(list);
  const lastUpdated = recentlyUpdated[0]?.updated_at;

  return (
    <div className="dashboard-shell flex min-h-full flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
        <section className="hero-panel mb-6 overflow-hidden rounded-[22px]">
          <div className="hero-main p-5 sm:p-7 lg:p-9">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
                  Command center
                </p>
                <h1 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
                  GO TO Contact Centre Guide
                </h1>
                <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-sky">
                  Operational service console
                </p>
                <p className="mt-3 max-w-2xl text-lg font-medium text-ink-muted">
                  Find cut-off times, service rules, allowed channels, and agent actions fast.
                </p>
              </div>
              <MetaStrip
                chapters={list.length}
                sourceVersion={sourceVersion}
                lastUpdated={lastUpdated}
              />
            </div>

            <div className="hero-search mt-7 rounded-2xl p-3">
              <SearchBar autoFocus />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {HERO_SHORTCUTS.map(([label, query]) => (
                <ShortcutChip key={label} label={label} query={query} />
              ))}
            </div>
          </div>
        </section>

        {list.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            <section className="service-console-grid">
              <div className="content-card service-console-panel p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                      Service cards
                    </p>
                    <h2 className="font-display text-2xl font-semibold text-ink">
                      Operational Service Cards
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-ink-faint">
                    Approved and published only
                  </span>
                </div>

                {services.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {services.map((service) => (
                      <ServiceCard key={service.id} service={service} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-blue-200 bg-sky-soft/50 p-6 text-sm text-ink-muted">
                    <p className="font-semibold text-ink">No published service cards yet.</p>
                    <p className="mt-1">Approved service cards will appear here.</p>
                  </div>
                )}
              </div>

              <aside className="content-card p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                  Quick checks
                </p>
                <h2 className="mt-1 font-display text-xl font-semibold text-ink">
                  Quick operational checks
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {QUICK_CHECKS.map(([label, query]) => (
                    <ShortcutChip key={label} label={label} query={query} />
                  ))}
                </div>
              </aside>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-display text-xl font-semibold text-ink">Work modes</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {WORK_MODES.map((mode) => (
                  <WorkModeCard key={mode.title} mode={mode} />
                ))}
              </div>
            </section>

            <section className="content-card p-4">
              <h2 className="mb-3 font-display text-lg font-semibold text-ink">
                Critical shortcuts
              </h2>
              <div className="flex flex-wrap gap-2">
                {CRITICAL_SHORTCUTS.map(([label, query]) => (
                  <ShortcutChip key={label} label={label} query={query} />
                ))}
              </div>
            </section>

            {recentlyUpdated.length > 0 && (
              <section className="content-card overflow-hidden">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="font-display text-lg font-semibold text-ink">Recent updates</h2>
                </div>
                <div className="divide-y divide-border">
                  {recentlyUpdated.map((chapter) => (
                    <Link
                      key={chapter.id}
                      href={`/chapter/${chapter.slug}`}
                      className="grid gap-2 px-4 py-3 text-sm transition-colors hover:bg-panel-hover sm:grid-cols-[72px_1fr_auto]"
                    >
                      <span className="font-mono text-xs font-semibold text-accent">
                        Ch. {String(chapter.chapter_number).padStart(2, "0")}
                      </span>
                      <span className="font-semibold text-ink">{chapter.title}</span>
                      <span className="text-xs text-ink-faint">{compactDate(chapter.updated_at)}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <details className="content-card group overflow-hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
                <span>
                  <span className="block font-display text-lg font-semibold text-ink">
                    Browse all chapters
                  </span>
                  <span className="mt-1 block text-xs text-ink-muted">
                    Open the full manual directory when you need chapter-by-chapter browsing.
                  </span>
                </span>
                <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-sky group-open:text-accent">
                  Open
                </span>
              </summary>
              <div className="border-t border-border p-4">
                <ChapterDirectory chapters={list} activeGroupId={group} />
              </div>
            </details>
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-white/70 py-5 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>Internal flydubai contact centre reference. Not for external distribution.</span>
          <span className="font-mono">{sourceVersion ?? "Source version shown per chapter"}</span>
        </div>
      </footer>
    </div>
  );
}

function ServiceCard({ service }: { service: HomeServiceCard }) {
  const channels = readableItems(service.channels).slice(0, 3);
  const serviceMeta = service.service_type || service.category;

  return (
    <Link
      href={`/procedure/${service.slug}`}
      className="service-card group flex min-h-44 flex-col justify-between rounded-2xl border border-blue-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
    >
      <span>
        <span className="mb-3 flex flex-wrap items-center gap-2">
          {service.service_code && (
            <span className="rounded-lg bg-accent-soft px-2.5 py-1 font-mono text-xs font-bold text-accent">
              {service.service_code}
            </span>
          )}
          <span className="rounded-lg bg-sky-soft px-2.5 py-1 text-xs font-semibold text-sky">
            {serviceMeta}
          </span>
        </span>
        <span className="block font-display text-lg font-semibold leading-snug text-ink group-hover:text-accent">
          {service.title}
        </span>
        {service.cut_off_time && (
          <span className="mt-3 block rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700">
            Cut-off: {service.cut_off_time}
          </span>
        )}
      </span>

      <span className="mt-4 flex items-center justify-between gap-3">
        <span className="flex flex-wrap gap-1.5">
          {channels.map((channel) => (
            <span
              key={channel}
              className="rounded-full border border-blue-100 bg-sky-soft/70 px-2 py-0.5 text-[10px] font-semibold text-sky"
            >
              {channel}
            </span>
          ))}
        </span>
        <span className="shrink-0 text-xs font-bold text-accent">Open service</span>
      </span>
    </Link>
  );
}

function MetaStrip({
  chapters,
  sourceVersion,
  lastUpdated,
}: {
  chapters: number;
  sourceVersion: string | null;
  lastUpdated?: string | null;
}) {
  const items = [
    ["Chapters", String(chapters || "-")],
    ["Source", sourceVersion ?? "-"],
    ["Updated", lastUpdated ? compactDate(lastUpdated) : "-"],
  ];

  return (
    <dl className="flex flex-wrap gap-2 text-xs">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="rounded-full border border-border bg-white/80 px-3 py-1.5 shadow-sm"
        >
          <dt className="inline text-ink-faint">{label}: </dt>
          <dd className="inline font-semibold text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function readableItems(value: JsonValue[] | null) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const record = item as Record<string, JsonValue>;
        const text = record.label ?? record.text ?? record.value ?? record.title;
        return typeof text === "string" ? text.trim() : "";
      }
      return "";
    })
    .filter(Boolean);
}

function WorkModeCard({
  mode,
}: {
  mode: {
    title: string;
    line: string;
    query: string;
    chips: string[];
  };
}) {
  return (
    <Link
      href={`/search?q=${encodeURIComponent(mode.query)}`}
      className="content-card quick-card group flex min-h-36 flex-col justify-between p-4 transition-all hover:-translate-y-0.5 hover:border-accent"
    >
      <span>
        <span className="block font-display text-base font-semibold text-ink group-hover:text-accent">
          {mode.title}
        </span>
        <span className="mt-2 block text-sm text-ink-muted">{mode.line}</span>
      </span>
      <span className="mt-4 flex flex-wrap gap-1.5">
        {mode.chips.slice(0, 3).map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-blue-200 bg-sky-soft px-2.5 py-1 text-[10px] font-semibold text-sky"
          >
            {chip}
          </span>
        ))}
      </span>
    </Link>
  );
}

function ShortcutChip({ label, query }: { label: string; query: string }) {
  return (
    <Link
      href={`/search?q=${encodeURIComponent(query)}`}
      className="rounded-full border border-blue-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-sky shadow-sm transition-colors hover:border-accent hover:text-accent"
    >
      {label}
    </Link>
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

function latestSourceVersion(chapters: HomeChapter[]) {
  return chapters.find((chapter) => chapter.source_version?.trim())?.source_version ?? null;
}

function compactDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}
