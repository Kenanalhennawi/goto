export const MIN_SEARCH_QUERY_LENGTH = 2;
export const MAX_SEARCH_QUERY_LENGTH = 120;
const MAX_SEARCH_TERMS = 8;
const SEARCH_ALIASES: Record<string, string> = {
  bag: "baggage",
  bags: "baggage",
  brb: "baggage",
  wt: "worldtracer",
  "world-tracer": "worldtracer",
  world: "worldtracer",
  tracer: "worldtracer",
  ticket: "e-ticketing",
  tickets: "e-ticketing",
};

export function buildSearchTerms(query: string) {
  const trimmed = query.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
  if (trimmed.length < MIN_SEARCH_QUERY_LENGTH) return "";

  return expandSearchAliases(trimmed)
    .split(/\s+/)
    .slice(0, MAX_SEARCH_TERMS)
    .map((term) => term.replace(/[^\w-]/g, ""))
    .filter(Boolean)
    .map((term) => `${term}:*`)
    .join(" & ");
}

function expandSearchAliases(query: string) {
  return query
    .split(/\s+/)
    .map((term) => SEARCH_ALIASES[term.toLowerCase()] ?? term)
    .join(" ");
}

export function plainSnippet(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
