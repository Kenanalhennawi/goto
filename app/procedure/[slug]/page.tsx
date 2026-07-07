import { CopyLinkButton } from "@/components/CopyLinkButton";
import { SiteHeader } from "@/components/SiteHeader";
import { getProcedureBySlug, type ProcedureCardWithChapter } from "@/lib/procedures";
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

  return (
    <div className="dashboard-shell flex min-h-full flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Link
            href="/search"
            className="inline-flex rounded-lg bg-white px-3 py-2 text-xs font-semibold text-ink-muted shadow-sm ring-1 ring-border transition-colors hover:text-accent"
          >
            &larr; Back to search
          </Link>
          <Link
            href="/"
            className="inline-flex rounded-lg bg-white px-3 py-2 text-xs font-semibold text-ink-muted shadow-sm ring-1 ring-border transition-colors hover:text-accent"
          >
            Back to guide
          </Link>
        </div>

        <section className="hero-panel mb-6 overflow-hidden rounded-[22px]">
          <div className="grid gap-0 lg:grid-cols-[1fr_300px]">
            <div className="hero-main border-b border-border/80 p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Procedure
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {procedure.service_code && (
                  <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-accent">
                    {procedure.service_code}
                  </span>
                )}
                {procedure.service_type && (
                  <span className="rounded-full border border-blue-200 bg-sky-soft px-3 py-1 text-xs font-semibold text-sky">
                    {procedure.service_type}
                  </span>
                )}
                <span className="rounded-full border border-blue-200 bg-sky-soft px-3 py-1 text-xs font-semibold text-sky">
                  {procedure.category}
                </span>
                {canManage && (
                  <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-ink-muted">
                    {procedure.review_status.replace("_", " ")}
                  </span>
                )}
              </div>

              <h1 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
                {procedure.title}
              </h1>

              {procedure.summary && (
                <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-muted">
                  {procedure.summary}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <CopyLinkButton path={path} />
                {procedure.chapters && (
                  <Link
                    href={`/chapter/${procedure.chapters.slug}`}
                    className="inline-flex rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent"
                  >
                    Open source chapter
                  </Link>
                )}
              </div>

              {(procedure.keywords.length > 0 || procedure.aliases.length > 0) && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {[...procedure.keywords, ...procedure.aliases].slice(0, 12).map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full border border-border bg-white/80 px-3 py-1 text-xs font-medium text-ink-muted"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <SourceEvidenceCard
              procedure={procedure}
              sourcePages={sourcePages}
              updatedAt={updatedAt}
            />
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <ServiceCardSections procedure={procedure} />
            <TextSection title="Summary" value={procedure.summary} />
            <TextSection title="When to use" value={procedure.when_to_use} />
            <ListSection title="Agent action" items={procedure.agent_action} canShowFallback={canManage} />
            <ListSection title="Rules" items={procedure.rules} canShowFallback={canManage} />
            <ListSection title="Exceptions" items={procedure.exceptions} canShowFallback={canManage} />
            <TextSection title="Required approval" value={procedure.required_approval} />
            <TextSection title="Customer script" value={procedure.customer_script} isScript />
            <TextSection title="SPRINT comment template" value={procedure.sprint_comment_template} isScript />
            <TextSection title="Salesforce classification" value={procedure.salesforce_classification} />
          </div>

          <aside className="space-y-5">
            <section className="content-card quick-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Source evidence
              </p>
              <dl className="mt-4 space-y-3 text-sm">
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
            </section>

            {procedure.chapters && (
              <section className="content-card quick-card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                  Related chapter
                </p>
                <Link
                  href={`/chapter/${procedure.chapters.slug}`}
                  className="mt-3 block rounded-xl border border-border bg-white p-4 transition-colors hover:border-accent"
                >
                  <span className="text-xs font-semibold text-ink-faint">
                    Chapter {String(procedure.chapters.chapter_number).padStart(2, "0")}
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-ink">
                    {procedure.chapters.title}
                  </span>
                </Link>
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
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
    <section className="content-card quick-card p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      <p
        className={`mt-3 whitespace-pre-line text-sm leading-7 text-ink-muted ${
          isScript ? "rounded-xl border border-blue-200 bg-sky-soft p-4 font-mono text-xs text-ink" : ""
        }`}
      >
        {text}
      </p>
    </section>
  );
}

function ServiceCardSections({ procedure }: { procedure: ProcedureCardWithChapter }) {
  const timingLabel = getTimingLabel(procedure);
  const listSections = [
    { title: "Channels", items: procedure.channels },
    { title: "Who can action", items: procedure.who_can_action },
    { title: "Required information", items: procedure.required_information },
    { title: "System steps", items: procedure.system_steps },
    { title: "Passenger advice", items: procedure.passenger_advice },
    { title: "Allowed", items: procedure.allowed },
    { title: "Not allowed", items: procedure.not_allowed },
    { title: "Escalation", items: procedure.escalation_points },
  ];
  const hasListContent = listSections.some((section) =>
    section.items.some((item) => readableJsonItem(item))
  );
  const hasFacts = Boolean(procedure.cut_off_time?.trim() || procedure.fees_charges?.trim());

  if (!hasListContent && !hasFacts) return null;

  return (
    <section className="content-card quick-card p-5 sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Service card
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
          Operational handling
        </h2>
      </div>

      {hasFacts && (
        <dl className="mb-5 grid gap-3 sm:grid-cols-2">
          {procedure.cut_off_time && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-accent">
                {timingLabel}
              </dt>
              <dd className="mt-2">
                <StructuredText value={procedure.cut_off_time} />
              </dd>
            </div>
          )}
          {procedure.fees_charges && (
            <div className="rounded-xl border border-border bg-white p-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Fees / charges
              </dt>
              <dd className="mt-1 whitespace-pre-line text-sm font-semibold text-ink">
                {procedure.fees_charges}
              </dd>
            </div>
          )}
        </dl>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {listSections.map((section) => {
          const items = section.items.map(readableJsonItem).filter(Boolean);
          if (items.length === 0) return null;

          return (
            <div key={section.title} className="rounded-xl border border-border bg-white p-4">
              <h3 className="font-display text-base font-semibold text-ink">{section.title}</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-ink-muted">
                {items.map((item, index) => (
                  <li key={`${section.title}-${index}`} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
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

function getTimingLabel(card: Pick<ProcedureCardWithChapter, "service_code" | "service_type" | "category">) {
  if (card.service_code?.toUpperCase() === "MCT") return "MCT rule";
  const type = `${card.service_type ?? ""} ${card.category ?? ""}`.toLowerCase();
  if (type.includes("reference")) return "Reference rule";
  if (type.includes("rule")) return "Timing rule";
  return "Cut-off time";
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

function ListSection({
  title,
  items,
  canShowFallback,
}: {
  title: string;
  items: JsonValue[];
  canShowFallback: boolean;
}) {
  const renderedItems = items.map((item) => readableJsonItem(item)).filter(Boolean);
  if (renderedItems.length === 0) return null;

  return (
    <section className="content-card quick-card p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      <ol className="mt-4 space-y-3">
        {renderedItems.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-3 text-sm leading-6 text-ink-muted">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
              {index + 1}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
      {canShowFallback && renderedItems.length !== items.length && (
        <p className="mt-4 text-xs text-ink-faint">
          Some structured items use an unsupported shape and are hidden from the public view.
        </p>
      )}
    </section>
  );
}

function SourceEvidenceCard({
  procedure,
  sourcePages,
  updatedAt,
}: {
  procedure: ProcedureCardWithChapter;
  sourcePages: string;
  updatedAt: string;
}) {
  return (
    <aside className="bg-white/75 p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
        Source evidence
      </p>
      <dl className="mt-4 space-y-3 text-sm">
        {procedure.source_version && <Fact label="Source" value={procedure.source_version} />}
        {sourcePages && <Fact label="Pages" value={sourcePages} />}
        {updatedAt && <Fact label="Updated" value={updatedAt} />}
        {procedure.chapters && (
          <Fact
            label="Chapter"
            value={`${String(procedure.chapters.chapter_number).padStart(2, "0")} ${procedure.chapters.title}`}
          />
        )}
      </dl>
    </aside>
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
  if (typeof item === "string") return item.trim();
  if (typeof item === "number" || typeof item === "boolean") return String(item);
  if (!item || Array.isArray(item)) return "";

  const record = item as Record<string, JsonValue>;
  for (const key of ["label", "text", "value", "title", "description"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
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
