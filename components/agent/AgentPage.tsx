import type { ReactNode } from "react";

// Agent Mode page container (UX-R1A; footer UX-R1E; width variant UX-R1G).
// Server-safe. "reading" keeps a comfortable text measure for answer/manual
// pages; "wide" is used by the task-first homepage so wide desktops feel
// intentionally composed rather than a narrow strip.
export function AgentPage({
  children,
  width = "reading",
}: {
  children: ReactNode;
  width?: "reading" | "wide";
}) {
  const maxW = width === "wide" ? "max-w-5xl" : "max-w-4xl";
  return (
    <>
      <main
        id="main"
        className={`reveal mx-auto w-full ${maxW} flex-1 px-4 pb-10 pt-6 sm:px-6 sm:pt-8`}
      >
        {children}
      </main>
      <footer className={`mx-auto w-full ${maxW} px-4 pb-10 sm:px-6`}>
        <p className="border-t border-border pt-4 text-xs text-ink-faint">
          Internal flydubai Contact Centre reference. Not for external distribution.
        </p>
      </footer>
    </>
  );
}
