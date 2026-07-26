import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { AgentPage } from "@/components/agent/AgentPage";
import { RelatedProcedureRow, type RelatedItem } from "@/components/agent/RelatedProcedures";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getWorkflowAvailability } from "@/lib/decision-engine/availability";
import { deriveOperationalAnswer } from "@/lib/operational-answer";
import type { JsonValue } from "@/lib/types";

export const revalidate = 60;

export const metadata = {
  title: "Browse services | GO TO",
  description: "Browse operational services by plain-language category.",
};

// Plain-language service groups (presentation only — derived from card fields,
// no backend/category change).
const SERVICE_GROUPS = [
  "Booking changes",
  "Baggage",
  "Check-in & airport",
  "Medical & assistance",
  "Travel documents",
  "Disruption",
  "Special services",
  "Payment & refunds",
] as const;
type ServiceGroup = (typeof SERVICE_GROUPS)[number];

const GROUP_RULES: { re: RegExp; group: ServiceGroup }[] = [
  { re: /baggage|worldtracer|blue ribbon|excess bag|wrapping/, group: "Baggage" },
  { re: /payment|refund|voucher/, group: "Payment & refunds" },
  { re: /disruption|fdis|delay|cancel|schedule change/, group: "Disruption" },
  { re: /medical|meda|wheelchair|dpna|oxygen|pregnan|plaster|cast|leg brace|death case|assist/, group: "Medical & assistance" },
  { re: /visa|oktb|ok to board|residency|emirates id|travel document|travel requirement/, group: "Travel documents" },
  { re: /check.?in|olci|airport|boarding|lounge|connection|\bmct\b|meet.?assist|city check/, group: "Check-in & airport" },
  { re: /name correction|government deal|auto.?split|duplicate|fare|\bbooking\b/, group: "Booking changes" },
  { re: /falcon|service animal|human remains|extra seat|cbbg|exst|sporting/, group: "Special services" },
];

type ServiceRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  service_type: string | null;
  summary: string | null;
  when_to_use: string | null;
  cut_off_time: string | null;
  who_can_action: JsonValue[] | null;
  required_information: JsonValue[] | null;
  system_steps: JsonValue[] | null;
  passenger_advice: JsonValue[] | null;
  allowed: JsonValue[] | null;
  not_allowed: JsonValue[] | null;
  escalation_points: JsonValue[] | null;
  fees_charges: string | null;
  source_version: string | null;
};

function serviceGroup(card: ServiceRow): ServiceGroup {
  const haystack = `${card.category} ${card.service_type ?? ""} ${card.title} ${card.slug}`.toLowerCase();
  for (const rule of GROUP_RULES) {
    if (rule.re.test(haystack)) return rule.group;
  }
  return "Special services";
}

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const { q, cat } = await searchParams;
  const query = (q ?? "").trim();
  const activeCat = SERVICE_GROUPS.includes((cat ?? "") as ServiceGroup) ? (cat as ServiceGroup) : null;

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("procedure_cards")
    .select(
      [
        "id", "title", "slug", "category", "service_type", "summary", "when_to_use",
        "cut_off_time", "who_can_action", "required_information", "system_steps",
        "passenger_advice", "allowed", "not_allowed", "escalation_points", "fees_charges", "source_version",
      ].join(", ")
    )
    .eq("is_published", true)
    .eq("review_status", "approved")
    .order("title", { ascending: true });

  const cards = (data ?? []) as unknown as ServiceRow[];

  const filtered = cards.filter((card) => {
    if (activeCat && serviceGroup(card) !== activeCat) return false;
    if (!query) return true;
    const hay = `${card.title} ${card.summary ?? ""} ${card.category}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  // Group into plain-language sections.
  const grouped = new Map<ServiceGroup, RelatedItem[]>();
  for (const card of filtered) {
    const answer = deriveOperationalAnswer(card);
    const availability = getWorkflowAvailability({
      slug: card.slug,
      is_published: true,
      review_status: "approved",
      source_version: card.source_version,
    });
    const item: RelatedItem = {
      slug: card.slug,
      title: card.title,
      summary: answer.summary,
      deadline: answer.deadline,
      criticalBlocker: answer.criticalBlocker,
      guidedAvailable: availability.available,
    };
    const group = serviceGroup(card);
    const list = grouped.get(group) ?? [];
    list.push(item);
    grouped.set(group, list);
  }

  return (
    <div className="dashboard-shell flex min-h-full flex-col">
      <SiteHeader />
      <AgentPage>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky">Browse services</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Browse services
        </h1>
        <p className="mt-1.5 max-w-xl text-sm leading-6 text-ink-muted">
          When you&rsquo;re not sure what to search, browse operational services by topic.
        </p>

        <form action="/services" method="get" role="search" className="mt-4">
          <label htmlFor="services-q" className="sr-only">Filter services</label>
          {activeCat ? <input type="hidden" name="cat" value={activeCat} /> : null}
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <input
              id="services-q"
              name="q"
              type="search"
              defaultValue={query}
              autoComplete="off"
              spellCheck={false}
              placeholder="Filter by name or topic…"
              className="agent-search-input touch-target min-w-0 flex-1 px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint"
            />
            <button
              type="submit"
              className="agent-primary touch-target inline-flex items-center justify-center rounded-xl px-6 py-3 text-[15px] font-semibold focus-visible:outline-none"
            >
              Filter
            </button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <CategoryChip href={buildHref(query, null)} active={!activeCat}>All</CategoryChip>
          {SERVICE_GROUPS.map((group) => (
            <CategoryChip key={group} href={buildHref(query, group)} active={activeCat === group}>
              {group}
            </CategoryChip>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-white/60 px-6 py-10 text-center">
            <p className="font-display text-base font-semibold text-ink">No services match yet</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-ink-muted">
              Try a different topic or clear the filter.
            </p>
            <Link
              href="/services"
              className="agent-secondary touch-target mt-4 inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              Clear filter
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            {SERVICE_GROUPS.map((group) => {
              const items = grouped.get(group);
              if (!items || items.length === 0) return null;
              return (
                <section key={group} aria-label={group}>
                  <h2 className="font-display text-base font-semibold text-ink">{group}</h2>
                  <div className="mt-3 space-y-2.5">
                    {items.map((item) => (
                      <RelatedProcedureRow key={item.slug} item={item} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </AgentPage>
    </div>
  );
}

function buildHref(query: string, group: ServiceGroup | null): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (group) params.set("cat", group);
  const qs = params.toString();
  return qs ? `/services?${qs}` : "/services";
}

function CategoryChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`touch-target inline-flex items-center rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-none ${
        active ? "border-sky bg-sky text-white" : "border-border bg-white text-ink-muted hover:border-sky hover:text-sky"
      }`}
    >
      {children}
    </Link>
  );
}
