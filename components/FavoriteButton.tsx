"use client";

import { useEffect, useState } from "react";
import {
  readFavorites,
  toggleFavoriteStored,
  isFavorite,
  FAVORITES_EVENT,
  type FavoriteKind,
} from "@/lib/agent-workspace";

// Unified ★ favorite toggle for a procedure, service, or decision workflow.
// Device-local only (no database, no passenger data). Lazy reads on mount.
export function FavoriteButton({
  kind,
  slug,
  title,
  code = null,
  size = "md",
}: {
  kind: FavoriteKind;
  slug: string;
  title: string;
  code?: string | null;
  size?: "sm" | "md";
}) {
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    function sync() {
      setFavorited(isFavorite(readFavorites(), kind, slug));
    }
    const frame = window.requestAnimationFrame(sync);
    window.addEventListener(FAVORITES_EVENT, sync);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(FAVORITES_EVENT, sync);
    };
  }, [kind, slug]);

  function toggle() {
    const next = toggleFavoriteStored({ kind, slug, title, code });
    setFavorited(isFavorite(next, kind, slug));
  }

  const pad = size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={favorited}
      aria-label={favorited ? `Remove ${title} from favorites` : `Add ${title} to favorites`}
      className={`press inline-flex items-center gap-1.5 rounded border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${pad} ${
        favorited
          ? "border-orange-200 bg-orange-50 text-accent"
          : "border-border bg-white text-ink-muted hover:border-accent hover:text-accent"
      }`}
    >
      <span aria-hidden="true" className={favorited ? "text-accent" : ""}>
        {favorited ? "★" : "☆"}
      </span>
      {favorited ? "Favorited" : "Favorite"}
    </button>
  );
}
