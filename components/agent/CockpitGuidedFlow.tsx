"use client";

import { QuestionFlow } from "@/components/decision/QuestionFlow";
import { QUESTION_SETS } from "@/lib/decision-engine/questions";
import type { CockpitSearchResult } from "./CockpitSearch";

// Lazy guided-flow wrapper (OPS-1). This module — and with it QuestionFlow,
// the question sets and the evaluator — is dynamically imported only when the
// agent explicitly starts guided questions, so none of it is in the initial
// homepage bundle. It passes exactly the same props DecisionIntake passes and
// does NOT fork or re-implement any decision logic: source guard, evaluator,
// keyboard behaviour, session persistence, analytics-once and the outcome
// screen are all the existing QuestionFlow.

export function CockpitGuidedFlow({
  result,
  onClose,
}: {
  result: CockpitSearchResult;
  onClose: () => void;
}) {
  const questions = QUESTION_SETS[result.slug];
  if (!questions) return null;
  return (
    <QuestionFlow
      key={result.slug}
      procedureSlug={result.slug}
      procedureTitle={result.title}
      questions={questions}
      cardSourceVersion={result.source_version}
      cardChapterSlug={result.chapterSlug}
      onClose={onClose}
    />
  );
}

export default CockpitGuidedFlow;
