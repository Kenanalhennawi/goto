// Deterministic Operational Intelligence — shared types (OI-1).
// A small, reviewed vocabulary layer. It maps how agents describe customer
// scenarios to known workflow slugs / categories. It never models operational
// rules, never invents answers, and never changes card visibility.

export type OperationalConceptSafety =
  | "safe" // maps to exactly one workflow — safe to route/boost
  | "broad" // a category, not one workflow — search only, never auto-route
  | "ambiguous" // maps to several workflows — show multiple, never force one
  | "unsafe_immigration"
  | "unsafe_medical"
  | "unsafe_approval";

// OPS-2 deterministic priority ladder. Higher tiers win outright; token count
// only breaks ties INSIDE a tier, so a long generic phrase can never erase a
// second valid operational topic.
export type OperationalMatchTier =
  | "exact_phrase" // the whole query is exactly a reviewed phrase
  | "abbreviation" // reviewed airline/SSR abbreviation
  | "alias" // reviewed operational alias
  | "synonym" // reviewed strong synonym
  | "concept" // reviewed concept phrase
  | "broad"; // generic single-token category word

export const TIER_RANK: Record<OperationalMatchTier, number> = {
  exact_phrase: 6,
  abbreviation: 5,
  alias: 4,
  synonym: 3,
  concept: 2,
  broad: 1,
};

export type OperationalConcept = {
  id: string;
  /** Registered workflow slugs this concept points to (empty for broad/unsafe). */
  targetSlugs: string[];
  category?: string;
  /** Plain-language phrases (agent/customer wording). */
  phrases: string[];
  /** Airline/service abbreviations (matched as whole tokens). */
  abbreviations?: string[];
  /** Reviewed operational aliases (outrank synonyms and plain phrases). */
  aliases?: string[];
  /** Reviewed strong synonyms (canonical-meaning equivalents). */
  synonyms?: string[];
  /** Explicit, reviewed misspellings. */
  misspellings?: string[];
  safety: OperationalConceptSafety;
  /** Source chapter this concept points at (reference concepts especially). */
  chapterHint?: string;
  /** Shown (as guidance, not a result) for broad/ambiguous/unsafe concepts. */
  safeMessage?: string;
};

/** One distinct operational topic detected in a query. Never merged. */
export type OperationalTopic = {
  conceptId: string;
  candidateSlugs: string[];
  classification: OperationalConceptSafety;
  category?: string;
  tier: OperationalMatchTier;
};

export type OperationalIntelligenceResult = {
  originalQuery: string;
  normalizedQuery: string;
  matchedConceptIds: string[];
  candidateSlugs: string[];
  categoryHints: string[];
  expandedTerms: string[];
  ambiguity: boolean;
  safety: OperationalConceptSafety;
  safeMessage?: string;
  /** Distinct operational topics, deterministically ordered, bounded. */
  topics: OperationalTopic[];
  /** Winning tier (explainability / tests). Null when nothing matched. */
  tier: OperationalMatchTier | null;
};
