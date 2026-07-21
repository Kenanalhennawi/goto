// Agent productivity workspace — device-local state only (Phase I).
//
// Everything here lives in this browser's localStorage. No passenger data is
// ever stored (decision history keeps only slug + outcome + timestamp), no
// data leaves the device, and no analytics/tracking is performed.
//
// The array transforms are pure so they can be unit-tested without a DOM; the
// read/write wrappers are the only window-touching code and are guarded for SSR.

export const FAVORITES_KEY = "goto.favorites.v1";
export const LEGACY_PINS_KEY = "goto.pins.v1";
export const RECENT_PAGES_KEY = "goto.recent.pages.v1";
export const RECENT_WORKFLOWS_KEY = "goto.recent.workflows.v1";
export const DECISION_HISTORY_KEY = "goto.decision.history.v1";
export const USAGE_KEY = "goto.usage.v1";

export const MAX_FAVORITES = 24;
export const MAX_RECENT = 10;
export const MAX_HISTORY = 10;

export type FavoriteKind = "procedure" | "service" | "workflow";

export type FavoriteItem = {
  kind: FavoriteKind;
  slug: string;
  title: string;
  code?: string | null;
};

export type RecentWorkflow = {
  slug: string;
  title: string;
  at: number;
};

// Decision history intentionally stores NO passenger information — only the
// workflow slug, a title, the deterministic outcome, and a timestamp.
export type DecisionHistoryEntry = {
  slug: string;
  title: string;
  outcome: string;
  at: number;
};

export type UsageCounts = Record<string, number>;

// ---------------------------------------------------------------------------
// Pure transforms (unit-tested)
// ---------------------------------------------------------------------------

function favKey(kind: FavoriteKind, slug: string) {
  return `${kind}:${slug}`;
}

export function isFavorite(list: FavoriteItem[], kind: FavoriteKind, slug: string): boolean {
  return list.some((item) => item.kind === kind && item.slug === slug);
}

export function toggleFavorite(
  list: FavoriteItem[],
  item: FavoriteItem,
  max = MAX_FAVORITES
): FavoriteItem[] {
  const key = favKey(item.kind, item.slug);
  if (list.some((existing) => favKey(existing.kind, existing.slug) === key)) {
    return list.filter((existing) => favKey(existing.kind, existing.slug) !== key);
  }
  return [item, ...list].slice(0, max);
}

/** Merge legacy pin items (procedures) into the unified favorites, de-duped. */
export function mergeLegacyPins(
  favorites: FavoriteItem[],
  legacyPins: { slug: string; title: string; code?: string | null }[]
): FavoriteItem[] {
  const merged = [...favorites];
  for (const pin of legacyPins) {
    if (!pin || typeof pin.slug !== "string") continue;
    if (!merged.some((item) => item.kind === "procedure" && item.slug === pin.slug)) {
      merged.push({ kind: "procedure", slug: pin.slug, title: pin.title, code: pin.code ?? null });
    }
  }
  return merged.slice(0, MAX_FAVORITES);
}

/** Unshift an item, de-dupe by slug, cap the list. Newest first. */
export function upsertRecent<T extends { slug: string }>(list: T[], item: T, max = MAX_RECENT): T[] {
  const next = list.filter((existing) => existing.slug !== item.slug);
  next.unshift(item);
  return next.slice(0, max);
}

/**
 * Keep only the non-sensitive fields, dropping anything that could be passenger
 * data. Guarantees decision history never persists PII even if called wrongly.
 */
export function sanitizeHistoryEntry(raw: Partial<DecisionHistoryEntry>): DecisionHistoryEntry | null {
  if (!raw || typeof raw.slug !== "string" || typeof raw.outcome !== "string") return null;
  return {
    slug: raw.slug,
    title: typeof raw.title === "string" ? raw.title : raw.slug,
    outcome: raw.outcome,
    at: typeof raw.at === "number" && Number.isFinite(raw.at) ? raw.at : Date.now(),
  };
}

export function addDecisionHistory(
  list: DecisionHistoryEntry[],
  raw: Partial<DecisionHistoryEntry>,
  max = MAX_HISTORY
): DecisionHistoryEntry[] {
  const entry = sanitizeHistoryEntry(raw);
  if (!entry) return list;
  return [entry, ...list].slice(0, max);
}

export function incrementUsage(counts: UsageCounts, slug: string): UsageCounts {
  return { ...counts, [slug]: (counts[slug] ?? 0) + 1 };
}

export function topUsed(counts: UsageCounts, limit = 6): { slug: string; count: number }[] {
  return Object.entries(counts)
    .map(([slug, count]) => ({ slug, count }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug))
    .slice(0, limit);
}

