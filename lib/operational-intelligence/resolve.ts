// Deterministic Operational Intelligence — resolver v2 (OPS-2).
//
// Pure, testable, no AI. Normalizes a query, matches reviewed concepts through
// an explicit PRIORITY LADDER, and returns every distinct operational topic it
// finds. No embeddings, no fuzzy matching, no edit distance, no external calls.
//
// Priority ladder (highest wins outright):
//   exact full-query phrase → abbreviation → alias → synonym → concept phrase
//   → broad concept
// Token count is ONLY a tie-break inside the same tier, so a longer generic
// phrase can never erase a second valid operational topic (the v1 defect).
//
// All phrase tables are normalized ONCE at module load, so the query loop does
// no repeated normalization.

import { OPERATIONAL_CONCEPTS } from "./concepts.ts";
import { TIER_RANK } from "./types.ts";
import type {
  OperationalConcept,
  OperationalConceptSafety,
  OperationalIntelligenceResult,
  OperationalMatchTier,
  OperationalTopic,
} from "./types.ts";

const MAX_CANDIDATE_SLUGS = 5;
const MAX_EXPANDED_TERMS = 8;
const MAX_TOPICS = 5;

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

type TermKind = "phrase" | "abbreviation" | "alias" | "synonym" | "misspelling";

type IndexedTerm = {
  concept: OperationalConcept;
  /** Pre-normalized term, padded lookup done against the padded query. */
  term: string;
  tokens: number;
  kind: TermKind;
};

// ---- Precomputed index (built once at module load) ------------------------
const TERM_INDEX: IndexedTerm[] = (() => {
  const out: IndexedTerm[] = [];
  const push = (concept: OperationalConcept, list: string[] | undefined, kind: TermKind) => {
    for (const raw of list ?? []) {
      const term = normalizeQuery(raw);
      if (!term) continue;
      out.push({ concept, term, tokens: term.split(" ").length, kind });
    }
  };
  for (const concept of OPERATIONAL_CONCEPTS) {
    push(concept, concept.phrases, "phrase");
    push(concept, concept.aliases, "alias");
    push(concept, concept.synonyms, "synonym");
    push(concept, concept.abbreviations, "abbreviation");
    push(concept, concept.misspellings, "misspelling");
  }
  return out;
})();

// Whole-token containment: " online check in " contains " check in ", but
// "scan" never matches "can" and "broadcast" never matches "cast".
function containsTerm(paddedQuery: string, term: string): boolean {
  return paddedQuery.includes(` ${term} `);
}

// Tier for one matched term. Broad concepts are capped so a generic single
// token can never outrank real operational vocabulary; a multi-word broad
// phrase ("out of gauge baggage") still counts as a concept-level topic.
function tierFor(entry: IndexedTerm, isFullQuery: boolean): OperationalMatchTier {
  const isBroad = entry.concept.safety === "broad";
  if (isBroad) return entry.tokens >= 2 ? "concept" : "broad";
  if (isFullQuery) return "exact_phrase";
  switch (entry.kind) {
    case "abbreviation":
      return "abbreviation";
    case "alias":
      return "alias";
    case "synonym":
      return "synonym";
    case "misspelling":
      return "concept";
    default:
      return entry.tokens >= 2 ? "concept" : "concept";
  }
}

type ConceptMatch = {
  concept: OperationalConcept;
  tier: OperationalMatchTier;
  rank: number;
  /** Longest matching term (tie-break inside a tier). */
  tokens: number;
};

