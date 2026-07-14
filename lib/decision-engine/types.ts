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
