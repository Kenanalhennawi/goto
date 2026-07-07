import Link from "next/link";
import type { JsonValue, ProcedureCard } from "@/lib/types";

export function OperationalSummary({
  cards,
  canReview,
  showEmpty = false,
}: {
  cards: ProcedureCard[];
  canReview: boolean;
  showEmpty?: boolean;
}) {
  if (cards.length === 0 && !showEmpty) return null;

  return (
    <section className="mb-6 rounded-[22px] border border-blue-100 bg-white/90 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Operational summary
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
            Structured service cards linked to this chapter
          </h2>
        </div>
      </div>

      {cards.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-slate-50 px-4 py-3 text-sm text-ink-muted">
          No operational cards linked to this chapter yet.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {cards.map((card) => (
            <OperationalCard key={card.id} card={card} canReview={canReview} />
          ))}
        </div>
      )}
    </section>
  );
}

function OperationalCard({ card, canReview }: { card: ProcedureCard; canReview: boolean }) {
  const isDraft = card.review_status !== "approved" || !card.is_published;
  const timing = textValue(card.cut_off_time);
  const whoCanAction = jsonItems(card.who_can_action);
  const passengerAdvice = jsonItems(card.passenger_advice);
  const channels = jsonItems(card.channels);
  const missingServiceDeadline = canReview && isServiceCard(card) && !timing;

  return (
    <article className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {card.service_code && <Badge tone="sky">{card.service_code}</Badge>}
            {card.service_type && <Badge>{card.service_type}</Badge>}
            {card.category && <Badge>{card.category}</Badge>}
            {canReview && isDraft && <Badge tone="orange">Draft / Needs review</Badge>}
          </div>
          <h3 className="mt-2 font-display text-xl font-semibold text-ink">{card.title}</h3>
          {card.summary && <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">{card.summary}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={`/procedure/${card.slug}`}
            className="rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent"
          >
            Open full card
          </Link>
          {canReview && isDraft && (
            <Link
              href={`/admin/procedures/${card.slug}`}
              className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-white"
            >
              Review in admin
            </Link>
          )}
        </div>
      </div>

      {canReview && isDraft && (
        <p className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-accent">
          Draft content. Review before publishing.
        </p>
      )}

      {missingServiceDeadline && (
        <p className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-accent">
          This service card has no deadline/cut-off captured yet. Review source before publishing.
        </p>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DecisionFact
          label={isReferenceCard(card) ? "Timing rule" : "Deadline / cut-off"}
          value={timing}
          emptyLabel={canReview && isServiceCard(card) ? "Needs review" : undefined}
        />
        <DecisionFact
          label="Can Contact Centre action?"
          value={bestActionOwner(whoCanAction, channels)}
        />
        <DecisionFact label="Who handles it?" value={firstValue(whoCanAction)} />
        <DecisionFact label="What to tell passenger" value={firstValue(passengerAdvice)} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {timing && <TextField label={timingLabel(card)} value={timing} preserveLines />}
        <ListField label="Channels" values={channels} />
        <ListField label="Who can action" values={whoCanAction} />
        <ListField label="Required information" values={jsonItems(card.required_information)} />
        <ListField label="System steps" values={jsonItems(card.system_steps)} wide />
        <ListField label="Passenger advice" values={passengerAdvice} wide />
        <ListField label="Allowed" values={jsonItems(card.allowed)} />
        <ListField label="Not allowed" values={jsonItems(card.not_allowed)} />
        <ListField label="Escalation points" values={jsonItems(card.escalation_points)} wide />
        {card.fees_charges && <TextField label="Fees / charges" value={card.fees_charges} />}
        {card.source_confidence && <TextField label="Source confidence" value={sourceConfidenceLabel(card.source_confidence)} />}
      </div>
    </article>
  );
}

function DecisionFact({
  label,
  value,
  emptyLabel,
}: {
  label: string;
  value: string | null;
  emptyLabel?: string;
}) {
  if (!value && !emptyLabel) return null;

  return (
    <div className="rounded-xl border border-blue-100 bg-sky-soft/70 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-sky">{label}</p>
      <p className="mt-1 line-clamp-3 text-sm font-semibold leading-6 text-ink">
        {value ?? emptyLabel}
      </p>
    </div>
  );
}

function TextField({
  label,
  value,
  preserveLines = false,
}: {
  label: string;
  value: string;
  preserveLines?: boolean;
}) {
  if (!textValue(value)) return null;
  return (
    <div className="rounded-xl border border-border bg-slate-50 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
      <p className={`mt-1 text-sm leading-6 text-ink ${preserveLines ? "whitespace-pre-line" : ""}`}>{value}</p>
    </div>
  );
}

function ListField({ label, values, wide = false }: { label: string; values: string[]; wide?: boolean }) {
  if (values.length === 0) return null;
  return (
    <div className={`rounded-xl border border-border bg-slate-50 px-3 py-3 ${wide ? "lg:col-span-2" : ""}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
      <ul className="mt-2 space-y-1.5 text-sm leading-6 text-ink">
        {values.map((value) => (
          <li key={value} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span>{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Badge({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "sky" | "orange" }) {
  const classes =
    tone === "sky"
      ? "border-blue-200 bg-sky-soft text-sky"
      : tone === "orange"
        ? "border-orange-200 bg-orange-50 text-accent"
        : "border-border bg-slate-50 text-ink-muted";

  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${classes}`}>{children}</span>;
}

function timingLabel(card: ProcedureCard) {
  const type = `${card.service_type ?? ""} ${card.category ?? ""}`.toLowerCase();
  if (card.service_code?.toUpperCase() === "MCT") return "MCT rule";
  if (type.includes("reference") || type.includes("rule")) return "Timing rule";
  return "Cut-off";
}

function isReferenceCard(card: ProcedureCard) {
  const type = `${card.service_type ?? ""} ${card.category ?? ""}`.toLowerCase();
  return card.service_code?.toUpperCase() === "MCT" || type.includes("reference") || type.includes("rule");
}

function isServiceCard(card: ProcedureCard) {
  const type = `${card.service_type ?? ""} ${card.category ?? ""}`.toLowerCase();
  if (isReferenceCard(card)) return false;
  return ["service", "booking", "baggage", "special assistance"].some((term) => type.includes(term));
}

function firstValue(values: string[]) {
  return values[0] ?? null;
}

function bestActionOwner(whoCanAction: string[], channels: string[]) {
  const contactCentre = [...whoCanAction, ...channels].find((value) =>
    /contact centre|contact center/i.test(value)
  );
  return contactCentre ?? firstValue(whoCanAction) ?? firstValue(channels);
}

function jsonItems(value: JsonValue[] | null | undefined) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => itemText(item))
    .filter((item): item is string => Boolean(item));
}

function itemText(item: JsonValue): string | null {
  if (typeof item === "string") return textValue(item);
  if (typeof item === "number" || typeof item === "boolean") return String(item);
  if (!item || Array.isArray(item) || typeof item !== "object") return null;

  const record = item as Record<string, JsonValue>;
  for (const key of ["label", "text", "value", "title", "name"]) {
    const value = record[key];
    if (typeof value === "string") return textValue(value);
  }
  return null;
}

function textValue(value: string | null | undefined) {
  const text = value?.replace(/\s+$/g, "").trim();
  if (!text || ["undefined", "null", "not specified"].includes(text.toLowerCase())) return null;
  return text;
}

function sourceConfidenceLabel(value: string) {
  return value.replace(/_/g, " ");
}
