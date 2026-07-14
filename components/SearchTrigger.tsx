"use client";

// Opens the global command palette. Variants cover the sidebar,
// the mobile top bar, and the homepage hero.
export function SearchTrigger({ variant = "sidebar" }: { variant?: "sidebar" | "topbar" | "hero" }) {
  const open = () => window.dispatchEvent(new CustomEvent("goto:open-palette"));

  if (variant === "hero") {
    return (
      <button
        type="button"
        onClick={open}
        aria-label="Open search (Ctrl+K)"
        className="hover-lift flex w-full items-center gap-3 rounded-xl border border-border bg-white px-4 py-3.5 text-left shadow-[var(--shadow-sm)]"
      >
        <svg className="h-5 w-5 shrink-0 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
        </svg>
        <span className="min-w-0 flex-1 truncate text-[15px] text-ink-faint">
          Search WCHR, extra seat, missed flight, cut-off...
        </span>
        <span className="hidden shrink-0 items-center gap-1 sm:flex">
          <kbd className="rounded border border-border bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-faint">Ctrl</kbd>
          <kbd className="rounded border border-border bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-faint">K</kbd>
        </span>
        <span className="shrink-0 rounded-md bg-accent px-3.5 py-1.5 text-xs font-semibold text-white">
          Search
        </span>
      </button>
    );
  }

  if (variant === "topbar") {
    return (
      <button
        type="button"
        onClick={open}
        aria-label="Open search (Ctrl+K)"
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-[13px] text-white/60 transition-colors hover:border-white/30 hover:text-white/85"
      >
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
        </svg>
        <span className="truncate">Search...</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Open search (Ctrl+K)"
      className="flex w-full items-center gap-2 rounded-md border border-white/15 bg-white/10 px-2.5 py-2 text-[13px] text-white/60 transition-colors hover:border-white/30 hover:bg-white/15 hover:text-white/85"
    >
      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
      </svg>
      <span className="min-w-0 flex-1 truncate text-left">Search</span>
      <kbd className="shrink-0 rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white/60">
        Ctrl K
      </kbd>
    </button>
  );
}
