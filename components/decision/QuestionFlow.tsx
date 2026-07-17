"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { answeredCount, nextQuestion, validateAnswer } from "@/lib/decision-engine/session";
import { evaluate } from "@/lib/decision-engine/evaluator";
import { DECISION_DEFINITIONS } from "@/lib/decision-engine/definitions/pregnancy";
import type { AnswerValue, DecisionAnswers, DecisionQuestion } from "@/lib/decision-engine/types";

const SESSION_KEY = "goto.decision.session.v1";

// Guided clarifying-question stepper (Phase B).
// Collects non-sensitive operational context; outcomes arrive with the
// Phase C decision trees. Session survives reloads via sessionStorage.
export function QuestionFlow({
  procedureSlug,
  procedureTitle,
  questions,
  onClose,
}: {
  procedureSlug: string;
  procedureTitle: string;
  questions: DecisionQuestion[];
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<DecisionAnswers>({});
  const [draft, setDraft] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? "null");
      if (stored && stored.procedureSlug === procedureSlug && stored.answers) {
        setAnswers(stored.answers);
      }
    } catch {
      // start fresh
    }
  }, [procedureSlug]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const current = useMemo(() => nextQuestion(questions, answers), [questions, answers]);
  const done = answeredCount(questions, answers);

  function persist(next: DecisionAnswers) {
    try {
      window.sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ procedureSlug, startedAt: Date.now(), answers: next })
      );
    } catch {
      // non-fatal
    }
  }

  function record(question: DecisionQuestion, value: AnswerValue) {
    const problem = validateAnswer(question, value);
    if (problem) {
      setError(problem);
      return;
    }
    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    persist(next);
    setDraft("");
    setError(null);
  }

  function reopen(questionId: string) {
    const next = { ...answers };
    delete next[questionId];
    setAnswers(next);
    persist(next);
    setError(null);
  }

  return (
    <section className="content-card reveal mt-4 overflow-hidden border-t-2 border-t-sky" aria-live="polite">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sky">
            Guided decision · preview
          </p>
          <p className="text-sm font-semibold text-ink">{procedureTitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-sm bg-sky-soft px-2 py-0.5 text-[11px] font-bold text-sky">
            {done}/{questions.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border bg-white px-2.5 py-1 text-xs font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent"
          >
            Close (Esc)
          </button>
        </div>
      </div>

      <div className="p-5">
        {Object.keys(answers).length > 0 && (
          <ul className="mb-4 space-y-1.5">
            {questions
              .filter((question) => question.id in answers)
              .map((question) => (
                <li
                  key={question.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-slate-50 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-ink-muted">
                      {question.label}
                    </span>
                    <span className="block text-sm font-semibold text-ink">
                      {formatAnswer(answers[question.id])}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => reopen(question.id)}
                    className="shrink-0 text-xs font-semibold text-sky transition-colors hover:text-accent"
                  >
                    Edit
                  </button>
                </li>
              ))}
          </ul>
        )}

        {current ? (
          <div>
            <p className="font-display text-base font-semibold text-ink">{current.label}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{current.reason}</p>

            <div className="mt-3">
              {current.answerType === "yes_no" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => record(current, true)}
                    className="press rounded-md border border-border bg-white px-5 py-2 text-sm font-semibold text-ink transition-colors hover:border-sky hover:text-sky"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => record(current, false)}
                    className="press rounded-md border border-border bg-white px-5 py-2 text-sm font-semibold text-ink transition-colors hover:border-sky hover:text-sky"
                  >
                    No
                  </button>
                </div>
              )}
              {current.answerType === "single_choice" && (
                <div className="flex flex-wrap gap-2">
                  {(current.options ?? []).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => record(current, option)}
                      className="press rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-sky hover:text-sky"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
              {current.answerType === "number" && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    record(current, Number(draft));
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="number"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    min={current.min}
                    max={current.max}
                    autoFocus
                    className="w-36 rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky"
                    aria-label={current.label}
                  />
                  <button
                    type="submit"
                    className="press rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent"
                  >
                    Continue &crarr;
                  </button>
                </form>
              )}
            </div>
            {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
          </div>
        ) : DECISION_DEFINITIONS[procedureSlug] ? (
          <OutcomePanel
            definition={DECISION_DEFINITIONS[procedureSlug]}
            answers={answers}
            procedureSlug={procedureSlug}
          />
        ) : (
          <div className="rounded-md border border-blue-200 bg-sky-soft px-4 py-3">
            <p className="text-sm font-bold text-ink">Context captured</p>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              Decision rules for this procedure arrive in the next phase. Until then, verify the
              case against the full procedure card — your answers above stay on this device only.
            </p>
            <Link
              href={`/procedure/${procedureSlug}`}
              className="mt-2 inline-flex rounded bg-navy px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent"
            >
              Open procedure card
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function OutcomePanel({
  definition,
  answers,
  procedureSlug,
}: {
  definition: (typeof DECISION_DEFINITIONS)[string];
  answers: DecisionAnswers;
  procedureSlug: string;
}) {
  const result = evaluate(definition, answers);
  const tone =
    result.outcome === "Not permitted"
      ? "border-red-200 border-l-4 border-l-red-500 bg-red-50"
      : result.outcome === "Can proceed"
        ? "border-good/30 border-l-4 border-l-good bg-mint-soft"
        : result.outcome === "Insufficient information"
          ? "border-amber-200 border-l-4 border-l-warn bg-amber-soft"
          : "border-blue-200 border-l-4 border-l-sky bg-sky-soft";

  return (
    <div className={`rounded-md border px-4 py-3.5 ${tone}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-display text-base font-bold text-ink">{result.outcome}</p>
        <span className="rounded-sm border border-border bg-white px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">
          {result.confidence}
        </span>
      </div>
      <p className="mt-1.5 text-sm leading-6 text-ink">{result.explanation}</p>
      {result.nextAction && (
        <p className="mt-1.5 text-sm font-semibold leading-6 text-ink">
          Next: {result.nextAction}
        </p>
      )}
      {result.missing.length > 0 && (
        <p className="mt-1.5 text-xs font-medium text-ink-muted">
          Missing: {result.missing.join(" · ")}
        </p>
      )}
      {definition.notes.length > 0 && result.outcome !== "Insufficient information" && (
        <ul className="mt-2 space-y-1">
          {definition.notes.map((note) => (
            <li key={note.slice(0, 24)} className="text-xs leading-5 text-ink-muted">
              {note}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2.5 border-t border-ink/10 pt-2 text-[11px] font-medium text-ink-muted">
        Source: GO TO v{definition.sourceVersion} · {definition.sourceChapter} · Page{" "}
        {definition.sourcePages.join(", ")}
        {result.matchedRuleId ? ` · Rule ${result.matchedRuleId}` : ""} — always verify on the
        procedure card.
      </p>
      <Link
        href={`/procedure/${procedureSlug}`}
        className="mt-2 inline-flex rounded bg-navy px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent"
      >
        Open procedure card
      </Link>
    </div>
  );
}

function formatAnswer(value: AnswerValue) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
