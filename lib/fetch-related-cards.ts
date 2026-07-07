import { CHAPTER_CARD_MAP } from "@/lib/chapter-card-mapping";
import type { Chapter, ProcedureCard } from "@/lib/types";

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => QueryLike;
  };
};

type QueryLike = {
  eq: (column: string, value: unknown) => QueryLike;
  in: (column: string, values: unknown[]) => QueryLike;
  order: (column: string, options?: { ascending?: boolean }) => QueryLike;
  limit: (count: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
};

type RelatedCardOptions = {
  includeDrafts?: boolean;
};

const PROCEDURE_SELECT = [
  "id",
  "chapter_id",
  "title",
  "slug",
  "category",
  "service_code",
  "service_type",
  "summary",
  "when_to_use",
  "channels",
  "cut_off_time",
  "who_can_action",
  "required_information",
  "system_steps",
  "passenger_advice",
  "allowed",
  "not_allowed",
  "escalation_points",
  "fees_charges",
  "agent_action",
  "rules",
  "exceptions",
  "required_approval",
  "customer_script",
  "sprint_comment_template",
  "salesforce_classification",
  "source_pages",
  "source_version",
  "source_updated_at",
  "keywords",
  "aliases",
  "priority",
  "review_status",
  "is_published",
  "show_on_homepage",
  "homepage_order",
  "source_confidence",
  "last_reviewed_at",
  "last_reviewed_by",
  "created_at",
  "updated_at",
].join(", ");

const WEAK_TERMS = new Set([
  "and",
  "the",
  "for",
  "with",
  "from",
  "chapter",
  "service",
  "process",
  "procedure",
  "contact",
  "centre",
  "center",
  "guide",
]);

export async function fetchRelatedCards(
  supabase: unknown,
  chapter: Pick<Chapter, "id" | "slug" | "title" | "search_keywords">,
  options: RelatedCardOptions = {}
) {
  const client = supabase as SupabaseLike;
  const includeDrafts = Boolean(options.includeDrafts);
  const linkedByChapter = await fetchCardsByChapterId(client, chapter.id, includeDrafts);
  if (linkedByChapter.length > 0) return linkedByChapter;

  const mappedSlugs = CHAPTER_CARD_MAP[chapter.slug] ?? [];
  if (mappedSlugs.length > 0) {
    const mappedCards = await fetchCardsBySlugs(client, mappedSlugs, includeDrafts);
    if (mappedCards.length > 0) return sortLikeMap(mappedCards, mappedSlugs);
  }

  return fetchCarefulGenericMatches(client, chapter, includeDrafts);
}

async function fetchCardsByChapterId(supabase: SupabaseLike, chapterId: string, includeDrafts: boolean) {
  let query = baseVisibleQuery(supabase, includeDrafts).eq("chapter_id", chapterId);
  query = orderCards(query);
  const { data } = await query.limit(12);
  return uniqueCards(data);
}

async function fetchCardsBySlugs(supabase: SupabaseLike, slugs: string[], includeDrafts: boolean) {
  let query = baseVisibleQuery(supabase, includeDrafts).in("slug", slugs);
  query = orderCards(query);
  const { data } = await query.limit(20);
  return uniqueCards(data);
}

async function fetchCarefulGenericMatches(
  supabase: SupabaseLike,
  chapter: Pick<Chapter, "slug" | "title" | "search_keywords">,
  includeDrafts: boolean
) {
  const terms = buildChapterTerms(chapter);
  if (terms.length === 0) return [];

  const query = orderCards(baseVisibleQuery(supabase, includeDrafts));
  const { data } = await query.limit(120);
  const cards = uniqueCards(data);

  return cards
    .map((card) => ({ card, score: genericMatchScore(card, chapter, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.card.priority - a.card.priority || a.card.title.localeCompare(b.card.title))
    .slice(0, 6)
    .map((item) => item.card);
}

function baseVisibleQuery(supabase: SupabaseLike, includeDrafts: boolean) {
  let query = supabase.from("procedure_cards").select(PROCEDURE_SELECT);
  if (includeDrafts) {
    query = query.in("review_status", ["approved", "needs_review", "draft"]);
  } else {
    query = query.eq("review_status", "approved").eq("is_published", true);
  }
  return query;
}

function orderCards(query: QueryLike) {
  return query.order("priority", { ascending: false }).order("title", { ascending: true });
}

function uniqueCards(data: unknown[] | null) {
  const seen = new Set<string>();
  const cards: ProcedureCard[] = [];
  for (const item of data ?? []) {
    const card = item as ProcedureCard;
    if (!card?.id || seen.has(card.id)) continue;
    seen.add(card.id);
    cards.push(card);
  }
  return cards;
}

function sortLikeMap(cards: ProcedureCard[], slugs: string[]) {
  const order = new Map(slugs.map((slug, index) => [slug, index]));
  return [...cards].sort((a, b) => {
    const aIndex = order.get(a.slug) ?? 999;
    const bIndex = order.get(b.slug) ?? 999;
    return aIndex - bIndex || b.priority - a.priority || a.title.localeCompare(b.title);
  });
}

function buildChapterTerms(chapter: Pick<Chapter, "slug" | "title" | "search_keywords">) {
  const rawTerms = [
    chapter.slug,
    chapter.title,
    ...chapter.slug.split("-"),
    ...(chapter.search_keywords ?? []),
  ];

  return Array.from(
    new Set(
      rawTerms
        .map((term) => normalize(term))
        .filter((term) => term.length >= 4 && !WEAK_TERMS.has(term))
    )
  ).slice(0, 16);
}

function genericMatchScore(
  card: ProcedureCard,
  chapter: Pick<Chapter, "slug" | "title">,
  terms: string[]
) {
  const cardTitle = normalize(card.title);
  const chapterTitle = normalize(chapter.title);
  const cardSlug = normalize(card.slug);
  const chapterSlug = normalize(chapter.slug);
  const haystackTerms = [
    card.slug,
    card.title,
    card.service_code ?? "",
    card.service_type ?? "",
    card.category,
    ...(card.keywords ?? []),
    ...(card.aliases ?? []),
  ].map((term) => normalize(term));

  let score = 0;
  if (cardSlug === chapterSlug) score += 100;
  if (cardTitle && chapterTitle && (cardTitle.includes(chapterTitle) || chapterTitle.includes(cardTitle))) score += 60;

  for (const term of terms) {
    if (haystackTerms.some((candidate) => candidate === term)) score += 30;
    else if (haystackTerms.some((candidate) => tokenIncludes(candidate, term))) score += 12;
  }

  return score;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenIncludes(value: string, term: string) {
  return value.split(" ").includes(term);
}
