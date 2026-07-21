import { CopyLinkButton } from "@/components/CopyLinkButton";
import { FavoriteButton } from "@/components/FavoriteButton";
import { CopyTextButton } from "@/components/CopyTextButton";
import { InteractiveChecklist } from "@/components/InteractiveChecklist";
import { RecentTracker } from "@/components/RecentTracker";
import { SiteHeader } from "@/components/SiteHeader";
import { getProcedureBySlug, type ProcedureCardWithChapter } from "@/lib/procedures";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getWorkflowAvailability } from "@/lib/decision-engine/availability";
import { GuidedDecisionEntry } from "@/components/decision/GuidedDecisionEntry";
import { groupForCard } from "@/lib/work-areas";
import type { JsonValue } from "@/lib/types";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { procedure } = await getProcedureBySlug(slug);

  if (!procedure) {
    return {
      title: "Procedure not found | GO TO",
    };
  }

  return {
    title: `${procedure.title} | GO TO`,
    description: procedure.summary || procedure.category,
  };
}

export default async function ProcedurePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { procedure, canManage } = await getProcedureBySlug(slug);

  if (!procedure) notFound();

  const sourcePages = formatSourcePages(procedure.source_pages);
  const updatedAt = safeDate(procedure.updated_at);
  const path = `/procedure/${procedure.slug}`;
  const related = await fetchRelatedProcedures(procedure);
  const guidedAvailability = getWorkflowAvailability({
    slug: procedure.slug,
    is_published: procedure.is_published,
    review_status: procedure.review_status,
    source_version: procedure.source_version,
    last_reviewed_at: procedure.last_reviewed_at,
    chapters: procedure.chapters,
  });

  return (
    <div className="dashboard-shell flex min-h-full flex-col">
      <SiteHeader />
      <RecentTracker
        kind="procedure"
        slug={procedure.slug}
        title={procedure.title}
        code={procedure.service_code}
      />

      <div className="glass-light sticky top-[3.25rem] z-30 border-b border-border lg:top-0">
        <div className="mx-auto flex h-11 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          {procedure.service_code && (
            <span className="shrink-0 rounded-sm border border-orange-200 bg-orange-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-accent">
              {procedure.service_code}
            </span>
          )}
          <span className="truncate text-sm font-semibold text-ink">{procedure.title}</span>
          {procedure.cut_off_time && (
            <span className="hidden min-w-0 items-baseline gap-1.5 md:flex">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-accent">
                {getTimingLabel(procedure)}
              </span>
              <span className="truncate text-xs font-medium text-ink-muted">
                {firstTimingLine(procedure.cut_off_time)}
              </span>
            </span>
          )}
          {procedure.chapters && (
            <Link
              href={`/chapter/${procedure.chapters.slug}`}
              className="ml-auto shrink-0 text-xs font-semibold text-sky transition-colors hover:text-accent"
            >
              Source chapter &rarr;
            </Link>
          )}
        </div>
      </div>

      <main id="main" className="reveal mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Link
            href="/search"
            className="inline-flex rounded border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent"
          >
            &larr; Back to search
          </Link>
          <Link
            href="/"
            className="inline-flex rounded border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent"
          >
            Back to guide
          </Link>
        </div>

        <section className="hero-panel mb-5 overflow-hidden rounded-lg">
          <div className="hero-main p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                Agent operational card
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {procedure.service_code && (
                  <span className="rounded-sm border border-orange-200 bg-orange-50 px-2 py-0.5 font-mono text-xs font-bold text-accent">
                    {procedure.service_code}
                  </span>
                )}
                {procedure.service_type && (
                  <span className="rounded-sm border border-blue-200 bg-sky-soft px-2 py-0.5 text-xs font-semibold text-sky">
                    {procedure.service_type}
                  </span>
                )}
                <span className="rounded-sm border border-blue-200 bg-sky-soft px-2 py-0.5 text-xs font-semibold text-sky">
                  {procedure.category}
                </span>
                {canManage && (
                  <span className="rounded-sm border border-border bg-white px-2 py-0.5 text-xs font-semibold text-ink-muted">
                    {procedure.review_status.replace("_", " ")}
                  </span>
                )}
              </div>

              <h1 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">
                {procedure.title}
              </h1>

              {procedure.summary && (
                <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-muted">
                  {procedure.summary}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <CopyLinkButton path={path} />
                <FavoriteButton
                  kind="procedure"
                  slug={procedure.slug}
                  title={procedure.title}
                  code={procedure.service_code}
                />
                {procedure.chapters && (
                  <Link
                    href={`/chapter/${procedure.chapters.slug}`}
                    className="inline-flex rounded bg-navy px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent"
                  >
                    Open source chapter
                  </Link>
                )}
              </div>

              {(procedure.keywords.length > 0 || procedure.aliases.length > 0) && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {[...procedure.keywords, ...procedure.aliases].slice(0, 12).map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-sm border border-border bg-white px-2 py-0.5 text-xs font-medium text-ink-muted"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
          </div>
        </section>

        {guidedAvailability.hasTree && (
          <div className="mb-5">
            <GuidedDecisionEntry availability={guidedAvailability} canManage={canManage} />
          </div>
        )}

        <div className="space-y-5">
          <ServiceCardSections procedure={procedure} />
          <ListSection
            title="Agent action"
            items={procedure.agent_action}
            canShowFallback={canManage}
            hiddenItems={structuredOperationalItems(procedure)}
          />
          <ListSection
            title="Rules"
            items={procedure.rules}
            canShowFallback={canManage}
            hiddenItems={structuredOperationalItems(procedure)}
          />
          <ListSection
            title="Exceptions"
            items={procedure.exceptions}
            canShowFallback={canManage}
            hiddenItems={structuredOperationalItems(procedure)}
          />
          <TextSection title="Required approval" value={procedure.required_approval} />
          <TextSection title="Customer script" value={procedure.customer_script} isScript />
          <TextSection title="SPRINT comment template" value={procedure.sprint_comment_template} isScript />
          <TextSection title="Salesforce classification" value={procedure.salesforce_classification} />

          {related.length > 0 && (
            <section className="content-card quick-card p-5">
              <h2 className="font-display text-base font-semibold text-ink">
                Frequently used together
              </h2>
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {related.map((card) => (
                  <Link
                    key={card.slug}
                    href={`/procedure/${card.slug}`}
                    className="hover-lift flex items-center justify-between gap-2 rounded-md border border-border bg-white px-3 py-2 hover:border-accent"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-ink">
                        {card.title}
                      </span>
                      {card.service_type && (
                        <span className="block truncate text-[11px] font-medium text-ink-faint">
                          {card.service_type}
                        </span>
                      )}
                    </span>
                    {card.service_code && (
                      <span className="shrink-0 rounded-sm border border-orange-200 bg-orange-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent">
                        {card.service_code}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <ProcedureSourceAuditDetails
            procedure={procedure}
            sourcePages={sourcePages}
            updatedAt={updatedAt}
          />
        </div>
      </main>
    </div>
  );
}

type RelatedProcedure = {
  title: string;
  slug: string;
  category: string;
  service_code: string | null;
  service_type: string | null;
};

// Related procedures: published cards from the same operational work
// area (visibility rules identical to every public card fetch).
async function fetchRelatedProcedures(
  procedure: ProcedureCardWithChapter
): Promise<RelatedProcedure[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("procedure_cards")
    .select("title, slug, category, service_code, service_type")
    .eq("is_published", true)
    .eq("review_status", "approved")
    .neq("slug", procedure.slug)
    .order("priority", { ascending: false })
    .limit(60);

  const area = groupForCard(procedure);
  return ((data ?? []) as RelatedProcedure[])
    .filter((card) => groupForCard(card) === area)
    .slice(0, 4);
}

function TextSection({
  title,
  value,
  isScript = false,
}: {
  title: string;
  value: string | null;
  isScript?: boolean;
}) {
  const text = value?.trim();
  if (!text) return null;

  return (
    <section className="content-card quick-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
        {isScript && <CopyTextButton text={text} />}
      </div>
      <p
        className={`mt-2.5 whitespace-pre-line text-sm leading-6 text-ink-muted ${
          isScript ? "rounded-md border border-blue-200 bg-sky-soft p-3.5 font-mono text-xs text-ink" : ""
        }`}
      >
        {text}
      </p>
    </section>
  );
}

function ServiceCardSections({ procedure }: { procedure: ProcedureCardWithChapter }) {
  const timingLabel = getTimingLabel(procedure);
  const passengerAdvice = procedure.passenger_advice.map(readableJsonItem).filter(Boolean);
  const requiredInfo = procedure.required_information.map(readableJsonItem).filter(Boolean);
  const channels = procedure.channels.map(readableJsonItem).filter(Boolean);
  const whoCanAction = procedure.who_can_action.map(readableJsonItem).filter(Boolean);
  const allowed = procedure.allowed.map(readableJsonItem).filter(Boolean);
  const restrictions = procedure.not_allowed.map(readableJsonItem).filter(Boolean);
  const escalation = procedure.escalation_points.map(readableJsonItem).filter(Boolean);
  const systemSteps = procedure.system_steps.map(readableJsonItem).filter(Boolean);
  const hasDecisionData = Boolean(
    procedure.service_code?.trim() ||
      procedure.service_type?.trim() ||
      procedure.cut_off_time?.trim() ||
      channels.length ||
      whoCanAction.length
  );
  const hasOperationalData = Boolean(
    requiredInfo.length ||
      allowed.length ||
      restrictions.length ||
      escalation.length ||
      passengerAdvice.length ||
      systemSteps.length ||
      procedure.fees_charges?.trim()
  );

  if (!hasDecisionData && !hasOperationalData) return null;

  return (
    <div className="space-y-5">
      {hasDecisionData && (
        <section className="content-card quick-card overflow-hidden border-t-2 border-t-navy">
          <div className="border-b border-border bg-white px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              Decision summary
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold text-ink">
              Can I action this?
            </h2>
          </div>
          <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-3">
            <DecisionFact
              label="Status"
              value={procedure.is_published ? "Operational guidance available" : "Draft guidance - not public"}
            />
            <DecisionFact label="Service code" value={procedure.service_code} />
            <DecisionFact label="Service type" value={procedure.service_type} />
            <DecisionFact label={timingLabel} value={procedure.cut_off_time} />
            <DecisionListFact label="Channels" items={channels} />
            <DecisionListFact label="Who can action" items={whoCanAction} />
          </div>
        </section>
      )}

      {procedure.cut_off_time && (
        <section className="rounded-lg border border-orange-200 border-l-4 border-l-accent bg-orange-50 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            {isReferenceTimingCard(procedure) ? "Operational Timing Rule" : "Operational Deadline"}
          </p>
          <div className="mt-3">
            <StructuredText value={procedure.cut_off_time} />
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <InteractiveChecklist title="Required information" items={requiredInfo} />
          <OperationalPanel title="Eligibility / applicability" items={allowed} tone="plain" />
          {procedure.fees_charges && (
            <section className="content-card quick-card p-5">
              <h2 className="font-display text-base font-semibold text-sky">Fees / charges</h2>
              <p className="mt-2.5 whitespace-pre-line text-sm font-semibold leading-6 text-ink">
                {procedure.fees_charges}
              </p>
            </section>
          )}
        </div>
        <div className="space-y-5">
          <ActionTimeline items={systemSteps} />
          <OperationalPanel title="Restrictions" items={restrictions} tone="danger" />
          <OperationalPanel title="Escalation required" items={escalation} tone="warning" />
          <OperationalPanel title="Passenger Advice" items={passengerAdvice} tone="info" />
        </div>
      </div>
    </div>
  );
}

function DecisionFact({ label, value }: { label: string; value: string | undefined | null }) {
  const text = value?.trim();
  if (!text) return null;

  return (
    <div className="border-b border-r border-border bg-white px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-sky">{label}</p>
      <p className="mt-1 line-clamp-3 text-sm font-semibold leading-5 text-ink">{text}</p>
    </div>
  );
}

function DecisionListFact({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="border-b border-r border-border bg-white px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-sky">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.slice(0, 4).map((item) => (
          <span key={item} className="rounded-sm border border-blue-200 bg-sky-soft px-2 py-0.5 text-xs font-semibold text-sky">
            {item}
          </span>
        ))}
        {items.length > 4 && (
          <span
            className="rounded-sm border border-border bg-white px-2 py-0.5 text-xs font-semibold text-ink-muted"
            aria-label={`${items.length - 4} more ${label.toLowerCase()}`}
          >
            +{items.length - 4} more
          </span>
        )}
      </div>
    </div>
  );
}

function ActionTimeline({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  return (
    <section className="content-card quick-card p-5">
      <h2 className="font-display text-base font-semibold text-sky">System Steps</h2>
      <ol className="relative mt-3 space-y-3 before:absolute before:bottom-3 before:left-[0.84rem] before:top-3 before:w-px before:bg-border">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="relative grid grid-cols-[1.75rem_1fr] gap-3">
            <span className="z-10 flex h-7 w-7 items-center justify-center rounded-full bg-navy text-xs font-bold text-white ring-4 ring-white">
              {index + 1}
            </span>
            <span className="pt-0.5 text-sm font-medium leading-6 text-ink">{item}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function OperationalPanel({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "plain" | "danger" | "warning" | "info";
}) {
  if (items.length === 0) return null;

  const styles = {
    plain: "border-blue-100 bg-white text-ink",
    danger: "border-red-200 border-l-4 border-l-red-500 bg-red-50 text-red-800",
    warning: "border-warn/30 border-l-4 border-l-warn bg-warn/10 text-ink",
    info: "border-blue-200 bg-sky-soft text-ink",
  };
  const marker = {
    plain: "bg-sky",
    danger: "bg-red-500",
    warning: "bg-warn",
    info: "bg-sky",
  };

  return (
    <section className={`rounded-lg border p-5 ${styles[tone]}`}>
      <h2 className={`font-display text-base font-semibold ${tone === "danger" ? "text-red-700" : "text-sky"}`}>
        {title}
      </h2>
      <ul className="mt-3 space-y-2.5">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-3 text-sm font-medium leading-6">
            <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${marker[tone]}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StructuredText({ value }: { value: string }) {
  const groups = timingGroups(value);
  const isStructured = groups.length > 1 || groups.some((group) => group.items.length > 1);

  if (!isStructured) {
    return <span className="text-sm font-semibold text-ink">{value}</span>;
  }

  return (
    <div className="space-y-3">
      {groups.map((group, index) => (
        <div key={`${group.heading}-${index}`}>
          {group.heading && (
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent">
              {group.heading}
            </p>
          )}
          <ul className="mt-1 space-y-1">
            {group.items.map((item) => (
              <li key={item} className="text-sm font-semibold leading-6 text-ink">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function firstTimingLine(value: string) {
  const text = value.trim();
  const lines = text.includes("\n") ? text.split(/\r?\n/) : text.includes(";") ? text.split(";") : [text];
  return lines.map((line) => line.trim()).filter(Boolean)[0] ?? "";
}

function getTimingLabel(card: Pick<ProcedureCardWithChapter, "service_code" | "service_type" | "category">) {
  if (card.service_code?.toUpperCase() === "MCT") return "MCT rule";
  const type = `${card.service_type ?? ""} ${card.category ?? ""}`.toLowerCase();
  if (type.includes("reference")) return "Reference rule";
  if (type.includes("rule")) return "Timing rule";
  return "Cut-off time";
}

function isReferenceTimingCard(card: Pick<ProcedureCardWithChapter, "service_code" | "service_type" | "category">) {
  return getTimingLabel(card) !== "Cut-off time";
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

    const isHeading = isTimingHeading(line) && current.items.length === 0;
    if (isHeading) {
      current.heading = line;
    } else {
      current.items.push(line);
    }
  }

  if (current.heading || current.items.length) groups.push(current);
  return groups.length ? groups : [{ heading: "", items: [text] }];
}

function ListSection({
  title,
  items,
  canShowFallback,
  hiddenItems,
}: {
  title: string;
  items: JsonValue[];
  canShowFallback: boolean;
  hiddenItems: Set<string>;
}) {
  const readableItems = items
    .map((item) => readableJsonItem(item))
    .filter(Boolean)
  const renderedItems = readableItems.filter((item) => !hiddenItems.has(normalizeOperationalText(item)));
  if (renderedItems.length === 0) return null;

  return (
    <section className="content-card quick-card p-5">
      <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
      <ol className="mt-3 space-y-2.5">
        {renderedItems.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-3 text-sm leading-6 text-ink-muted">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent-soft text-xs font-bold text-accent">
              {index + 1}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
      {canShowFallback && readableItems.length !== items.length && (
        <p className="mt-4 text-xs text-ink-faint">
          Some structured items use an unsupported shape and are hidden from the public view.
        </p>
      )}
    </section>
  );
}

function ProcedureSourceAuditDetails({
  procedure,
  sourcePages,
  updatedAt,
}: {
  procedure: ProcedureCardWithChapter;
  sourcePages: string;
  updatedAt: string;
}) {
  return (
    <details className="content-card overflow-hidden">
      <summary className="cursor-pointer list-none px-5 py-4 marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint">
              Source & audit details
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Source version, pages, confidence, and linked chapter.
            </p>
          </div>
          <span className="rounded border border-border bg-white px-3 py-1 text-xs font-semibold text-ink-muted">
            Show audit details
          </span>
        </div>
      </summary>
      <div className="border-t border-border p-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {procedure.source_version && <Fact label="Source" value={procedure.source_version} />}
          {sourcePages && <Fact label="Pages" value={sourcePages} />}
          {procedure.source_updated_at && (
            <Fact label="Source updated" value={safeDate(procedure.source_updated_at)} />
          )}
          {updatedAt && <Fact label="Procedure updated" value={updatedAt} />}
          {procedure.source_confidence && (
            <Fact label="Confidence" value={procedure.source_confidence.replace("_", " ")} />
          )}
        </dl>

        {procedure.chapters && (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Related chapter
            </p>
            <Link
              href={`/chapter/${procedure.chapters.slug}`}
              className="mt-2 inline-flex rounded-md border border-border bg-white px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
            >
              Chapter {String(procedure.chapters.chapter_number).padStart(2, "0")} - {procedure.chapters.title}
            </Link>
          </div>
        )}
      </div>
    </details>
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

function readableJsonItem(item: JsonValue) {
  if (typeof item === "string") return meaningfulText(item);
  if (typeof item === "number" || typeof item === "boolean") return meaningfulText(String(item));
  if (!item || Array.isArray(item)) return "";

  const record = item as Record<string, JsonValue>;
  for (const key of ["label", "text", "value", "title", "description"]) {
    const value = record[key];
    if (typeof value === "string") return meaningfulText(value);
  }

  return "";
}

function structuredOperationalItems(procedure: ProcedureCardWithChapter) {
  return new Set(
    [...procedure.system_steps, ...procedure.allowed, ...procedure.not_allowed]
      .map((item) => readableJsonItem(item))
      .filter(Boolean)
      .map(normalizeOperationalText)
  );
}

function normalizeOperationalText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function meaningfulText(value: string) {
  const text = value.trim();
  if (!text) return "";
  return ["n/a", "none", "no data", "null", "undefined"].includes(text.toLowerCase()) ? "" : text;
}

function isTimingHeading(value: string) {
  return /^\s*[a-z0-9/]+\s*(?:->|→)\s*[a-z0-9/]+\s*$/i.test(value);
}

function formatSourcePages(pages: number[]) {
  if (!pages.length) return "";

  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  if (sorted.length === 1) return `Page ${sorted[0]}`;

  const isContiguous = sorted.every((page, index) => index === 0 || page === sorted[index - 1] + 1);
  if (isContiguous) return `Pages ${sorted[0]}-${sorted[sorted.length - 1]}`;

  return `Pages ${sorted.join(", ")}`;
}

function safeDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}