function matchConcepts(normalized: string): ConceptMatch[] {
  const padded = ` ${normalized} `;
  const best = new Map<string, ConceptMatch>();

  for (const entry of TERM_INDEX) {
    if (!containsTerm(padded, entry.term)) continue;
    const tier = tierFor(entry, entry.term === normalized);
    const rank = TIER_RANK[tier];
    const current = best.get(entry.concept.id);
    if (
      !current ||
      rank > current.rank ||
      (rank === current.rank && entry.tokens > current.tokens)
    ) {
      best.set(entry.concept.id, { concept: entry.concept, tier, rank, tokens: entry.tokens });
    }
  }

  return [...best.values()];
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
    topics: [],
    tier: null,
  };
  if (!normalizedQuery) return empty;

  const matches = matchConcepts(normalizedQuery);
  if (matches.length === 0) return empty;

  // Unsafe wording overrides everything, regardless of tier or specificity.
  const unsafe = matches
    .filter((m) => m.concept.safety.startsWith("unsafe_"))
    .sort((a, b) => SAFETY_RANK[b.concept.safety] - SAFETY_RANK[a.concept.safety])[0];
  if (unsafe) {
    return {
      ...empty,
      matchedConceptIds: [unsafe.concept.id],
      categoryHints: unsafe.concept.category ? [unsafe.concept.category] : [],
      safety: unsafe.concept.safety,
      safeMessage: unsafe.concept.safeMessage,
      topics: [
        {
          conceptId: unsafe.concept.id,
          candidateSlugs: [],
          classification: unsafe.concept.safety,
          category: unsafe.concept.category,
          tier: unsafe.tier,
        },
      ],
      tier: unsafe.tier,
    };
  }

  // Winners: every match in the highest tier present. Deterministic order —
  // routable topics first, then more specific, then concept id.
  const topRank = Math.max(...matches.map((m) => m.rank));
  const winners = matches
    .filter((m) => m.rank === topRank)
    .sort(
      (a, b) =>
        Number(b.concept.targetSlugs.length > 0) - Number(a.concept.targetSlugs.length > 0) ||
        b.tokens - a.tokens ||
        a.concept.id.localeCompare(b.concept.id)
    );

  const topics: OperationalTopic[] = winners.slice(0, MAX_TOPICS).map((m) => ({
    conceptId: m.concept.id,
    candidateSlugs: m.concept.targetSlugs.slice(0, MAX_CANDIDATE_SLUGS),
    classification: m.concept.safety,
    category: m.concept.category,
    tier: m.tier,
  }));

  const matchedConceptIds = topics.map((t) => t.conceptId);
  const categoryHints: string[] = [];
  const candidateSlugs: string[] = [];
  const expandedTerms: string[] = [];

  for (const topic of topics) {
    if (topic.category && !categoryHints.includes(topic.category)) categoryHints.push(topic.category);
    for (const slug of topic.candidateSlugs) {
      if (!candidateSlugs.includes(slug)) candidateSlugs.push(slug);
    }
  }
  // Additive expansion phrases (reviewed vocabulary of routable topics only —
  // never generic tokens, because broad concepts carry no target slugs).
  for (const { concept } of winners) {
    if (concept.targetSlugs.length === 0) continue;
    for (const phrase of concept.phrases) {
      const term = normalizeQuery(phrase);
      if (term && !expandedTerms.includes(term)) expandedTerms.push(term);
    }
  }

  const boundedSlugs = candidateSlugs.slice(0, MAX_CANDIDATE_SLUGS);
  const anyAmbiguous = topics.some((t) => t.classification === "ambiguous");
  // Ambiguous when several distinct topics were detected, a single concept
  // points at several workflows, or the concept itself is marked ambiguous.
  const ambiguity = topics.length > 1 || boundedSlugs.length > 1 || anyAmbiguous;

  let safety: OperationalConceptSafety;
  if (ambiguity) {
    safety = "ambiguous";
  } else if (topics.length === 1 && topics[0].classification === "safe") {
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
    topics,
    tier: winners[0]?.tier ?? null,
  };
}

// Additive search helper: reviewed expansion phrases for a query (bounded,
// deduped, never generic tokens). Empty for broad/unsafe/no-match queries.
export function conceptExpansionTerms(raw: string): string[] {
  const result = resolveOperationalIntelligence(raw);
  if (result.safety.startsWith("unsafe_")) return [];
  return result.expandedTerms;
}
