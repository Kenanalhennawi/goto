// Decision-engine Phase A types. Kept deliberately small and readable.

export type RoutableCard = {
  id: string;
  title: string;
  slug: string;
  category: string;
  service_code: string | null;
  service_type: string | null;
  summary: string | null;
  keywords: string[] | null;
  aliases: string[] | null;
  priority: number | null;
  /** GO TO source version of the published card (Phase D freshness check). */
  source_version?: string | null;
  /** When the card was last reviewed against source (Phase J preview). */
  last_reviewed_at?: string | null;
  /** Linked source chapter, for the "View source" deep link (Phase J). */
  chapters?: { slug: string } | null;
};

export type MatchedConcept = {
  intent: string;
  phrase: string;
};

export type RoutedProcedure = RoutableCard & {
  score: number;
  viaIntent: boolean;
};

export type ConfidenceLabel = "High confidence" | "Possible workflows" | "Insufficient verified guidance";

export type IntentRouteResult = {
  primary: RoutedProcedure | null;
  related: RoutedProcedure[];
  matchedConcepts: MatchedConcept[];
  confidence: ConfidenceLabel;
  needsClarification: boolean;
};

// ---------- Phase B: clarifying-question framework ----------

export type AnswerType = "yes_no" | "single_choice" | "number";

export type DecisionQuestion = {
  id: string;
  label: string;
  answerType: AnswerType;
  /** Allowed values for single_choice. */
  options?: string[];
  required: boolean;
  /** Why the question is asked (shown to the agent). */
  reason: string;
  /** Which verified rule area this answer affects (audit aid). */
  ruleAffected?: string;
  /** Bounds for number answers. */
  min?: number;
  max?: number;
};

export type AnswerValue = string | number | boolean;

export type DecisionAnswers = Record<string, AnswerValue>;

export type DecisionSessionState = {
  procedureSlug: string;
  startedAt: number;
  answers: DecisionAnswers;
};
