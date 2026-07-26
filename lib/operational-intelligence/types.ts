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

export type OperationalConcept = {
  id: string;
  /** Registered workflow slugs this concept points to (empty for broad/unsafe). */
  targetSlugs: string[];
  category?: string;
  /** Plain-language phrases (agent/customer wording). */
  phrases: string[];
  /** Airline/service abbreviations (matched as whole tokens). */
  abbreviations?: string[];
  /** Explicit, reviewed misspellings. */
  misspellings?: string[];
  safety: OperationalConceptSafety;
  /** Shown (as guidance, not a result) for broad/ambiguous/unsafe concepts. */
  safeMessage?: string;
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
};
