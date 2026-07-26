import type { ReactNode } from "react";

// Agent Mode page container (UX-R1A; footer added UX-R1E). Server-safe.
// Centered readable column + a minimal internal-use disclaimer footer. No
// source version, chapter count, or system status.
export function AgentPage({ children }: { children: ReactNode }) {
  return (
    <>
      <main
        id="main"
        className="reveal mx-auto w-full max-w-3xl flex-1 px-4 pb-10 pt-6 sm:px-6 sm:pt-8"
      >
        {children}
      </main>
      <footer className="mx-auto w-full max-w-3xl px-4 pb-10 sm:px-6">
        <p className="border-t border-border pt-4 text-xs text-ink-faint">
          Internal flydubai Contact Centre reference. Not for external distribution.
        </p>
      </footer>
    </>
  );
}
