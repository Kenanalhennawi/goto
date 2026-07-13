import { SiteHeader } from "@/components/SiteHeader";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { canReviewProcedures } from "@/lib/permissions";
import type { JsonValue } from "@/lib/types";
import Link from "next/link";

export const revalidate = 60;

type SearchParams = {
  q?: string;
  area?: string;
  code?: string;
};

type ServiceCard = {
  id: string;
  title: string;
  slug: string;
  category: string;
  service_code: string | null;
  service_type: string | null;
  cut_off_time: string | null;
  channels: JsonValue[];
  priority: number;
};

const WORK_AREAS = [
  "Booking Changes",
  "Baggage",
  "Special Assistance",
  "Airport / Check-in",
  "Disruption",
  "Payment / Refund",
  "Interline / Connections",
  "Visa / OKTB",
  "Other References",
] as const;

type WorkArea = (typeof WORK_AREAS)[number];

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: role } = user
    ? await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single()
    : { data: null };

  const canReview = canReviewProcedures(role?.role);
  const { data, error } = await supabase
    .from("procedure_cards")
    .select("id, title, slug, category, service_code, service_type, cut_off_time, channels, priority")
    .eq("is_published", true)
    .eq("review_status", "approved")
    .order("priority", { ascending: false })
    .order("title", { ascending: true });

  const cards = error ? [] : ((data ?? []) as ServiceCard[]);
  const visibleCards = filterCards(cards, filters);
  const grouped = groupCards(visibleCards);

  return (
    <div className="dashboard-shell flex min-h-full flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
        <section className="hero-panel mb-5 overflow-hidden rounded-lg">
          <div className="hero-main p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              Agent services
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">
                  Service Directory
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-muted">
                  Browse operational services by work area.
                </p>
              </div>
              <Link
                href="/"
                className="rounded border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent"
              >
                Back to guide
              </Link>
            </div>
          </div>
        </section>

        <section className="content-card mb-5 p-4">
          <form action="/services" className="grid gap-2.5 lg:grid-cols-[1fr_220px_auto]">
            <label className="sr-only" htmlFor="service-filter">
              Filter services
            </label>
            <input
              id="service-filter"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Filter services..."
              autoComplete="off"
              className="rounded-md border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-sky"
            />
            <select
              name="area"
              defaultValue={filters.area ?? ""}
              className="rounded-md border border-border bg-white px-3.5 py-2.5 text-sm font-semibold text-ink outline-none transition-colors focus:border-sky"
            >
              <option value="">All work areas</option>
              {WORK_AREAS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent"
            >
              Filter
            </button>
          </form>

          <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-border pt-3.5">
            <FilterChip href="/services" active={!filters.area && !filters.q}>
              All
            </FilterChip>
            {WORK_AREAS.map((area) => (
              <FilterChip
                key={area}
                href={`/services?area=${encodeURIComponent(area)}`}
                active={filters.area === area}
              >
                {area}
              </FilterChip>
            ))}
          </div>
        </section>

        {canReview && cards.length < 3 && (
          <div className="mb-6 rounded-xl border border-warn/20 bg-warn/10 px-4 py-3 text-sm font-semibold text-warn">
            Review and publish cards from Admin Procedures.
          </div>
        )}

        {cards.length === 0 ? (
          <section className="content-card p-8 text-center">
            <h2 className="font-display text-xl font-semibold text-ink">
              No published operational services yet.
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Approved service cards will appear here once published.
            </p>
          </section>
        ) : visibleCards.length === 0 ? (
          <section className="content-card p-8 text-center">
            <h2 className="font-display text-xl font-semibold text-ink">
              No services match this filter.
            </h2>
            <Link href="/services" className="mt-3 inline-flex text-sm font-semibold text-sky hover:text-accent">
              Clear filters
            </Link>
          </section>
        ) : (
          <div className="space-y-6">
            {WORK_AREAS.map((area) => {
              const areaCards = grouped[area] ?? [];
              if (areaCards.length === 0) return null;

              return (
                <section key={area} className="section-band p-4">
                  <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                    <h2 className="font-display text-lg font-semibold text-ink">{area}</h2>
                    <span className="rounded border border-border bg-white px-2.5 py-0.5 text-xs font-semibold text-ink-muted">
                      {areaCards.length} card{areaCards.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {areaCards.map((card) => (
                      <ServiceDirectoryCard key={card.id} card={card} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function ServiceDirectoryCard({ card }: { card: ServiceCard }) {
  const timing = compactTiming(card.cut_off_time);
  const timingLabel = getTimingLabel(card);
  const channels = jsonItems(card.channels).slice(0, 3);

  return (
    <article className="content-card quick-card flex flex-col p-4 transition-colors hover:border-accent">
      <div className="flex flex-wrap gap-1.5">
        {card.service_code && (
          <span className="rounded-sm border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-accent">
            {card.service_code}
          </span>
        )}
        {(card.service_type || card.category) && (
          <span className="rounded-sm border border-blue-200 bg-sky-soft px-2 py-0.5 text-[11px] font-semibold text-sky">
            {card.service_type ?? card.category}
          </span>
        )}
      </div>

      <h3 className="mt-2.5 font-display text-base font-semibold leading-snug text-ink">{card.title}</h3>

      {timing && (
        <div className="mt-3 rounded-md border border-border bg-slate-50 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            {timingLabel}
          </p>
          <p className="mt-1 line-clamp-3 whitespace-pre-line text-[13px] font-semibold leading-5 text-ink">
            {timing}
          </p>
        </div>
      )}

      {channels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {channels.map((channel) => (
            <span
              key={channel}
              className="rounded-sm border border-border bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-muted"
            >
              {channel}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto pt-4">
        <Link
          href={`/procedure/${card.slug}`}
          className="inline-flex rounded bg-navy px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent"
        >
          Open
        </Link>
      </div>
    </article>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded border px-2.5 py-1 text-xs font-semibold transition-colors ${
        active
          ? "border-navy bg-navy text-white"
          : "border-border bg-white text-ink-muted hover:border-accent hover:text-accent"
      }`}
    >
      {children}
    </Link>
  );
}

function filterCards(cards: ServiceCard[], filters: SearchParams) {
  const q = normalize(filters.q ?? "");
  const area = filters.area;
  const code = normalize(filters.code ?? "");

  return cards.filter((card) => {
    if (area && groupForCard(card) !== area) return false;
    if (code && normalize(card.service_code ?? "") !== code) return false;
    if (!q) return true;

    const haystack = normalize(
      [
        card.title,
        card.slug,
        card.category,
        card.service_code ?? "",
        card.service_type ?? "",
        ...jsonItems(card.channels),
      ].join(" ")
    );
    return haystack.includes(q);
  });
}

function groupCards(cards: ServiceCard[]) {
  const groups = Object.fromEntries(WORK_AREAS.map((area) => [area, [] as ServiceCard[]])) as Record<
    WorkArea,
    ServiceCard[]
  >;

  for (const card of cards) {
    groups[groupForCard(card)].push(card);
  }

  return groups;
}

function groupForCard(card: ServiceCard): WorkArea {
  const text = normalize(`${card.service_type ?? ""} ${card.category} ${card.service_code ?? ""} ${card.title}`);

  if (matches(text, ["payment", "refund", "voucher", "insurance"])) return "Payment / Refund";
  if (matches(text, ["fdis", "disruption", "delay", "schedule"])) return "Disruption";
  if (matches(text, ["mct", "connection", "transfer", "interline", "codeshare"])) return "Interline / Connections";
  if (matches(text, ["visa", "oktb", "ok to board"])) return "Visa / OKTB";
  if (matches(text, ["wheelchair", "wchr", "wchs", "wchc", "meda", "dpna", "pregnancy"])) return "Special Assistance";
  if (matches(text, ["check in", "check-in", "olci", "lounge", "boarding", "airport"])) return "Airport / Check-in";
  if (matches(text, ["baggage", "speq", "spex", "falcon", "petc"])) return "Baggage";
  if (matches(text, ["booking", "name", "seat", "cbbg", "exst", "stopover", "government"])) return "Booking Changes";
  return "Other References";
}

function getTimingLabel(card: ServiceCard) {
  const type = normalize(`${card.service_type ?? ""} ${card.category}`);
  if (card.service_code?.toUpperCase() === "MCT") return "Timing rule";
  if (type.includes("reference") || type.includes("rule") || type.includes("timing")) return "Timing rule";
  return "Cut-off";
}

function compactTiming(value: string | null) {
  if (!value?.trim()) return "";
  const text = value.trim();
  const lines = text.includes("\n")
    ? text.split(/\r?\n/)
    : text.includes(";")
      ? text.split(";")
      : [text];

  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join("\n");
}

function jsonItems(value: JsonValue[] | null | undefined) {
  if (!Array.isArray(value)) return [];
  return value.map(readableJsonItem).filter((item): item is string => Boolean(item));
}

function readableJsonItem(item: JsonValue) {
  if (typeof item === "string") return item.trim();
  if (typeof item === "number" || typeof item === "boolean") return String(item);
  if (!item || Array.isArray(item) || typeof item !== "object") return "";

  const record = item as Record<string, JsonValue>;
  for (const key of ["label", "text", "value", "title", "description"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function matches(value: string, terms: string[]) {
  return terms.some((term) => value.includes(normalize(term)));
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
