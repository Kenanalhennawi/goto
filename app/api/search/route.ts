import { createServerSupabaseClient } from "@/lib/supabase-server";
import { buildSearchTerms, MIN_SEARCH_QUERY_LENGTH, rankSearchResults } from "@/lib/search";
import type { SearchResult } from "@/lib/types";
import { NextResponse } from "next/server";

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
  const { data, error } = await supabase.rpc("search_chapters", {
    query: terms,
  });

  if (error) {
    return NextResponse.json({ results: [], error: "Search failed." }, { status: 500 });
  }

  const results = (data ?? []) as SearchResult[];
  const ids = results.map((result) => result.id).filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ results });
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

  const ranked = rankSearchResults(
    results.map((result) => ({ ...result, ...metadata.get(result.id) })),
    query
  ).map((result) => {
    const sanitized = { ...result };
    delete sanitized.body_text;
    return sanitized;
  });

  return NextResponse.json({ results: ranked });
}
