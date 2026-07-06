import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SiteHeader } from "@/components/SiteHeader";
import { SearchBar } from "@/components/SearchBar";
import { ChapterDirectory } from "@/components/ChapterDirectory";
import type { Chapter } from "@/lib/types";

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

const QUICK_ACCESS = [
  {
    title: "Flight Disruption",
    description: "IRROPS, disruption handling, recovery options, and urgent passenger impact.",
    query: "FDIS flight disruption",
    keywords: ["IRROPS", "Recovery", "Delay"],
  },
  {
    title: "Baggage",
    description: "Baggage rules, claims, WorldTracer, excess baggage, and mishandled bags.",
    query: "baggage WorldTracer",
    keywords: ["Baggage", "WorldTracer", "Claims"],
  },
  {
    title: "Name Correction",
    description: "Name correction cases, eligibility, restrictions, and agent handling.",
    query: "name correction",
    keywords: ["Name", "Correction", "PNR"],
  },
  {
    title: "Auto Split OD",
    description: "FZ-FZ connection booking split and related booking handling.",
    query: "Auto Split OD FZ-FZ connection booking",
    keywords: ["Auto Split", "OD", "FZ-FZ"],
  },
  {
    title: "MCT Time",
    description: "Minimum connection time rules for transfer and connection checks.",
    query: "minimum connection time MCT connection transfer",
    keywords: ["MCT", "connection", "transfer"],
  },
  {
    title: "Wheelchair",
    description: "Special assistance requests, SSR handling, and mobility support cases.",
    query: "WCHR WCHC wheelchair",
    keywords: ["WCHR", "SSR", "Assist"],
  },
  {
    title: "Dubai Stopover",
    description: "Dubai Stopover process, booking handling, and related customer guidance.",
    query: "Dubai Stopover DSO stopover",
    keywords: ["DSO", "stopover", "Dubai"],
  },
  {
    title: "Skywards",
    description: "Skywards account, member handling, profile guidance, and loyalty queries.",
    query: "Skywards miles",
    keywords: ["Skywards", "Member", "Profile"],
  },
  {
    title: "Interline",
    description: "Interline tickets, partner airline handling, and ticket verification.",
    query: "interline connection",
    keywords: ["Interline", "Ticket", "Partner"],
  },
  {
    title: "Salesforce",
    description: "CRM, case creation, customer classification, and service workflow support.",
    query: "Salesforce case classification",
    keywords: ["CRM", "Case", "SPRINT"],
  },
  {
    title: "Check-in / OLCI",
    description: "Online check-in, airport check-in, seat selection, and escalation checks.",
    query: "OLCI online check-in",
    keywords: ["OLCI", "Check-in", "Seat"],
  },
  {
    title: "Lounge Access during OLCI",
    description: "Lounge purchase flow during online check-in and related handling.",
    query: "lounge access purchase during OLCI online check-in",
    keywords: ["lounge", "OLCI", "check-in"],
  },
  {
    title: "Contact Details",
    description: "Internal contacts, support mailboxes, escalation numbers, and team references.",
    query: "contact details",
    keywords: ["Contacts", "Email", "Phone"],
  },
  {
    title: "Sporting Equipment",
    description: "Sporting equipment handling, SSR checks, and exceptions.",
    query: "sporting equipment SPEQ weapon",
    keywords: ["SPEQ", "sports", "equipment"],
  },
  {
    title: "Falcon Handling",
    description: "Falcon and bird carriage handling and cabin-related checks.",
    query: "falcon handling birds animal",
    keywords: ["falcon", "birds", "cabin"],
  },
  {
    title: "Extra Seat / CBBG",
    description: "Extra seat and cabin baggage seat handling.",
    query: "extra seat EXST CBBG",
    keywords: ["EXST", "CBBG", "extra seat"],
  },
  {
    title: "Government Deals",
    description: "Government deal references, eligibility checks, and related booking support.",
    query: "government deals booking",
    keywords: ["Government", "Deals", "Booking"],
  },
];

