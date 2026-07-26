import Link from "next/link";

// Collapsed source/manual references (UX-R1B). Server component. Default-closed,
// always last. No source version or page badges in the ordinary chrome; the
// page number appears only as subtle secondary text after the section is opened.

export type SourceRef = {
  slug: string;
  title: string;
  excerpt: string;
  page: string | null;
};

export function SourceReferences({ refs }: { refs: SourceRef[] }) {
  if (refs.length === 0) return null;
  return (
    <details id="source-references" className="agent-disclosure mt-8 scroll-mt-6">
      <summary className="touch-target flex cursor-pointer list-none items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky">
        <span className="disclosure-chevron text-sky" aria-hidden="true">
          ▸
        </span>
        <span>
          <span className="block font-display text-base font-semibold text-ink">
            Source manual references
          </span>
          <span className="mt-0.5 block text-xs text-ink-muted">
            Open the original source when you need the full reference.
          </span>
        </span>
      </summary>
      <ul className="mt-3 space-y-2.5">
        {refs.map((ref) => (
          <li key={`src-${ref.slug}`} className="rounded-xl border border-border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-[15px] font-semibold leading-snug text-ink">
                  {ref.title}
                </h3>
                {ref.excerpt ? (
                  <p className="mt-1 text-sm leading-6 text-ink-muted">{ref.excerpt}</p>
                ) : null}
                {ref.page ? (
                  <p className="mt-1.5 text-xs text-ink-faint">{ref.page}</p>
                ) : null}
              </div>
              <Link
                href={`/chapter/${ref.slug}`}
                className="agent-secondary touch-target inline-flex shrink-0 items-center justify-center rounded-lg px-3.5 py-2 text-xs font-semibold focus-visible:outline-none"
              >
                Open source
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
