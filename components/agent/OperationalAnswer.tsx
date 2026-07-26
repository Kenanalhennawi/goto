import Link from "next/link";
import type { OperationalAnswer as Answer } from "@/lib/operational-answer";

// Best operational match (UX-R1B). Server component; progressive disclosure uses
// native <details> so it is keyboard-accessible with no client state and no
// registry import. Shows only the compact answer by default; source/audit
// metadata never appears here.
export function OperationalAnswer({
  answer,
  slug,
  guided,
  hasSourceRefs,
}: {
  answer: Answer;
  slug: string;
  guided: { available: boolean; hasTree: boolean };
  hasSourceRefs: boolean;
}) {
  return (
    <section className="agent-hero p-5 sm:p-6" aria-label="Best operational match">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky">
        Best operational match
      </p>
      <h2 className="mt-1 font-display text-xl font-semibold leading-snug text-ink sm:text-2xl">
        {answer.title}
      </h2>
      {answer.summary ? (
        <p className="mt-1.5 text-sm leading-6 text-ink-muted">{answer.summary}</p>
      ) : null}

      <dl className="mt-4 space-y-3">
        <AnswerField label="Can we action?" value={answer.canAction} strong />
        {answer.deadline ? <AnswerField label="Deadline" value={answer.deadline} /> : null}
        {answer.handler ? <AnswerField label="Who handles it?" value={answer.handler} /> : null}
        {answer.criticalBlocker ? (
          <AnswerField label="Do not proceed when" value={answer.criticalBlocker} tone="warn" />
        ) : null}
        {answer.primaryAction ? (
          <AnswerField label="Agent action" value={answer.primaryAction} />
        ) : null}
      </dl>

      <div className="mt-5 flex flex-wrap gap-2.5">
        {guided.available ? (
          <Link
            href={`/decision?procedure=${encodeURIComponent(slug)}`}
            className="agent-primary touch-target inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold focus-visible:outline-none"
          >
            Start guided questions
          </Link>
        ) : null}
        <Link
          href={`/procedure/${slug}`}
          className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
        >
          Open full procedure
        </Link>
        {hasSourceRefs ? (
          <a
            href="#source-references"
            className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
          >
            View source
          </a>
        ) : null}
      </div>

      {!guided.available && guided.hasTree ? (
        <p className="mt-2.5 text-xs font-medium text-ink-faint">
          Guided questions are not currently available. Use the full procedure.
        </p>
      ) : null}

      {answer.hasDetails ? (
        <details className="agent-disclosure mt-4 border-t border-border pt-3">
          <summary className="touch-target flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-sky focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky">
            <span className="disclosure-chevron" aria-hidden="true">
              ▸
            </span>
            Show full operational details
          </summary>
          <div className="mt-3 space-y-4">
            <DetailList title="Required information" items={answer.requiredInformation} />
            <DetailList title="Agent steps" items={answer.agentSteps} ordered />
            <DetailList title="Passenger advice" items={answer.passengerAdvice} />
            <DetailList title="Allowed" items={answer.allowed} />
            <DetailList title="Not allowed" items={answer.notAllowed} tone="warn" />
            <DetailList title="Escalation" items={answer.escalation} />
            {answer.fees ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Fees</p>
                <p className="mt-1 text-sm leading-6 text-ink">{answer.fees}</p>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function AnswerField({
  label,
  value,
  strong = false,
  tone = "default",
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "default" | "warn";
}) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[168px_1fr] sm:gap-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint sm:pt-0.5">
        {label}
      </dt>
      <dd
        className={`text-sm leading-6 ${tone === "warn" ? "font-semibold text-warn" : strong ? "font-semibold text-ink" : "text-ink"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function DetailList({
  title,
  items,
  ordered = false,
  tone = "default",
}: {
  title: string;
  items: string[];
  ordered?: boolean;
  tone?: "default" | "warn";
}) {
  if (items.length === 0) return null;
  const ListTag = ordered ? "ol" : "ul";
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{title}</p>
      <ListTag className={`mt-1.5 space-y-1.5 ${ordered ? "list-decimal pl-5" : ""}`}>
        {items.map((item, index) => (
          <li
            key={`${title}-${index}`}
            className={`text-sm leading-6 ${tone === "warn" ? "text-warn" : "text-ink"} ${ordered ? "" : "flex gap-2"}`}
          >
            {ordered ? null : (
              <span
                className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${tone === "warn" ? "bg-warn" : "bg-sky"}`}
                aria-hidden="true"
              />
            )}
            <span>{item}</span>
          </li>
        ))}
      </ListTag>
    </div>
  );
}
