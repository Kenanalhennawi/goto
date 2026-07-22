// Decision analytics infrastructure (Phase J) — reusable hooks/events only.
// NO dashboards are built here. Everything is device-local and aggregate-only:
// we never store answers, PNR, name, passport, phone, email, or any free text —
// only counts, durations, and outcome tallies keyed by workflow slug.

export const ANALYTICS_KEY = "goto.decision.analytics.v1";
export const ANALYTICS_EVENT = "goto:analytics-changed";

export type DecisionAnalyticsEvent =
  | { type: "workflow_started"; slug: string }
  | { type: "workflow_completed"; slug: string; outcome: string; questions: number; durationMs: number }
  | { type: "workflow_abandoned"; slug: string; questions: number; durationMs: number };

export type WorkflowAggregate = {
  started: number;
  completed: number;
  abandoned: number;
  totalQuestions: number; // across completed
  totalDurationMs: number; // across completed
  outcomes: Record<string, number>;
};

export type AnalyticsState = Record<string, WorkflowAggregate>;

function emptyAggregate(): WorkflowAggregate {
  return { started: 0, completed: 0, abandoned: 0, totalQuestions: 0, totalDurationMs: 0, outcomes: {} };
}

// Pure reducer — apply one event to the aggregate state. Testable without a DOM.
export function reduceAnalytics(state: AnalyticsState, event: DecisionAnalyticsEvent): AnalyticsState {
  if (!event || typeof event.slug !== "string" || !event.slug) return state;
  const prev = state[event.slug] ?? emptyAggregate();
  const agg: WorkflowAggregate = {
    ...prev,
    outcomes: { ...prev.outcomes },
  };
  if (event.type === "workflow_started") {
    agg.started += 1;
  } else if (event.type === "workflow_completed") {
    agg.completed += 1;
    agg.totalQuestions += Math.max(0, event.questions | 0);
    agg.totalDurationMs += Math.max(0, event.durationMs | 0);
    const key = typeof event.outcome === "string" && event.outcome ? event.outcome : "Unknown";
    agg.outcomes[key] = (agg.outcomes[key] ?? 0) + 1;
  } else if (event.type === "workflow_abandoned") {
    agg.abandoned += 1;
  }
  return { ...state, [event.slug]: agg };
}

export type WorkflowMetrics = {
  slug: string;
  started: number;
  completed: number;
  abandoned: number;
  completionRate: number;
  avgQuestions: number;
  avgDurationMs: number;
  topOutcome: string | null;
  outcomes: Record<string, number>;
};

export function summarizeWorkflow(slug: string, agg: WorkflowAggregate): WorkflowMetrics {
  const outcomeEntries = Object.entries(agg.outcomes);
  const topOutcome =
    outcomeEntries.length > 0
      ? outcomeEntries.sort((a, b) => b[1] - a[1])[0][0]
      : null;
  return {
    slug,
    started: agg.started,
    completed: agg.completed,
    abandoned: agg.abandoned,
    completionRate: agg.started > 0 ? agg.completed / agg.started : 0,
    avgQuestions: agg.completed > 0 ? agg.totalQuestions / agg.completed : 0,
    avgDurationMs: agg.completed > 0 ? agg.totalDurationMs / agg.completed : 0,
    topOutcome,
    outcomes: agg.outcomes,
  };
}

// ---------------------------------------------------------------------------
// localStorage wrappers (SSR-safe, never throw)
// ---------------------------------------------------------------------------

export function readAnalytics(): AnalyticsState {
  if (typeof window === "undefined") return {};
  try {
    const stored = JSON.parse(window.localStorage.getItem(ANALYTICS_KEY) ?? "{}");
    return stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as AnalyticsState) : {};
  } catch {
    return {};
  }
}

/** Record an analytics event locally. The single hook the UI calls. */
export function recordAnalyticsEvent(event: DecisionAnalyticsEvent) {
  if (typeof window === "undefined") return;
  try {
    const next = reduceAnalytics(readAnalytics(), event);
    window.localStorage.setItem(ANALYTICS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(ANALYTICS_EVENT));
  } catch {
    // non-fatal
  }
}

export function readWorkflowMetrics(): WorkflowMetrics[] {
  const state = readAnalytics();
  return Object.entries(state)
    .map(([slug, agg]) => summarizeWorkflow(slug, agg))
    .sort((a, b) => b.started - a.started);
}