/**
 * Build a plain-text summary of a completed guided decision for copy-to-clipboard.
 * Deterministic; contains only the outcome and cited source — never passenger data.
 */
export function formatOutcomeSummary(input: {
  title: string;
  outcome: string;
  nextAction?: string | null;
  passengerAdvice?: string[] | null;
  matchedRuleId?: string | null;
  sourceChapter?: string | null;
  sourcePages?: number[] | null;
  sourceVersion?: string | null;
}): string {
  const lines: string[] = [];
  lines.push(`${input.title} — guided decision`);
  lines.push(`Outcome: ${input.outcome}`);
  if (input.nextAction) lines.push(`Required action: ${input.nextAction}`);
  const advice = (input.passengerAdvice ?? []).filter(Boolean);
  if (advice.length > 0) lines.push(`Passenger advice: ${advice.join("; ")}`);
  if (input.matchedRuleId) lines.push(`Matched rule: ${input.matchedRuleId}`);
  const pages = input.sourcePages && input.sourcePages.length > 0 ? input.sourcePages.join(", ") : "";
  const src = [
    input.sourceVersion ? `GO TO v${input.sourceVersion}` : "",
    input.sourceChapter ?? "",
    pages ? `Page ${pages}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  if (src) lines.push(`Source: ${src}`);
  lines.push("Always verify on the operational card.");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// localStorage wrappers (SSR-safe; never throw)
// ---------------------------------------------------------------------------

function readArray<T>(key: string, guard: (item: unknown) => item is T): T[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(stored) ? stored.filter(guard) : [];
  } catch {
    return [];
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable / full — non-fatal
  }
}

const isFav = (item: unknown): item is FavoriteItem =>
  Boolean(item) &&
  typeof (item as FavoriteItem).slug === "string" &&
  typeof (item as FavoriteItem).kind === "string";

const isRecentWorkflow = (item: unknown): item is RecentWorkflow =>
  Boolean(item) && typeof (item as RecentWorkflow).slug === "string";

const isHistory = (item: unknown): item is DecisionHistoryEntry =>
  Boolean(item) &&
  typeof (item as DecisionHistoryEntry).slug === "string" &&
  typeof (item as DecisionHistoryEntry).outcome === "string";

export const FAVORITES_EVENT = "goto:favorites-changed";
export const WORKSPACE_EVENT = "goto:workspace-changed";

function emit(name: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name));
}

export function readFavorites(): FavoriteItem[] {
  const favorites = readArray<FavoriteItem>(FAVORITES_KEY, isFav);
  const legacy = readArray<{ slug: string; title: string; code?: string | null }>(
    LEGACY_PINS_KEY,
    (item): item is { slug: string; title: string; code?: string | null } =>
      Boolean(item) && typeof (item as { slug?: unknown }).slug === "string"
  );
  return legacy.length > 0 ? mergeLegacyPins(favorites, legacy) : favorites;
}

export function writeFavorites(list: FavoriteItem[]) {
  writeJson(FAVORITES_KEY, list.slice(0, MAX_FAVORITES));
  emit(FAVORITES_EVENT);
}

export function toggleFavoriteStored(item: FavoriteItem): FavoriteItem[] {
  const next = toggleFavorite(readFavorites(), item);
  writeFavorites(next);
  return next;
}

export function readRecentWorkflows(): RecentWorkflow[] {
  return readArray<RecentWorkflow>(RECENT_WORKFLOWS_KEY, isRecentWorkflow);
}

export function recordRecentWorkflow(slug: string, title: string) {
  writeJson(RECENT_WORKFLOWS_KEY, upsertRecent(readRecentWorkflows(), { slug, title, at: Date.now() }));
  emit(WORKSPACE_EVENT);
}

export function readDecisionHistory(): DecisionHistoryEntry[] {
  return readArray<DecisionHistoryEntry>(DECISION_HISTORY_KEY, isHistory);
}

export function recordDecisionOutcome(entry: Partial<DecisionHistoryEntry>) {
  writeJson(DECISION_HISTORY_KEY, addDecisionHistory(readDecisionHistory(), entry));
  emit(WORKSPACE_EVENT);
}

export function readUsage(): UsageCounts {
  if (typeof window === "undefined") return {};
  try {
    const stored = JSON.parse(window.localStorage.getItem(USAGE_KEY) ?? "{}");
    return stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as UsageCounts) : {};
  } catch {
    return {};
  }
}

export function recordUsage(slug: string) {
  writeJson(USAGE_KEY, incrementUsage(readUsage(), slug));
  emit(WORKSPACE_EVENT);
}
