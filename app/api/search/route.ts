import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  buildSearchTerms,
  MIN_SEARCH_QUERY_LENGTH,
  operationalCardPreview,
  rankSearchResults,
  scoreOperationalCard,
} from "@/lib/search";
import type { OperationalCardSearchResult, SearchResult } from "@/lib/types";
import { NextResponse } from "next/server";

type ProcedureSearchRow = Parameters<typeof scoreOperationalCard>[0] & {
  id: string;
  title: string;
  slug: string;
  category: string;
  channels: OperationalCardSearchResult["channels"] | null;
  passenger_advice: OperationalCardSearchResult["passenger_advice"] | null;
  system_steps: OperationalCardSearchResult["system_steps"] | null;
  source_pages: number[] | null;
  source_version: string | null;
  summary: string | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  if (query.length < MIN_SEARCH_QUERY_LENGTH) {
    return NextResponse.json({ results: [] });
  }

  const terms = buildSearchTerms(query);

  if (!terms) {
    return NextResponse.json({ results: [] });
  }

  const supabase = await createServerSupabaseClient();
  const cardResults = await searchOperationalCards(supabase, query);
  const { data, error } = await supabase.rpc("search_chapters", {
    query: terms,
  });

  if (error) {
    return NextResponse.json({ results: cardResults, error: "Chapter search failed." });
  }

  const results = (data ?? []) as SearchResult[];
  const ids = results.map((result) => result.id).filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ results: cardResults });
  }

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, page_start, page_end, search_keywords, source_version, body_text")
    .in("id", ids);

  const metadata = new Map(
    (chapters ?? []).map((chapter) => [
      chapter.id,
      {
        page_start: chapter.page_start,
        page_end: chapter.page_end,
        search_keywords: chapter.search_keywords,
        source_version: chapter.source_version,
        body_text: chapter.body_text,
      },
    ])
  );

  const rankedChapters = rankSearchResults(
    results.map((result) => ({ ...result, ...metadata.get(result.id) })),
    query
  ).map((result) => {
    const sanitized = { ...result, type: "chapter" as const };
    delete sanitized.body_text;
    return sanitized;
  });

  return NextResponse.json({ results: [...cardResults, ...rankedChapters].slice(0, 14) });
}

async function searchOperationalCards(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  query: string
): Promise<OperationalCardSearchResult[]> {
  const { data } = await supabase
    .from("procedure_cards")
    .select(
      [
        "id",
        "title",
        "slug",
        "category",
        "service_code",
        "service_type",
        "cut_off_time",
        "channels",
        "who_can_action",
        "required_information",
        "system_steps",
        "passenger_advice",
        "allowed",
        "not_allowed",
        "escalation_points",
        "fees_charges",
        "keywords",
        "aliases",
        "summary",
        "when_to_use",
        "source_pages",
        "source_version",
        "priority",
      ].join(", ")
    )
    .eq("is_published", true)
    .eq("review_status", "approved")
    .limit(100);

  return ((data ?? []) as unknown as ProcedureSearchRow[])
    .map((card) => ({
      card,
      score: scoreOperationalCard(card, query),
    }))
    .filter(({ score }) => score >= 2500)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ card, score }) => ({
      type: "operational_card" as const,
      id: card.id,
      title: card.title,
      slug: card.slug,
      rank: score,
      service_code: card.service_code ?? null,
      service_type: card.service_type ?? null,
      category: card.category,
      cut_off_time: card.cut_off_time ?? null,
      channels: card.channels ?? [],
      passenger_advice: card.passenger_advice ?? [],
      system_steps: card.system_steps ?? [],
      source_pages: card.source_pages ?? [],
      source_version: card.source_version ?? null,
      summary: card.summary ?? null,
      snippet: operationalCardPreview(card),
    }));
}
