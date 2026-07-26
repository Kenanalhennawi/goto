import Link from "next/link";

// Compact related-procedure rows and the "More results" disclosure (UX-R1B).
// Server components. Rows carry no source version, page range, review status,
// confidence, matching score, or service-type badge clutter.

export type RelatedItem = {
  slug: string;
  title: string;
  summary: string | null;
  deadline: string | null;
  criticalBlocker: string | null;
  guidedAvailable: boolean;
};

export function RelatedProcedureRow({ item }: { item: RelatedItem }) {
  return (
    <article className="rounded-xl border border-border bg-white p-4">
      <h3 className="font-display text-[15px] font-semibold leading-snug text-ink">{item.title}</h3>
      {item.summary ? (
        <p className="mt-1 text-sm leading-6 text-ink-muted">{item.summary}</p>
      ) : null}
      {(item.deadline || item.criticalBlocker) && (
        <dl className="mt-2 space-y-1">
          {item.deadline ? (
            <div className="flex flex-wrap gap-x-2 text-xs">
              <dt className="font-semibold uppercase tracking-wider text-ink-faint">Deadline</dt>
              <dd className="text-ink">{item.deadline}</dd>
            </div>
          ) : null}
          {item.criticalBlocker ? (
            <div className="flex flex-wrap gap-x-2 text-xs">
              <dt className="font-semibold uppercase tracking-wider text-ink-faint">Do not proceed when</dt>
              <dd className="font-medium text-warn">{item.criticalBlocker}</dd>
            </div>
          ) : null}
        </dl>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/procedure/${item.slug}`}
          className="agent-secondary touch-target inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-xs font-semibold focus-visible:outline-none"
        >
          Open procedure
        </Link>
        {item.guidedAvailable ? (
          <Link
            href={`/decision?procedure=${encodeURIComponent(item.slug)}`}
            className="agent-secondary touch-target inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-xs font-semibold focus-visible:outline-none"
          >
            Guided decision
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function MoreResults({ items }: { items: RelatedItem[] }) {
  if (items.length === 0) return null;
  return (
    <details className="agent-disclosure mt-3">
      <summary className="touch-target flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-sky focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky">
        <span className="disclosure-chevron" aria-hidden="true">
          ▸
        </span>
        Show more results ({items.length})
      </summary>
      <div className="mt-3 space-y-2.5">
        {items.map((item) => (
          <RelatedProcedureRow key={`more-${item.slug}`} item={item} />
        ))}
      </div>
    </details>
  );
}
