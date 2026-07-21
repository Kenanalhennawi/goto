"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  readFavorites,
  readRecentWorkflows,
  readDecisionHistory,
  readUsage,
  topUsed,
  FAVORITES_EVENT,
  WORKSPACE_EVENT,
  type FavoriteItem,
  type RecentWorkflow,
  type DecisionHistoryEntry,
} from "@/lib/agent-workspace";
import { hasDecisionTree } from "@/lib/decision-engine/availability";

const RECENT_PAGES_KEY = "goto.recent.pages.v1";

type RecentPage = { kind: "procedure" | "chapter"; slug: string; title: string; code: string | null };

function favoriteHref(item: FavoriteItem) {
  if (item.kind === "workflow") return `/decision?procedure=${encodeURIComponent(item.slug)}`;
  return `/procedure/${item.slug}`;
}

// Personal agent workspace: favorites, recents, decision history and most-used,
// all device-local. Lazy-loads on mount and refreshes on workspace events.
// Renders nothing until there is something to show. Replaces WorkspaceStrip.
export function AgentWorkspace() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);
  const [workflows, setWorkflows] = useState<RecentWorkflow[]>([]);
  const [history, setHistory] = useState<DecisionHistoryEntry[]>([]);
  const [mostUsed, setMostUsed] = useState<{ slug: string; title: string; code: string | null }[]>([]);

  useEffect(() => {
    function load() {
      setFavorites(readFavorites());
      setWorkflows(readRecentWorkflows());
      setHistory(readDecisionHistory());
      let pages: RecentPage[] = [];
      try {
        const stored = JSON.parse(window.localStorage.getItem(RECENT_PAGES_KEY) ?? "[]");
        if (Array.isArray(stored)) {
          pages = stored.filter(
            (item): item is RecentPage =>
              Boolean(item) && typeof item.slug === "string" && typeof item.title === "string"
          );
        }
      } catch {
        pages = [];
      }
      setRecentPages(pages);
      // Resolve most-used slugs to titles using known recent/favorite metadata.
      const titles = new Map<string, { title: string; code: string | null }>();
      for (const p of pages) titles.set(p.slug, { title: p.title, code: p.code });
      for (const f of readFavorites()) titles.set(f.slug, { title: f.title, code: f.code ?? null });
      setMostUsed(
        topUsed(readUsage(), 6).map((u) => ({
          slug: u.slug,
          title: titles.get(u.slug)?.title ?? u.slug,
          code: titles.get(u.slug)?.code ?? null,
        }))
      );
    }
    const frame = window.requestAnimationFrame(load);
    window.addEventListener(FAVORITES_EVENT, load);
    window.addEventListener(WORKSPACE_EVENT, load);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(FAVORITES_EVENT, load);
      window.removeEventListener(WORKSPACE_EVENT, load);
    };
  }, []);

  const recentProcedures = recentPages.filter((p) => p.kind === "procedure");
  const continueItems = buildContinue(recentPages, workflows);
  const hasAnything =
    favorites.length > 0 ||
    recentProcedures.length > 0 ||
    history.length > 0 ||
    mostUsed.length > 0 ||
    continueItems.length > 0;

  if (!hasAnything) return null;

  return (
    <section className="content-card reveal p-4" aria-label="Your workspace">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
          Your workspace
        </p>
        <span className="text-[11px] font-medium text-ink-faint">Stored on this device</span>
      </div>

      <div className="space-y-2">
        {continueItems.length > 0 && (
          <Panel title="Continue working" count={continueItems.length} defaultOpen>
            <Grid>
              {continueItems.map((item) => (
                <Tile key={`cont-${item.href}`} href={item.href} label={item.label} title={item.title} accent />
              ))}
            </Grid>
          </Panel>
        )}

        {favorites.length > 0 && (
          <Panel title="Favorites" count={favorites.length}>
            <Grid>
              {favorites.map((item) => (
                <Tile
                  key={`fav-${item.kind}-${item.slug}`}
                  href={favoriteHref(item)}
                  label={item.kind === "workflow" ? "Workflow" : item.kind === "service" ? "Service" : "Procedure"}
                  title={item.code ? `${item.code} · ${item.title}` : item.title}
                />
              ))}
            </Grid>
          </Panel>
        )}

        {recentProcedures.length > 0 && (
          <Panel title="Recent procedures" count={recentProcedures.length}>
            <Grid>
              {recentProcedures.map((p) => (
                <Tile
                  key={`rp-${p.slug}`}
                  href={`/procedure/${p.slug}`}
                  label="Procedure"
                  title={p.code ? `${p.code} · ${p.title}` : p.title}
                />
              ))}
            </Grid>
          </Panel>
        )}

        {history.length > 0 && (
          <Panel title="Recent decisions" count={history.length}>
            <ul className="space-y-1.5">
              {history.map((h, index) => (
                <li
                  key={`dh-${h.slug}-${h.at}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-white px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-ink">{h.title}</span>
                    <span className="block truncate text-xs text-ink-muted">Outcome: {h.outcome}</span>
                  </span>
                  {hasDecisionTree(h.slug) && (
                    <Link
                      href={`/decision?procedure=${encodeURIComponent(h.slug)}`}
                      className="shrink-0 rounded border border-sky bg-sky-soft px-2.5 py-1 text-[11px] font-semibold text-sky transition-colors hover:bg-white"
                    >
                      Restart
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {mostUsed.length > 0 && (
          <Panel title="Most used" count={mostUsed.length}>
            <Grid>
              {mostUsed.map((m) => (
                <Tile
                  key={`mu-${m.slug}`}
                  href={`/procedure/${m.slug}`}
                  label="Procedure"
                  title={m.code ? `${m.code} · ${m.title}` : m.title}
                />
              ))}
            </Grid>
          </Panel>
        )}
      </div>
    </section>
  );
}

function buildContinue(pages: RecentPage[], workflows: RecentWorkflow[]) {
  const items: { href: string; label: string; title: string }[] = [];
  if (pages[0]) {
    items.push({
      href: pages[0].kind === "procedure" ? `/procedure/${pages[0].slug}` : `/chapter/${pages[0].slug}`,
      label: "Continue",
      title: pages[0].code ? `${pages[0].code} · ${pages[0].title}` : pages[0].title,
    });
  }
  if (workflows[0]) {
    items.push({
      href: `/decision?procedure=${encodeURIComponent(workflows[0].slug)}`,
      label: "Resume workflow",
      title: workflows[0].title,
    });
  }
  return items;
}

function Panel({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-md border border-border bg-white/60">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent">
        <span className="text-[13px] font-semibold text-ink">{title}</span>
        <span className="rounded-sm border border-border bg-white px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">
          {count}
        </span>
      </summary>
      <div className="border-t border-border p-2.5">{children}</div>
    </details>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

function Tile({
  href,
  label,
  title,
  accent = false,
}: {
  href: string;
  label: string;
  title: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`hover-lift rounded-md border bg-white px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
        accent ? "border-border border-l-[3px] border-l-accent" : "border-border"
      }`}
    >
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-sky">{label}</span>
      <span className="mt-0.5 block truncate text-[13px] font-semibold text-ink">{title}</span>
    </Link>
  );
}
