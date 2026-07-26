// Structured intent dictionary: operational phrases -> target procedure slugs.
// Phrases are routing hints only; they never create policy. Slugs must
// correspond to real procedure cards; the router only ever surfaces cards that
// pass the approved+published visibility filter.
//
// OI-1: this dictionary is now DERIVED from the shared Operational Intelligence
// registry (lib/operational-intelligence/concepts.ts) so search and guided
// routing share ONE reviewed vocabulary. Safe single-slug concepts route
// confidently; ambiguous concepts surface multiple candidates.

import { conceptsForRouter } from "../operational-intelligence/concepts.ts";

export type IntentDefinition = {
  intent: string;
  slugs: string[];
  phrases: string[];
};

export const INTENTS: IntentDefinition[] = conceptsForRouter();
