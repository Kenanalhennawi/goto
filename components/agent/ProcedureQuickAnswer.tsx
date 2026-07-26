import type { OperationalAnswer } from "@/lib/operational-answer";

// Quick operational answer for the procedure page (UX-R1C). Server component.
// Reuses the shared operational-answer helper; renders only fields the source
// supports and never shows source/review metadata. Two-column definition layout
// on desktop, stacked on mobile.
export function ProcedureQuickAnswer({
  answer,
  requiredApproval = null,
}: {
  answer: OperationalAnswer;
  requiredApproval?: string | null;
}) {
  const escalationPreview = answer.escalation[0] ?? null;
  const approval = requiredApproval?.trim() ? requiredApproval.trim() : null;

  return (
    <section className="agent-hero p-5 sm:p-6" aria-labelledby="operational-answer-heading">
      <h2
        id="operational-answer-heading"
        className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky"
      >
        Operational answer
      </h2>
      <dl className="mt-3 space-y-3">
        <AnswerRow label="Can we action?" value={answer.canAction} strong />
        {answer.deadline ? <AnswerRow label="Deadline" value={answer.deadline} /> : null}
        {answer.handler ? <AnswerRow label="Who handles it?" value={answer.handler} /> : null}
        {answer.primaryAction ? <AnswerRow label="Agent action" value={answer.primaryAction} /> : null}
        {approval ? <AnswerRow label="Approval required" value={approval} /> : null}
        {answer.criticalBlocker ? (
          <AnswerRow label="Do not proceed when" value={answer.criticalBlocker} tone="warn" />
        ) : null}
        {escalationPreview ? (
          <AnswerRow label="Escalate when" value={escalationPreview} tone="warn" />
        ) : null}
      </dl>
    </section>
  );
}

function AnswerRow({
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
        className={`text-sm leading-6 ${
          tone === "warn" ? "font-semibold text-warn" : strong ? "font-semibold text-ink" : "text-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
