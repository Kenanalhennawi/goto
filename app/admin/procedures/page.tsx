import { SiteHeader } from "@/components/SiteHeader";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { JsonValue } from "@/lib/types";
import Link from "next/link";
import { redirect } from "next/navigation";
import { canReviewProcedures, normalizeRoleLabel } from "@/lib/permissions";

type SearchParams = {
  status?: string;
  published?: string;
  quality?: string;
  area?: string;
  q?: string;
};

type ProcedureListRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  service_code: string | null;
  service_type: string | null;
  cut_off_time: string | null;
  passenger_advice: JsonValue[];
  not_allowed: JsonValue[];
  escalation_points: JsonValue[];
  source_confidence: string | null;
  review_status: string;
  is_published: boolean;
  priority: number;
  updated_at: string;
  chapters:
    | {
        chapter_number: number;
        title: string;
        slug: string;
      }
    | {
        chapter_number: number;
        title: string;
        slug: string;
      }[]
    | null;
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

export default async function AdminProceduresPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: role } = await supabase
    .from("user_roles")
    .select("role, full_name")
    .eq("user_id", user.id)
    .single();

  if (!canReviewProcedures(role?.role)) {
    redirect("/admin");
  }

  const activeRole = role!;
  const { data: procedures } = await supabase
    .from("procedure_cards")
    .select(
      "id, title, slug, category, service_code, service_type, cut_off_time, passenger_advice, not_allowed, escalation_points, source_confidence, review_status, is_published, priority, updated_at, chapters(chapter_number, title, slug)"
    )
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false });

  const allRows = (procedures ?? []) as unknown as ProcedureListRow[];
  const rows = filterRows(allRows, filters);
  const summary = qualitySummary(allRows);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/admin" className="mb-4 inline-flex text-xs font-semibold text-ink-muted hover:text-accent">
              &larr; Back to dashboard
            </Link>
            <h1 className="font-display text-2xl font-semibold text-ink">
              Operational Card Review
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Review draft cards, quality warnings, and publishing status.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-white px-4 py-3 text-xs text-ink-muted">
            Signed in as {activeRole.full_name ?? user.email} - {normalizeRoleLabel(activeRole.role)}
          </div>
        </div>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile label="Total cards" value={summary.total} />
          <SummaryTile label="Published" value={summary.published} tone="good" />
          <SummaryTile label="Drafts / needs review" value={summary.drafts} tone="warn" />
          <SummaryTile label="Ready-looking" value={summary.ready} tone="good" />
          <SummaryTile label="Missing deadline" value={summary.missingDeadline} tone="warn" />
          <SummaryTile label="Missing passenger advice" value={summary.missingPassengerAdvice} tone="warn" />
          <SummaryTile label="Missing restrictions" value={summary.missingRestrictions} tone="warn" />
          <SummaryTile label="Missing escalation" value={summary.missingEscalation} tone="warn" />
          <SummaryTile label="Missing source confidence" value={summary.missingSourceConfidence} tone="warn" />
        </section>

        <section className="content-card mb-6 p-4">
          <form action="/admin/procedures" className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
            <input
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Search by title, slug, service code, or type..."
              autoComplete="off"
              className="rounded-xl border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-sky"
            />
            <select
              name="quality"
              defaultValue={filters.quality ?? ""}
              className="rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-ink outline-none transition-colors focus:border-sky"
            >
              <option value="">All quality states</option>
              <option value="ready">Ready-looking</option>
              <option value="missing_deadline">Missing deadline</option>
              <option value="missing_passenger_advice">Missing passenger advice</option>
              <option value="missing_restrictions">Missing restrictions</option>
              <option value="missing_escalation">Missing escalation</option>
              <option value="missing_source_confidence">Missing source confidence</option>
            </select>
            <select
              name="area"
              defaultValue={filters.area ?? ""}
              className="rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-ink outline-none transition-colors focus:border-sky"
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
              className="rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent"
            >
              Search
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            <FilterLink href="/admin/procedures" active={!filters.status && !filters.published && !filters.quality && !filters.area && !filters.q}>
              All
            </FilterLink>
            <FilterLink href="/admin/procedures?status=needs_review" active={filters.status === "needs_review"}>
              Drafts only
            </FilterLink>
            <FilterLink href="/admin/procedures?published=true" active={filters.published === "true"}>
              Published only
            </FilterLink>
            {[
              ["ready", "Ready-looking"],
              ["missing_deadline", "Missing deadline"],
              ["missing_passenger_advice", "Missing passenger advice"],
              ["missing_restrictions", "Missing restrictions"],
              ["missing_escalation", "Missing escalation"],
              ["missing_source_confidence", "Missing source confidence"],
            ].map(([quality, label]) => (
              <FilterLink
                key={quality}
                href={`/admin/procedures?quality=${quality}`}
                active={filters.quality === quality}
              >
                {label}
              </FilterLink>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
            {WORK_AREAS.map((area) => (
              <FilterLink
                key={area}
                href={`/admin/procedures?area=${encodeURIComponent(area)}`}
                active={filters.area === area}
              >
                {area}
              </FilterLink>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          {rows.length > 0 ? (
            rows.map((procedure) => {
              const chapter = firstChapter(procedure.chapters);
              const badges = qualityBadges(procedure);
              const priority = reviewPriority(procedure);

              return (
                <article key={procedure.id} className="content-card quick-card p-4 sm:p-5">
                  <div className="grid gap-4 lg:grid-cols-[1fr_180px_120px] lg:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {procedure.service_code && <MetaBadge>{procedure.service_code}</MetaBadge>}
                        {procedure.service_type && <MetaBadge>{procedure.service_type}</MetaBadge>}
                        <MetaBadge>{workAreaFor(procedure)}</MetaBadge>
                        <PriorityBadge priority={priority} />
                      </div>
                      <h2 className="mt-3 font-display text-xl font-semibold text-ink">{procedure.title}</h2>
                      <p className="mt-1 font-mono text-xs text-ink-faint">{procedure.slug}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {badges.map((badge) => (
                          <QualityBadge key={badge} label={badge} />
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-ink-muted">
                        Updated {safeDate(procedure.updated_at)}
                        {chapter ? ` - Ch. ${String(chapter.chapter_number).padStart(2, "0")} ${chapter.title}` : " - Not linked"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <StatusBadge status={procedure.review_status} published={procedure.is_published} />
                      <div className="rounded border border-border bg-white px-2 py-1 text-[11px] font-semibold text-ink-muted">
                        Confidence: {procedure.source_confidence?.replace("_", " ") || "missing"}
                      </div>
                    </div>

                    <Link
                      href={`/admin/procedures/${procedure.slug}`}
                      className="inline-flex justify-center rounded-lg border border-blue-200 bg-sky-soft px-4 py-2 text-xs font-semibold text-sky transition-colors hover:border-sky hover:bg-white"
                    >
                      Review
                    </Link>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="content-card p-8 text-center text-sm text-ink-muted">
              No operational cards match these filters.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "good" | "warn";
}) {
  const toneClass =
    tone === "good"
      ? "border-good/20 bg-good/10 text-good"
      : tone === "warn"
        ? "border-warn/20 bg-warn/10 text-warn"
        : "border-border bg-white text-ink";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-75">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
    </div>
  );
}

function MetaBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-muted">
      {children}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: "High" | "Medium" | "Low" }) {
  const classes =
    priority === "High"
      ? "border-red-200 bg-red-50 text-red-700"
      : priority === "Medium"
        ? "border-warn/20 bg-warn/10 text-warn"
        : "border-good/20 bg-good/10 text-good";

  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${classes}`}>{priority}</span>;
}

function QualityBadge({ label }: { label: string }) {
  const critical = label.startsWith("Missing") || label === "Draft";
  return (
    <span
      className={`rounded border px-2 py-0.5 text-[11px] ${
        critical ? "border-warn/20 bg-warn/10 text-warn" : "border-good/20 bg-good/10 text-good"
      }`}
    >
      {label}
    </span>
  );
}

function FilterLink({
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
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "border-accent bg-accent text-white"
          : "border-border bg-white text-ink-muted hover:border-accent hover:text-accent"
      }`}
    >
      {children}
    </Link>
  );
}

function StatusBadge({ status, published }: { status: string; published: boolean }) {
  const styles: Record<string, string> = {
    draft: "border-ink-faint/20 bg-ink-faint/10 text-ink-muted",
    needs_review: "border-warn/20 bg-warn/10 text-warn",
    approved: "border-good/20 bg-good/10 text-good",
    archived: "border-border bg-panel-hover text-ink-faint",
  };

  return (
    <div className="flex flex-wrap gap-1">
      <span className={`rounded border px-2 py-0.5 text-[11px] ${styles[status] ?? styles.needs_review}`}>
        {status.replace("_", " ")}
      </span>
      <span
        className={`rounded border px-2 py-0.5 text-[11px] ${
          published ? "border-good/20 bg-good/10 text-good" : "border-border bg-white text-ink-faint"
        }`}
      >
        {published ? "published" : "unpublished"}
      </span>
    </div>
  );
}

function filterRows(rows: ProcedureListRow[], filters: SearchParams) {
  const q = normalize(filters.q ?? "");
  return rows.filter((row) => {
    if (filters.status && row.review_status !== filters.status) return false;
    if (filters.published === "true" && !row.is_published) return false;
    if (filters.published === "false" && row.is_published) return false;
    if (filters.area && workAreaFor(row) !== filters.area) return false;
    if (filters.quality && !matchesQuality(row, filters.quality)) return false;
    if (!q) return true;

    const haystack = normalize(
      [row.title, row.slug, row.service_code ?? "", row.service_type ?? "", row.category].join(" ")
    );
    return haystack.includes(q);
  });
}

function matchesQuality(row: ProcedureListRow, quality: string) {
  const badges = qualityBadges(row);
  if (quality === "ready") return badges.includes("Ready-looking");
  if (quality === "missing_deadline") return badges.includes(isReferenceCard(row) ? "Missing timing rule" : "Missing deadline");
  if (quality === "missing_passenger_advice") return badges.includes("Missing passenger advice");
  if (quality === "missing_restrictions") return badges.includes("Missing restrictions");
  if (quality === "missing_escalation") return badges.includes("Missing escalation");
  if (quality === "missing_source_confidence") return badges.includes("Missing source confidence");
  return true;
}

function qualitySummary(rows: ProcedureListRow[]) {
  return rows.reduce(
    (summary, row) => {
      const badges = qualityBadges(row);
      summary.total += 1;
      if (row.is_published) summary.published += 1;
      if (!row.is_published || row.review_status === "needs_review" || row.review_status === "draft") summary.drafts += 1;
      if (badges.includes("Ready-looking")) summary.ready += 1;
      if (badges.includes("Missing deadline") || badges.includes("Missing timing rule")) summary.missingDeadline += 1;
      if (badges.includes("Missing passenger advice")) summary.missingPassengerAdvice += 1;
      if (badges.includes("Missing restrictions")) summary.missingRestrictions += 1;
      if (badges.includes("Missing escalation")) summary.missingEscalation += 1;
      if (badges.includes("Missing source confidence")) summary.missingSourceConfidence += 1;
      return summary;
    },
    {
      total: 0,
      published: 0,
      drafts: 0,
      ready: 0,
      missingDeadline: 0,
      missingPassengerAdvice: 0,
      missingRestrictions: 0,
      missingEscalation: 0,
      missingSourceConfidence: 0,
    }
  );
}

function reviewPriority(row: ProcedureListRow): "High" | "Medium" | "Low" {
  const badges = qualityBadges(row);
  const isDraft = !row.is_published || row.review_status === "needs_review" || row.review_status === "draft";
  const critical = badges.some((badge) =>
    ["Missing deadline", "Missing timing rule", "Missing passenger advice", "Missing restrictions"].includes(badge)
  );
  if (isDraft && critical) return "High";
  if (isDraft) return "Medium";
  return "Low";
}

function safeDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function firstChapter(chapters: ProcedureListRow["chapters"]) {
  return Array.isArray(chapters) ? chapters[0] ?? null : chapters;
}

function qualityBadges(procedure: ProcedureListRow) {
  const badges: string[] = [];
  const isReference = isReferenceCard(procedure);
  if (!procedure.is_published || procedure.review_status === "needs_review" || procedure.review_status === "draft") {
    badges.push("Draft");
  } else {
    badges.push("Published");
  }
  if (isReference && !hasText(procedure.cut_off_time)) badges.push("Missing timing rule");
  if (!isReference && !hasText(procedure.cut_off_time)) badges.push("Missing deadline");
  if (!hasItems(procedure.passenger_advice)) badges.push("Missing passenger advice");
  if (!hasItems(procedure.not_allowed)) badges.push("Missing restrictions");
  if (!hasItems(procedure.escalation_points)) badges.push("Missing escalation");
  if (!hasText(procedure.source_confidence)) badges.push("Missing source confidence");
  if (badges.length === (procedure.is_published ? 1 : 1)) badges.push("Ready-looking");
  return badges;
}

function isReferenceCard(card: Pick<ProcedureListRow, "service_code" | "service_type" | "category">) {
  const type = `${card.service_type ?? ""} ${card.category ?? ""}`.toLowerCase();
  return (
    card.service_code?.toUpperCase() === "MCT" ||
    type.includes("reference") ||
    type.includes("rule") ||
    type.includes("timing") ||
    type.includes("connection reference")
  );
}

function workAreaFor(card: Pick<ProcedureListRow, "service_code" | "service_type" | "category" | "title">): WorkArea {
  const text = normalize(`${card.service_type ?? ""} ${card.category} ${card.service_code ?? ""} ${card.title}`);

  if (matches(text, ["payment", "refund", "voucher", "insurance"])) return "Payment / Refund";
  if (matches(text, ["fdis", "disruption", "delay", "schedule"])) return "Disruption";
  if (matches(text, ["mct", "connection", "transfer", "interline", "codeshare"])) return "Interline / Connections";
  if (matches(text, ["visa", "oktb", "ok to board"])) return "Visa / OKTB";
  if (matches(text, ["wheelchair", "wchr", "wchs", "wchc", "meda", "dpna", "pregnancy"])) return "Special Assistance";
  if (matches(text, ["check in", "check-in", "olci", "lounge", "boarding", "airport"])) return "Airport / Check-in";
  if (matches(text, ["baggage", "speq", "spex", "falcon", "petc"])) return "Baggage";
  if (matches(text, ["booking", "name", "seat", "cbbg", "exst", "stopover", "government", "fare"])) return "Booking Changes";
  return "Other References";
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function hasItems(items: JsonValue[] | null | undefined) {
  return Array.isArray(items) && items.some((item) => readableJsonItem(item));
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
