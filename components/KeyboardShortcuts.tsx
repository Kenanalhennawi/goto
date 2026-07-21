"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Global productivity shortcuts (Phase I). Only handles modified combos, so it
// never interferes with typing in text inputs. `/` and Ctrl/Cmd+K are already
// owned by the command palette. Esc / arrow keys are handled by their own
// dialogs (palette, QuestionFlow).
export function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Ctrl/Cmd+Enter — start a guided decision.
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        router.push("/decision");
        return;
      }
      // Alt+1/2/3 — jump between the three core destinations. The Alt modifier
      // means no printable character is produced, so text inputs are unaffected.
      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        if (event.key === "1") {
          event.preventDefault();
          router.push("/");
        } else if (event.key === "2") {
          event.preventDefault();
          router.push("/decision");
        } else if (event.key === "3") {
          event.preventDefault();
          router.push("/search");
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return null;
}
