import type { ReactNode } from "react";

export function CollapsibleManualContent({
  children,
  defaultOpen = false,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <section id="manual-content" className="scroll-mt-24">
      <details className="content-card overflow-hidden" open={defaultOpen}>
        <summary className="cursor-pointer list-none border-b border-border bg-gradient-to-r from-sky-soft to-white px-5 py-4 marker:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Source manual content
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold text-ink">
                Full extracted chapter
              </h2>
            </div>
            <span className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky">
              Open full manual content
            </span>
          </div>
        </summary>
        <div className="p-4 sm:p-5">{children}</div>
      </details>
    </section>
  );
}
