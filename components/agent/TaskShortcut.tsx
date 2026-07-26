import Link from "next/link";

// Plain-language task shortcut tile (UX-R1A). Server-safe. Routes to the best
// existing destination decided on the server (a published procedure or a
// search query) — it never links to an unavailable guided workflow.
export function TaskShortcut({
  label,
  href,
  hint,
}: {
  label: string;
  href: string;
  /** Optional subtle secondary text (e.g. a service code), used sparingly. */
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="agent-tile touch-target flex flex-col justify-center gap-0.5 px-4 py-3 focus-visible:outline-none"
    >
      <span className="text-[15px] font-semibold leading-snug text-ink">{label}</span>
      {hint ? <span className="text-xs font-medium text-ink-faint">{hint}</span> : null}
    </Link>
  );
}
