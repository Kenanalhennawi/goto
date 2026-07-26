import type { OperationalAnswer } from "@/lib/operational-answer";

// Full operational details for the procedure page (UX-R1C). Server component.
// Renders only non-empty sections as semantic lists (no raw JSON, no filler).
// Passenger advice is visually distinct; restrictions use a calm — not
// aggressive — warn hierarchy with a text label, never color alone.
export function FullOperationalDetails({ answer }: { answer: OperationalAnswer }) {
  if (!answer.hasDetails) return null;

  return (
    <div className="mt-8 space-y-6">
      <h2 className="font-display text-base font-semibold text-ink">Full operational details</h2>

      <DetailBlock title="Required information" items={answer.requiredInformation} />
      <DetailBlock title="Agent steps" items={answer.agentSteps} ordered />

      {answer.passengerAdvice.length > 0 && (
        <section className="rounded-xl border border-sky/25 bg-sky-soft/60 p-4" aria-label="What to tell the passenger">
          <h3 className="font-display text-sm font-semibold text-sky">What to tell the passenger</h3>
          <ul className="mt-2 space-y-1.5">
            {answer.passengerAdvice.map((item, index) => (
              <li key={`pax-${index}`} className="flex gap-2 text-sm leading-6 text-ink">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DetailBlock title="Applicable when" items={answer.allowed} />
      <DetailBlock title="Do not proceed when" items={answer.notAllowed} tone="warn" />
      <DetailBlock title="Escalation" items={answer.escalation} />

      {answer.fees ? (
        <section aria-label="Fees and charges">
          <h3 className="font-display text-sm font-semibold text-ink">Fees and charges</h3>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-ink">{answer.fees}</p>
        </section>
      ) : null}
    </div>
  );
}

function DetailBlock({
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
    <section aria-label={title}>
      <h3 className={`font-display text-sm font-semibold ${tone === "warn" ? "text-warn" : "text-ink"}`}>
        {title}
      </h3>
      <ListTag className={`mt-1.5 space-y-1.5 ${ordered ? "list-decimal pl-5" : ""}`}>
        {items.map((item, index) => (
          <li
            key={`${title}-${index}`}
            className={`text-sm leading-6 text-ink ${ordered ? "" : "flex gap-2"}`}
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
    </section>
  );
}
