"use client";

import { useEffect } from "react";
import { recordUsage } from "@/lib/agent-workspace";

const KEY = "goto.recent.pages.v1";
const MAX = 10;

export type RecentPage = {
  kind: "procedure" | "chapter";
  slug: string;
  title: string;
  code: string | null;
  at: number;
};

// Records the visited page locally (per browser) for the
// "continue where you left off" strip. No data leaves the device.
export function RecentTracker({
  kind,
  slug,
  title,
  code = null,
}: {
  kind: RecentPage["kind"];
  slug: string;
  title: string;
  code?: string | null;
}) {
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
      const list: RecentPage[] = (Array.isArray(stored) ? stored : []).filter(
        (item): item is RecentPage =>
          Boolean(item) && typeof item.slug === "string" && item.slug !== slug
      );
      list.unshift({ kind, slug, title, code, at: Date.now() });
      window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    } catch {
      // localStorage unavailable; tracking silently disabled
    }
    // Usage counting powers the homepage "Most used" section (procedures only).
    if (kind === "procedure") recordUsage(slug);
  }, [kind, slug, title, code]);

  return null;
}
