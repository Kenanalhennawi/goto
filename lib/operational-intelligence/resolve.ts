// Deterministic Operational Intelligence — resolver (OI-1).
// Pure, testable. Normalizes a query, matches reviewed concepts (longest phrase
// wins → specific beats generic), and returns candidates + safety + bounded
// expansion terms. No AI, no external calls, no dependencies. Never changes
// card visibility; downstream consumers still apply published+approved guards.

import { OPERATIONAL_CONCEPTS } from "./concepts.ts";
import type {
  OperationalConcept,
  OperationalConceptSafety,
  OperationalIntelligenceResult,
} from "./types.ts";

const MAX_CANDIDATE_SLUGS = 5;
const MAX_EXPANDED_TERMS = 8;

// Deterministic normalization:
//  NFKC → lowercase → apostrophe/punctuation normalize → hyphen/space
//  equivalence → whitespace collapse. No stemming (kept predictable).
export function normalizeQuery(raw: string): string {
  return (raw ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'") // curly/modifier apostrophes → '
    .replace(/[^a-z0-9]+/g, " ") // punctuation & hyphens → space
    .trim()
    .replace(/\s+/g, " ");
}

// Whole-token containment: " online check in " contains " check in " but the
// token stream must line up on word boundaries, so "scan" never matches "can".
function containsPhrase(paddedQuery: string, phrase: string): boolean {
  const normalizedPhrase = normalizeQuery(phrase);
  if (!normalizedPhrase) return false;
  return paddedQuery.includes(` ${normalizedPhrase} `);
}

type ConceptMatch = {
  concept: OperationalConcept;
  /** Token length of the longest phrase that matched (specificity). */
  weight: number;
};

function matchConcepts(normalized: string): ConceptMatch[] {
  const padded = ` ${normalized} `;
  const matches: ConceptMatch[] = [];
  for (const concept of OPERATIONAL_CONCEPTS) {
    const candidates = [
      ...concept.phrases,
      ...(concept.abbreviations ?? []),
      ...(concept.misspellings ?? []),
    ];
    let weight = 0;
    for (const phrase of candidates) {
      if (containsPhrase(padded, phrase)) {
        weight = Math.max(weight, normalizeQuery(phrase).split(" ").length);
      }
    }
    if (weight > 0) matches.push({ concept, weight });
  }
  return matches;
}

const SAFETY_RANK: Record<OperationalConceptSafety, number> = {
  unsafe_immigration: 5,
  unsafe_medical: 4,
  unsafe_approval: 3,
  ambiguous: 2,
  safe: 1,
  broad: 0,
};

export function resolveOperationalIntelligence(raw: string): OperationalIntelligenceResult {
  const normalizedQuery = normalizeQuery(raw);
  const empty: OperationalIntelligenceResult = {
    originalQuery: raw,
    normalizedQuery,
    matchedConceptIds: [],
    candidateSlugs: [],
    categoryHints: [],
    expandedTerms: [],
    ambiguity: false,
    safety: "broad",
    safeMessage: undefined,
  };
  if (!normalizedQuery) return empty;

  const matches = matchConcepts(normalizedQuery);
  if (matches.length === 0) return empty;

  // Unsafe wording overrides everything, regardless of specificity.
  const unsafe = matches
    .filter((m) => m.concept.safety.startsWith("unsafe_"))
    .sort((a, b) => SAFETY_RANK[b.concept.safety] - SAFETY_RANK[a.concept.safety])[0];
  if (unsafe) {
    return {
      ...empty,
      matchedConceptIds: [unsafe.concept.id],
      candidateSlugs: [],
      categoryHints: unsafe.concept.category ? [unsafe.concept.category] : [],
      expandedTerms: [],
      ambiguity: false,
      safety: unsafe.concept.safety,
      safeMessage: unsafe.concept.safeMessage,
    };
  }

  // Longest phrase wins: "visa change" (2 tokens) beats "visa" (1 token).
  const maxWeight = Math.max(...matches.map((m) => m.weight));
  const winners = matches.filter((m) => m.weight === maxWeight);

  const routable = winners.filter(
    (m) => m.concept.safety === "safe" || m.concept.safety === "ambiguous"
  );

  const matchedConceptIds: string[] = [];
  const candidateSlugs: string[] = [];
  const categoryHints: string[] = [];
  const expandedTerms: string[] = [];

  for (const { concept } of winners) {
    matchedConceptIds.push(concept.id);
    if (concept.category && !categoryHints.includes(concept.category)) {
      categoryHints.push(concept.category);
    }
  }
  for (const { concept } of routable) {
    for (const slug of concept.targetSlugs) {
      if (!candidateSlugs.includes(slug)) candidateSlugs.push(slug);
    }
    // Additive expansion phrases (reviewed vocabulary only — never generic tokens,
    // because broad concepts are excluded from `routable`).
    for (const phrase of concept.phrases) {
      const term = normalizeQuery(phrase);
      if (term && !expandedTerms.includes(term)) expandedTerms.push(term);
    }
  }

  const boundedSlugs = candidateSlugs.slice(0, MAX_CANDIDATE_SLUGS);
  const anyAmbiguous = winners.some((m) => m.concept.safety === "ambiguous");
  const ambiguity = anyAmbiguous || boundedSlugs.length > 1;

  // Winner safety: ambiguous if multi-target, else the highest-ranked winner.
  let safety: OperationalConceptSafety;
  if (ambiguity) {
    safety = "ambiguous";
  } else if (routable.length === 1) {
    safety = "safe";
  } else {
    safety = winners
      .slice()
      .sort((a, b) => SAFETY_RANK[b.concept.safety] - SAFETY_RANK[a.concept.safety])[0]
      .concept.safety;
  }

  return {
    originalQuery: raw,
    normalizedQuery,
    matchedConceptIds,
    candidateSlugs: boundedSlugs,
    categoryHints,
    expandedTerms: expandedTerms.slice(0, MAX_EXPANDED_TERMS),
    ambiguity,
    safety,
    safeMessage: undefined,
  };
}

// Additive search helper: reviewed expansion phrases for a query (bounded,
// deduped, never generic tokens). Empty for broad/unsafe/no-match queries.
export function conceptExpansionTerms(raw: string): string[] {
  const result = resolveOperationalIntelligence(raw);
  if (result.safety.startsWith("unsafe_")) return [];
  return result.expandedTerms;
}
