import { createServerSupabaseClient } from "@/lib/supabase-server";
import { buildSearchTerms, MIN_SEARCH_QUERY_LENGTH } from "@/lib/search";
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

  return NextResponse.json({ results: data ?? [] });
}