const WORK_AREAS = [
  {
    title: "Essentials",
    description: "Core scripts, tools, contact details, CRM, and daily agent references.",
    query: "essentials contact details CRM",
    range: [1, 10],
  },
  {
    title: "Booking",
    description: "PNR handling, fares, tickets, modifications, SSRs, and passenger records.",
    query: "booking PNR ticket",
    range: [11, 40],
  },
  {
    title: "Airport & Check-in",
    description: "Airport flows, online check-in, seats, boarding, and station handling.",
    query: "airport check-in OLCI",
    keywords: ["check", "airport", "boarding", "seat", "olci"],
  },
  {
    title: "Baggage",
    description: "Baggage allowance, disruption, tracing, claims, and excess baggage cases.",
    query: "baggage WorldTracer",
    keywords: ["baggage", "bag", "worldtracer", "excess"],
  },
  {
    title: "Special Assistance",
    description: "Wheelchair, medical, assistance, SSR, and passenger care procedures.",
    query: "special assistance WCHR MEDA",
    keywords: ["wheelchair", "medical", "meda", "assist", "ssr"],
  },
  {
    title: "Payment & Refund",
    description: "Payment issues, refunds, receipts, fees, vouchers, and charge handling.",
    query: "payment refund",
    keywords: ["payment", "refund", "voucher", "receipt", "charge"],
  },
  {
    title: "Disruption",
    description: "IRROPS, delays, cancellations, rebooking, protection, and recovery workflows.",
    query: "FDIS flight disruption",
    keywords: ["irrop", "disruption", "delay", "cancel", "rebook"],
  },
  {
    title: "Support & References",
    description: "Policies, references, contacts, files, and supporting material.",
    query: "support references",
    range: [66, 999],
  },
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

  const list = ((chapters ?? []) as HomeChapter[]).filter(Boolean);
  const recentlyUpdated = [...list]
    .filter((chapter) => Boolean(chapter.updated_at))
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 5);
  const sourceVersion = latestSourceVersion(list);
  const lastUpdated = recentlyUpdated[0]?.updated_at;

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
        <section className="mb-8 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1.45fr_0.85fr]">
            <div className="border-b border-border bg-gradient-to-br from-white via-white to-sky-soft/80 p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
                flydubai contact centre operations
              </p>
              <h1 className="max-w-4xl font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
                GO TO Contact Centre Guide
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-ink-muted">
                Fast operational guide for Contact Centre procedures, policies, references,
                and source-backed answers.
              </p>

              <div className="mt-6 rounded-xl border border-border bg-white p-3 shadow-sm">
                <SearchBar autoFocus />
              </div>
            </div>

            <aside className="grid content-start gap-3 bg-panel p-5 sm:grid-cols-2 lg:grid-cols-1">
              <Stat label="Total chapters" value={String(list.length || "-")} tone="orange" />
              <Stat label="Source version" value={sourceVersion ?? "Available in chapters"} tone="blue" />
              <Stat label="Last updated" value={lastUpdated ? compactDate(lastUpdated) : "No update date"} tone="green" />
              <Stat label="References" value="Open Files" href="/files" tone="blue" />
            </aside>
          </div>
        </section>

        {list.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-10">
            <section>
              <SectionHeader
                eyebrow="Quick access"
                title="Start with the passenger issue"
                description="Operational shortcuts open targeted search results without inventing policy content."
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {QUICK_ACCESS.map((item) => (
                  <QuickAccessCard key={item.title} item={item} />
                ))}
              </div>
            </section>

            {recentlyUpdated.length > 0 && (
              <section>
                <SectionHeader
                  eyebrow="Recently updated"
                  title="Latest changed chapters"
                  description="Sorted from the chapter update timestamps already stored in Supabase."
                />
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                  {recentlyUpdated.map((chapter) => (
                    <Link
                      key={chapter.id}
                      href={`/chapter/${chapter.slug}`}
                      className="content-card block p-4 transition-colors hover:border-accent hover:bg-panel-hover"
                    >
                      <span className="font-mono text-xs font-semibold text-accent">
                        Ch. {String(chapter.chapter_number).padStart(2, "0")}
                      </span>
                      <h3 className="mt-2 line-clamp-2 font-display text-sm font-semibold leading-snug text-ink">
                        {chapter.title}
                      </h3>
                      <p className="mt-3 text-xs text-ink-faint">
                        {compactDate(chapter.updated_at)}
                      </p>
                      {chapter.source_version && (
                        <p className="mt-1 truncate font-mono text-[11px] text-ink-faint">
                          {chapter.source_version}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section>
              <SectionHeader
                eyebrow="Browse by work area"
                title="Operational workstreams"
                description="Use these areas when the call starts with a case type rather than a chapter number."
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {WORK_AREAS.map((area) => (
                  <WorkAreaCard key={area.title} area={area} chapters={list} />
                ))}
              </div>
            </section>

            <section>
              <SectionHeader
                eyebrow="Browse manual"
                title="Full chapter directory"
                description="The original chapter listing remains available for manual browsing and structured review."
              />
              <ChapterDirectory chapters={list} activeGroupId={group} />
            </section>
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-white/70 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>Internal flydubai contact centre reference. Not for external distribution.</span>
          <span className="font-mono">{sourceVersion ?? "Source version shown per chapter"}</span>
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          {eyebrow}
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
          {title}
        </h2>
      </div>
      <p className="max-w-xl text-sm leading-6 text-ink-muted">{description}</p>
    </div>
  );
}

function QuickAccessCard({
  item,
}: {
  item: {
    title: string;
    description: string;
    query: string;
    keywords: string[];
  };
}) {
  return (
    <Link
      href={`/search?q=${encodeURIComponent(item.query)}`}
      className="content-card group flex min-h-36 flex-col justify-between p-3.5 transition-all hover:-translate-y-0.5 hover:border-accent hover:bg-panel-hover"
    >
      <span>
        <span className="font-display text-sm font-semibold text-ink group-hover:text-accent">
          {item.title}
        </span>
        <span className="mt-2 block text-xs leading-5 text-ink-muted">
          {item.description}
        </span>
      </span>
      <span className="mt-4 flex flex-wrap gap-1.5">
        {item.keywords.map((keyword) => (
          <span
            key={keyword}
            className="rounded-md border border-blue-200 bg-sky-soft px-2 py-1 text-[11px] font-semibold text-sky"
          >
            {keyword}
          </span>
        ))}
      </span>
    </Link>
  );
}

function WorkAreaCard({
  area,
  chapters,
}: {
  area: {
    title: string;
    description: string;
    query: string;
    range?: number[];
    keywords?: string[];
  };
  chapters: HomeChapter[];
}) {
  const matches = chaptersForArea(area, chapters);
  const previewMatches = matches.slice(0, 3);

  return (
    <div className="content-card flex min-h-48 flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-ink">{area.title}</h3>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{area.description}</p>
        </div>
        <span className="rounded-lg bg-orange-50 px-2.5 py-1 font-mono text-xs font-semibold text-accent">
          {matches.length}
        </span>
      </div>

      <div className="mt-auto pt-4">
        {previewMatches.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {previewMatches.map((chapter) => (
              <Link
                key={chapter.id}
                href={`/chapter/${chapter.slug}`}
                className="max-w-full truncate rounded-md border border-blue-200 bg-sky-soft px-2 py-1 text-[11px] font-semibold text-sky transition-colors hover:border-accent hover:text-accent"
              >
                {String(chapter.chapter_number).padStart(2, "0")} {chapter.title}
              </Link>
            ))}
          </div>
        ) : null}
        <Link
          href={`/search?q=${encodeURIComponent(area.query)}`}
          className="inline-flex rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent"
        >
          Browse area
        </Link>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: string;
  tone: "orange" | "blue" | "green";
  href?: string;
}) {
  const tones = {
    orange: "bg-orange-50 text-accent border-orange-200",
    blue: "bg-sky-soft text-sky border-blue-200",
    green: "bg-mint-soft text-good border-green-200",
  };
  const content = (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <p className="truncate font-display text-xl font-semibold leading-none">{value}</p>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider opacity-75">
        {label}
      </p>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
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
  if (!value) {
    return "No date";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "No date";
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function chaptersForArea(
  area: {
    range?: number[];
    keywords?: string[];
  },
  chapters: HomeChapter[]
) {
  return chapters.filter((chapter) => {
    if (area.range) {
      return chapter.chapter_number >= area.range[0] && chapter.chapter_number <= area.range[1];
    }

    const haystack = `${chapter.title ?? ""} ${(chapter.search_keywords ?? []).join(" ")}`.toLowerCase();
    return area.keywords?.some((keyword) => haystack.includes(keyword)) ?? false;
  });
}
