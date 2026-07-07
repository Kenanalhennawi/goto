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
  who_can_action: JsonValue[] | null;
  system_steps: JsonValue[] | null;
  priority: number | null;
};

const HERO_SHORTCUTS = [
  ["MCT", "MCT"],
  ["EXST", "EXST"],
  ["CBBG", "CBBG"],
  ["SPEQ", "SPEQ"],
  ["FDIS", "FDIS"],
  ["WCHR", "WCHR"],
  ["OLCI Lounge", "OLCI lounge"],
  ["Falcon", "Falcon"],
  ["Dubai Stopover", "Dubai Stopover"],
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
  ["EXST / CBBG", "EXST CBBG extra seat"],
  ["SPEQ", "SPEQ sporting equipment"],
  ["Falcon", "falcon handling"],
  ["Lounge OLCI", "lounge access OLCI"],
  ["FDIS", "FDIS flight disruption"],
  ["WCHR", "WCHR WCHS WCHC wheelchair"],
  ["Dubai Stopover", "Dubai Stopover"],
  ["Name Correction", "name correction"],
  ["Baggage Upgrade", "baggage upgrade"],
];

const QUICK_CHECKS = [
  ["What is the cut-off?", "cut off time"],
  ["Can Contact Centre add it?", "contact centre add service"],
  ["What should I tell passenger?", "passenger advice"],
  ["Is approval required?", "approval required"],
  ["What is not allowed?", "not allowed"],
  ["Which channel handles it?", "channel service"],
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
    .select("id, title, slug, category, service_code, service_type, cut_off_time, channels, who_can_action, system_steps, priority")
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
        <section className="hero-panel mb-5 overflow-hidden rounded-[18px]">
          <div className="hero-main p-4 sm:p-5 lg:p-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
                    Agent task console
                  </p>
                  <MetaStrip
                    chapters={list.length}
                    sourceVersion={sourceVersion}
                    lastUpdated={lastUpdated}
                  />
                </div>
                <h1 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
                  GO TO Contact Centre Guide
                </h1>
                <p className="mt-2 font-display text-2xl font-semibold text-sky sm:text-3xl">
                  What are you handling now?
                </p>
                <p className="mt-2 max-w-2xl text-sm font-medium text-ink-muted sm:text-base">
                  Search by service, SSR code, passenger issue, cut-off time, or process.
                </p>

                <div className="hero-search mt-5 rounded-2xl p-3">
                  <SearchBar autoFocus />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {HERO_SHORTCUTS.map(([label, query]) => (
                    <ShortcutChip key={label} label={label} query={query} />
                  ))}
                </div>
              </div>

              <aside className="answer-panel rounded-2xl border border-blue-100 bg-white/86 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                  Answer fast
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold text-ink">
                  Answer the passenger fast
                </h2>
                <div className="mt-4 grid gap-2">
                  {QUICK_CHECKS.map(([label, query]) => (
                    <Link
                      key={label}
                      href={`/search?q=${encodeURIComponent(query)}`}
                      className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        </section>

        {list.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            <section>
              <div className="content-card service-console-panel p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                      Live operational cards
                    </p>
                    <h2 className="font-display text-2xl font-semibold text-ink">
                      Live Operational Cards
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-ink-faint">
                    Approved and published only
                  </span>
                </div>

                {services.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {services.map((service) => (
                      <ServiceCard key={service.id} service={service} />
                    ))}
                    {services.length < 4 && (
                      <div className="rounded-2xl border border-dashed border-blue-200 bg-white/70 p-5">
                        <p className="font-display text-lg font-semibold text-ink">
                          More service cards coming after review
                        </p>
                        <p className="mt-2 text-sm text-ink-muted">
                          Quality-approved cards will appear here as operational drafts are reviewed and published.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-blue-200 bg-sky-soft/50 p-6 text-sm text-ink-muted">
                    <p className="font-semibold text-ink">No approved service cards yet.</p>
                    <p className="mt-1">Use search while Quality reviews service cards.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="content-card p-4">
              <h2 className="mb-3 font-display text-lg font-semibold text-ink">
                Operational shortcuts
              </h2>
              <div className="flex flex-wrap gap-2">
                {CRITICAL_SHORTCUTS.map(([label, query]) => (
                  <ShortcutChip key={label} label={label} query={query} />
                ))}
              </div>
            </section>

            <details className="content-card group overflow-hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
                <span>
                  <span className="block font-display text-lg font-semibold text-ink">
                    Manual / chapter browser
                  </span>
                  <span className="mt-1 block text-xs text-ink-muted">
                    Last-resort manual browsing, work areas, and recent chapter updates.
                  </span>
                </span>
                <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-sky group-open:text-accent">
                  Open
                </span>
              </summary>
              <div className="space-y-5 border-t border-border p-4">
                <details className="rounded-2xl border border-border bg-white/70">
                  <summary className="cursor-pointer px-4 py-3 font-display text-base font-semibold text-ink">
                    Browse by work area
                  </summary>
                  <div className="grid grid-cols-1 gap-3 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
                    {WORK_MODES.map((mode) => (
                      <WorkModeCard key={mode.title} mode={mode} />
                    ))}
                  </div>
                </details>

                {recentlyUpdated.length > 0 && (
                  <details className="rounded-2xl border border-border bg-white/70">
                    <summary className="cursor-pointer px-4 py-3 font-display text-base font-semibold text-ink">
                      Recent chapter updates
                    </summary>
                    <div className="divide-y divide-border border-t border-border">
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
                  </details>
                )}

                <h2 className="font-display text-lg font-semibold text-ink">Browse all chapters</h2>
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
  const whoCanAction = readableItems(service.who_can_action);
  const steps = readableItems(service.system_steps);
  const serviceMeta = service.service_type || service.category;
  const timingLabel = getTimingLabel(service);

  return (
    <article className="service-card flex min-h-56 flex-col justify-between rounded-2xl border border-blue-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md">
      <span>
        <span className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap gap-2">
          {service.service_code && (
            <span className="rounded-lg bg-accent-soft px-2.5 py-1 font-mono text-xs font-bold text-accent">
              {service.service_code}
            </span>
          )}
            <span className="rounded-lg bg-sky-soft px-2.5 py-1 text-xs font-semibold text-sky">
              {serviceMeta}
            </span>
          </span>
          <Link
            href={`/procedure/${service.slug}`}
            className="rounded-lg bg-accent px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-accent-dim"
          >
            Open service
          </Link>
        </span>
        <h3 className="font-display text-xl font-semibold leading-snug text-ink">
          {service.title}
        </h3>
        {service.cut_off_time && (
          <TimingDisplay label={timingLabel} value={service.cut_off_time} />
        )}
      </span>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <QuickFact label="Channels" value={channels.length ? channels.join(", ") : "Check service"} />
        <QuickFact
          label="Who can action"
          value={whoCanAction[0] ?? "Action guide"}
        />
        <QuickFact
          label="Steps"
          value={steps.length ? `${steps.length} steps` : "Action guide"}
        />
      </div>

      <span className="mt-4 flex flex-wrap gap-1.5">
          {channels.map((channel) => (
            <span
              key={channel}
              className="rounded-full border border-blue-100 bg-sky-soft/70 px-2 py-0.5 text-[10px] font-semibold text-sky"
            >
              {channel}
            </span>
          ))}
      </span>
    </article>
  );
}

function TimingDisplay({ label, value }: { label: string; value: string }) {
  const groups = timingGroups(value);
  const isStructured = groups.length > 1 || groups.some((group) => group.items.length > 1);

  return (
    <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-sm text-orange-800">
      <p className="font-bold">{label}:</p>
      {isStructured ? (
        <div className="mt-2 space-y-2">
          {groups.map((group, index) => (
            <div key={`${group.heading}-${index}`}>
              {group.heading && (
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-700">
                  {group.heading}
                </p>
              )}
              <ul className="mt-1 space-y-1">
                {group.items.map((item) => (
                  <li key={item} className="text-xs font-semibold leading-5 text-ink">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1 font-semibold text-ink">{value}</p>
      )}
    </div>
  );
}

function getTimingLabel(card: Pick<HomeServiceCard, "service_code" | "service_type" | "category">) {
  if (card.service_code?.toUpperCase() === "MCT") return "MCT rule";
  const type = `${card.service_type ?? ""} ${card.category ?? ""}`.toLowerCase();
  if (type.includes("reference")) return "Reference rule";
  if (type.includes("rule")) return "Timing rule";
  return "Cut-off";
}

function timingGroups(value: string) {
  const text = value.trim();
  const lines = text.includes("\n")
    ? text.split(/\r?\n/)
    : text.includes(";")
      ? text.split(";")
      : [text];
  const groups: { heading: string; items: string[] }[] = [];
  let current: { heading: string; items: string[] } = { heading: "", items: [] };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (current.heading || current.items.length) {
        groups.push(current);
        current = { heading: "", items: [] };
      }
      continue;
    }

    const isHeading = !line.includes(":") && current.items.length === 0;
    if (isHeading) {
      current.heading = line;
    } else {
      current.items.push(line);
    }
  }

  if (current.heading || current.items.length) groups.push(current);
  return groups.length ? groups : [{ heading: "", items: [text] }];
}

function QuickFact({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-xl border border-border bg-sky-soft/45 px-3 py-2">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </span>
      <span className="mt-1 block truncate text-xs font-semibold text-ink">{value}</span>
    </span>
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
