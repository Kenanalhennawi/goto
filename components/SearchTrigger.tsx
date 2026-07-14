"use client";

// Opens the global command palette from the app header.
export function SearchTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("goto:open-palette"))}
      className="hidden min-w-0 flex-1 items-center justify-between gap-3 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-[13px] text-white/60 transition-colors hover:border-white/30 hover:bg-white/15 hover:text-white/85 md:flex md:max-w-xs"
      aria-label="Open search (Ctrl+K)"
    >
      <span className="truncate">Search services, SSR codes, processes...</span>
      <span className="flex shrink-0 items-center gap-1">
        <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white/70">
          Ctrl
        </kbd>
        <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white/70">
          K
        </kbd>
      </span>
    </button>
  );
}
