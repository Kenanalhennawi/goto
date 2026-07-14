// Deterministic intent router (Phase A).
// Maps a non-sensitive operational question to verified procedure cards.
// Pure function: cards are supplied by the caller, which is responsible
// for fetching them with the standard approved+published filter.

import { scoreOperationalCard, resolveOperationalQuery } from "../search.ts";
import { INTENTS } from "./concepts.ts";
import type { IntentRouteResult, MatchedConcept, RoutableCard, RoutedProcedure } from "./types.ts";

const INTENT_BOOST = 50000;
const MIN_CARD_SCORE = 2500;

export function routeIntent(rawQuery: string, cards: RoutableCard[]): IntentRouteResult {
  const resolved = resolveOperationalQuery(rawQuery);
  const normalized = normalize(resolved.query);

  const matchedConcepts: MatchedConcept[] = [];
  const intentSlugs = new Set<string>();
  const intentsMatched = new Set<string>();

  for (const definition of INTENTS) {
    for (const phrase of definition.phrases) {
      if (containsPhrase(normalized, phrase)) {
        matchedConcepts.push({ intent: definition.intent, phrase });
        intentsMatched.add(definition.intent);
        for (const slug of definition.slugs) intentSlugs.add(slug);
        break;
      }
    }
  }

  const scored: RoutedProcedure[] = cards
    .map((card) => {
      const base = scoreOperationalCard(card, rawQuery);
      const viaIntent = intentSlugs.has(card.slug);
      return { ...card, score: base + (viaIntent ? INTENT_BOOST : 0), viaIntent };
    })
    .filter((card) => card.viaIntent || card.score >= MIN_CARD_SCORE)
    .sort((a, b) => b.score - a.score);

  const primary = scored[0] ?? null;
  const related = scored.slice(1, 5);
  const needsClarification = intentsMatched.size > 1;

  let confidence: IntentRouteResult["confidence"];
  if (!primary) {
    confidence = "Insufficient verified guidance";
  } else if (primary.viaIntent && !needsClarification) {
    confidence = "High confidence";
  } else {
    confidence = "Possible workflows";
  }

  return { primary, related, matchedConcepts, confidence, needsClarification };
}

function containsPhrase(normalizedQuery: string, phrase: string) {
  const normalizedPhrase = normalize(phrase);
  if (!normalizedPhrase) return false;
  return ` ${normalizedQuery} `.includes(` ${normalizedPhrase} `);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
