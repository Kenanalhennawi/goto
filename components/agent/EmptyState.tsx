import type { ReactNode } from "react";

// Calm empty state for Agent Mode (UX-R1A). Server-safe.
export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white/60 px-6 py-10 text-center">
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-ink-muted">{message}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
