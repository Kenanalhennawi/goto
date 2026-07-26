import type { ReactNode } from "react";

// Agent Mode section with a plain-language heading (UX-R1A). Server-safe.
// Uses a real <section> + <h2> so the page reads correctly in document order
// for screen readers.
export function AgentSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
      {description ? (
        <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}
