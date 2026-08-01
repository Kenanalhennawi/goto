"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { resolveOperationalIntelligence } from "@/lib/operational-intelligence/resolve";
import { CockpitSearch, type CockpitSearchPayload, type CockpitSearchResult } from "./CockpitSearch";
import { CockpitSuggestions, type SuggestionsVariant } from "./CockpitSuggestions";

// Conversation-driven Agent Cockpit (OPS-1). One screen: type the scenario →
// likely matches → best operational answer in place → guided questions in
// place when available → outcome (owned by QuestionFlow) → search another
// issue. Progressive disclosure only — never a dashboard.
//
// State is memory-only: the raw scenario is never persisted, never written to
// a URL (unless the agent explicitly opens "Search all results" on /search),
// and never sent anywhere except the existing bounded /api/search request.
//
// DYNAMIC-IMPORT BOUNDARY (documented for OPS-1 §16):
//   initial bundle  — CockpitSearch + CockpitSuggestions + OI resolver only
//   on answer       — CockpitAnswer chunk (deriveOperationalAnswer +
//                     getWorkflowAvailability, which carries the decision
//                     registry data needed for the availability gate)
//   on guided start — CockpitGuidedFlow chunk (QuestionFlow + QUESTION_SETS +
//                     evaluator), mounted only after the explicit user action.
const CockpitAnswer = dynamic(() => import("./CockpitAnswer"), {
  ssr: false,
  loading: () => (
    <p className="mt-5 text-sm text-ink-muted" role="status">
      Loading answer…
    </p>
  ),
});
const CockpitGuidedFlow = dynamic(() => import("./CockpitGuidedFlow"), {
  ssr: false,
  loading: () => (
    <p className="mt-4 text-sm text-ink-muted" role="status">
      Loading guided questions…
    </p>
  ),
});

type CockpitState =
  | { stage: "idle" }
  | { stage: "suggestions"; query: string; results: CockpitSearchResult[]; variant: SuggestionsVariant }
  | { stage: "answer"; query: string; result: CockpitSearchResult; alternateResults: CockpitSearchResult[] }
  | { stage: "decision"; query: string; result: CockpitSearchResult; alternateResults: CockpitSearchResult[] };

// Classify a submitted scenario using the existing OI resolver + the existing
// ranked card results. This invents nothing: safety, ambiguity and candidate
// slugs come from the reviewed registry; ordering comes from search ranking.
function classify(payload: CockpitSearchPayload): CockpitState {
  const { query, results, firstChapterSlug, failed } = payload;
  if (failed) {
    return { stage: "suggestions", query, results: [], variant: { kind: "network-failure" } };
  }
  const intel = resolveOperationalIntelligence(query);

  if (intel.safety.startsWith("unsafe_")) {
    return {
      stage: "suggestions",
      query,
      results,
      variant: {
        kind: "unsafe",
        message:
          intel.safeMessage ??
          "This scenario needs the relevant official guidance. Review the related procedures.",
        items: results.slice(0, 3),
      },
    };
  }

  if (intel.ambiguity && intel.candidateSlugs.length > 1) {
    // Prefer the OI candidate ordering when those cards were returned.
    const bySlug = new Map(results.map((r) => [r.slug, r]));
    const candidates = intel.candidateSlugs
      .map((slug) => bySlug.get(slug))
      .filter((r): r is CockpitSearchResult => Boolean(r));
    const items = candidates.length > 0 ? candidates : results.slice(0, 3);
    const kind = intel.matchedConceptIds.length > 1 ? "multi-topic" : "ambiguous";
    if (items.length > 1) {
      return { stage: "suggestions", query, results, variant: { kind, items } };
    }
  }

  if (results.length === 0) {
    return { stage: "suggestions", query, results, variant: { kind: "no-match", firstChapterSlug } };
  }

  return { stage: "answer", query, result: results[0], alternateResults: results.slice(1, 4) };
}

export function AgentCockpit() {
  const [state, setState] = useState<CockpitState>({ stage: "idle" });
  const inputRef = useRef<HTMLInputElement | null>(null);

  function reset() {
    // Clears the scenario and results from memory; Favorites/Recent and
    // QuestionFlow's own modeled-answer storage are untouched.
    setState({ stage: "idle" });
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function openAnswer(result: CockpitSearchResult, payload: CockpitSearchPayload) {
    setState({
      stage: "answer",
      query: payload.query,
      result,
      alternateResults: payload.results.filter((r) => r.slug !== result.slug).slice(0, 3),
    });
  }

  const statusMessage =
    state.stage === "answer" || state.stage === "decision"
      ? `Best operational answer shown: ${state.result.title}`
      : state.stage === "suggestions"
        ? "Results updated."
        : "";

  return (
    <div>
      <CockpitSearch
        inputRef={inputRef}
        onPick={(result, payload) => openAnswer(result, payload)}
        onSubmitScenario={(payload) => setState(classify(payload))}
        showGuidedLink={state.stage === "idle"}
      />

      {state.stage === "idle" ? (
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-border pt-4 text-xs text-ink-muted">
          <span className="font-semibold uppercase tracking-wider text-ink-faint">What you&rsquo;ll get</span>
          <span>Quick operational answer</span>
          <span aria-hidden="true" className="text-ink-faint">·</span>
          <span>Guided questions when needed</span>
          <span aria-hidden="true" className="text-ink-faint">·</span>
          <span>Original source available</span>
        </div>
      ) : null}

      {state.stage === "suggestions" ? (
        <CockpitSuggestions
          variant={state.variant}
          query={state.query}
          onPick={(result) =>
            openAnswer(result, {
              query: state.query,
              results: state.results,
              firstChapterSlug: null,
              failed: false,
            })
          }
          onReset={reset}
        />
      ) : null}

      {state.stage === "answer" || state.stage === "decision" ? (
        <>
          <CockpitAnswer
            result={state.result}
            guidedActive={state.stage === "decision"}
            onStartGuided={() => setState({ ...state, stage: "decision" })}
            onSearchAnother={reset}
          />

          {state.stage === "decision" ? (
            <CockpitGuidedFlow
              result={state.result}
              onClose={() => setState({ ...state, stage: "answer" })}
            />
          ) : null}

          {state.alternateResults.length > 0 && state.stage === "answer" ? (
            <section className="mt-6" aria-label="Other possible procedures">
              <h2 className="font-display text-base font-semibold text-ink">Other possible procedures</h2>
              <ul className="mt-3 space-y-2">
                {state.alternateResults.map((alt) => (
                  <li key={alt.slug}>
                    <button
                      type="button"
                      onClick={() => setState({ ...state, stage: "answer", result: alt, alternateResults: [state.result, ...state.alternateResults.filter((r) => r.slug !== alt.slug)].slice(0, 3) })}
                      className="touch-target flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-2.5 text-left transition-colors hover:border-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-ink">{alt.title}</span>
                        {alt.summary ? (
                          <span className="mt-0.5 block truncate text-xs text-ink-muted">{alt.summary}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-sky">Open answer</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      <span role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </span>
    </div>
  );
}
