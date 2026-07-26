import type { ReactNode } from "react";

// Agent Mode page container (UX-R1A). Server-safe. Provides the centered,
// readable content column and consistent vertical rhythm for agent screens.
export function AgentPage({ children }: { children: ReactNode }) {
  return (
    <main
      id="main"
      className="reveal mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-8"
    >
      {children}
    </main>
  );
}
