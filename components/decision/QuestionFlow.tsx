"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { answeredCount, nextQuestion, validateAnswer } from "@/lib/decision-engine/session";
import { evaluate } from "@/lib/decision-engine/evaluator";
import { DECISION_DEFINITIONS, sourceVersionMatches } from "@/lib/decision-engine/definitions";
import { CopyTextButton } from "@/components/CopyTextButton";
import {
  recordRecentWorkflow,
  recordDecisionOutcome,
  formatOutcomeSummary,
  formatOutcomeExport,
  OUTCOME_EXPORT_LABELS,
  type OutcomeExportKind,
  type OutcomeSummaryInput,
} from "@/lib/agent-workspace";
import { recordAnalyticsEvent } from "@/lib/decision-analytics";
import type { AnswerValue, DecisionAnswers, DecisionQuestion } from "@/lib/decision-engine/types";

const SESSION_KEY = "goto.decision.session.v1";

type StoredDecisionSession = {
  startedAt: number;
  answers: DecisionAnswers;
};

// Pure, SSR-safe reader for the non-sensitive guided-decision session.
// Never throws during render, so a lazy state initializer can call it
// directly. Returns an empty session for missing, corrupt, non-object,
// array, or mismatched-procedure storage.
function readStoredSession(procedureSlug: string): {
  answers: DecisionAnswers;
  startedAt: number | null;
} {
  const empty = { answers: {} as DecisionAnswers, startedAt: null };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return empty;
    const stored = JSON.parse(raw);
    if (
      !stored ||
      typeof stored !== "object" ||
      stored.procedureSlug !== procedureSlug ||
      typeof stored.answers !== "object" ||
      stored.answers === null ||
      Array.isArray(stored.answers)
    ) {
      return empty;
    }
    const startedAt =
      typeof stored.startedAt === "number" && Number.isFinite(stored.startedAt)
        ? stored.startedAt
        : null;
    return { answers: stored.answers as DecisionAnswers, startedAt };
  } catch {
    return empty;
  }
}

// Guided clarifying-question stepper (Phase B).
// Collects non-sensitive operational context; outcomes arrive with the
// Phase C decision trees. Session survives reloads via sessionStorage.
export function QuestionFlow({
  procedureSlug,
  procedureTitle,
  questions,
  cardSourceVersion,
  cardChapterSlug = null,
  onClose,
}: {
  procedureSlug: string;
  procedureTitle: string;
  questions: DecisionQuestion[];
  /** source_version of the published card, used for the freshness guard. */
  cardSourceVersion?: string | null;
  /** linked source chapter slug for the "View source" deep link. */
  cardChapterSlug?: string | null;
  onClose: () => void;
}) {
  // Single lazy session state: answers plus a stable startedAt. The lazy
  // initializer is the only place a clock is read (allowed: it runs once on
  // mount, not on every render/update). A changing procedureSlug remounts
  // this component via a `key` at the call site, so the initializer re-runs
  // cleanly instead of relying on setState inside an effect.
  const [session, setSession] = useState<StoredDecisionSession>(() => {
    const stored = readStoredSession(procedureSlug);
    return {
      answers: stored.answers,
      startedAt: stored.startedAt ?? new Date().getTime(),
    };
  });
  const [draft, setDraft] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const answers = session.answers;

  // Synchronize state outward to sessionStorage only. Never calls setState.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          procedureSlug,
          startedAt: session.startedAt,
          answers: session.answers,
        })
      );
    } catch {
      // Storage failure is non-fatal.
    }
  }, [procedureSlug, session]);

  // Record the started workflow for the homepage/palette "recent" lists
  // (slug + title only, device-local) and fire the started analytics event.
  useEffect(() => {
    recordRecentWorkflow(procedureSlug, procedureTitle);
    recordAnalyticsEvent({ type: "workflow_started", slug: procedureSlug });
  }, [procedureSlug, procedureTitle]);

  const current = useMemo(() => nextQuestion(questions, answers), [questions, answers]);
  const done = answeredCount(questions, answers);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (event.key === "Escape") {
        onClose();
        return;
      }
      // ArrowLeft edits the previous answer (reopens the last answered question),
      // unless the agent is typing in a field.
      if (event.key === "ArrowLeft" && !inField) {
        const answered = questions.filter((question) => question.id in answers);
        const last = answered[answered.length - 1];
        if (last) {
          event.preventDefault();
          reopen(last.id);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // reopen is stable enough; answers/questions drive which question is reopened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, questions, answers]);

  // Source-freshness guard (Phase D): when the published card's source
  // version no longer matches the version this tree was verified against,
  // disable the guided workflow rather than risk a stale outcome.
  const definition = DECISION_DEFINITIONS[procedureSlug];
  const stale =
    definition !== undefined &&
    cardSourceVersion !== undefined &&
    !sourceVersionMatches(cardSourceVersion, definition.sourceVersion);

  if (stale) {
    return (
      <section className="content-card reveal mt-4 overflow-hidden border-t-2 border-t-warn" aria-live="polite">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-warn">
              Guided decision · unavailable
            </p>
            <p className="text-sm font-semibold text-ink">{procedureTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border bg-white px-2.5 py-1 text-xs font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent"
          >
            Close (Esc)
          </button>
        </div>
        <div className="p-5">
          <div className="rounded-md border border-amber-200 bg-amber-soft px-4 py-3">
            <p className="text-sm font-bold text-ink">
              Guided decision temporarily unavailable because the operational source requires review.
            </p>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              This workflow was verified against GO TO v{definition.sourceVersion}, but the
              published card cites {cardSourceVersion ? `v${cardSourceVersion}` : "no source version"}.
              Verify the case against the full procedure card instead.
            </p>
            <Link
              href={`/procedure/${procedureSlug}`}
              className="mt-2 inline-flex rounded bg-navy px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent"
            >
              Open procedure card
            </Link>
          </div>
        </div>
      </section>
    );
  }

  function record(question: DecisionQuestion, value: AnswerValue) {
    const problem = validateAnswer(question, value);
    if (problem) {
      setError(problem);
      return;
    }
    // Update answers only; startedAt stays stable and the storage effect
    // persists after commit.
    setSession((current) => ({
      ...current,
      answers: { ...current.answers, [question.id]: value },
    }));
    setDraft("");
    setError(null);
  }

  function reopen(questionId: string) {
    setSession((current) => {
      const next = { ...current.answers };
      delete next[questionId];
      return { ...current, answers: next };
    });
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
            chapterSlug={cardChapterSlug}
            startedAt={session.startedAt}
            questionsAnswered={done}
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
  chapterSlug = null,
  startedAt,
  questionsAnswered,
}: {
  definition: (typeof DECISION_DEFINITIONS)[string];
  answers: DecisionAnswers;
  procedureSlug: string;
  chapterSlug?: string | null;
  startedAt?: number;
  questionsAnswered?: number;
}) {
  const result = evaluate(definition, answers);
  const pages = result.rulePages ?? definition.sourcePages;
  const showAdvice = result.outcome !== "Insufficient information" && definition.notes.length > 0;

  // Log the reached outcome to device-local decision history (slug + outcome +
  // timestamp only — never passenger data) and fire the completed analytics
  // event (aggregates only). Records once per completed panel.
  useEffect(() => {
    recordDecisionOutcome({
      slug: procedureSlug,
      title: definition.procedureTitle,
      outcome: result.outcome,
      at: Date.now(),
    });
    recordAnalyticsEvent({
      type: "workflow_completed",
      slug: procedureSlug,
      outcome: result.outcome,
      questions: questionsAnswered ?? 0,
      durationMs: startedAt ? Math.max(0, Date.now() - startedAt) : 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summaryInput: OutcomeSummaryInput = {
    title: definition.procedureTitle,
    outcome: result.outcome,
    nextAction: result.nextAction,
    passengerAdvice: showAdvice ? definition.notes : null,
    matchedRuleId: result.matchedRuleId,
    sourceChapter: definition.sourceChapter,
    sourcePages: pages,
    sourceVersion: definition.sourceVersion,
  };
  const summary = formatOutcomeSummary(summaryInput);

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
      {/* Result */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-display text-base font-bold text-ink">{result.outcome}</p>
        <span className="rounded-sm border border-border bg-white px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">
          {result.confidence}
        </span>
      </div>
      <p className="mt-1.5 text-sm leading-6 text-ink">{result.explanation}</p>

      {/* Required action */}
      {result.nextAction && (
        <Field label="Required action">{result.nextAction}</Field>
      )}
      {result.derived && (
        <p className="mt-1.5 rounded-sm border border-ink/10 bg-white/60 px-2 py-1.5 font-mono text-xs leading-5 text-ink">
          {result.derived}
        </p>
      )}
      {result.missing.length > 0 && (
        <p className="mt-1.5 text-xs font-medium text-ink-muted">
          Missing: {result.missing.join(" · ")}
        </p>
      )}

      {/* Notes / advice */}
      {showAdvice && (
        <div className="mt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Notes</p>
          <ul className="mt-1 space-y-1">
            {definition.notes.map((note) => (
              <li key={note.slice(0, 24)} className="text-xs leading-5 text-ink-muted">
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reference */}
      <p className="mt-2.5 border-t border-ink/10 pt-2 text-[11px] font-medium text-ink-muted">
        Reference: GO TO v{definition.sourceVersion} · {definition.sourceChapter} · Page{" "}
        {pages.join(", ")}
        {result.matchedRuleId ? ` · Rule ${result.matchedRuleId}` : ""} — always verify on the
        procedure card.
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Link
          href={`/procedure/${procedureSlug}`}
          className="inline-flex rounded bg-navy px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent"
        >
          Open procedure card
        </Link>
        <Link
          href={chapterSlug ? `/chapter/${chapterSlug}` : `/procedure/${procedureSlug}`}
          className="inline-flex rounded border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
        >
          View source
        </Link>
        <CopyTextButton text={summary} label="Copy summary" />
        <ExportMenu input={summaryInput} />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
      <p className="text-sm font-semibold leading-6 text-ink">{children}</p>
    </div>
  );
}

// Copy the verified outcome in an audience-specific format. Reuses the pure
// export formatter (no new content, no passenger data).
function ExportMenu({ input }: { input: OutcomeSummaryInput }) {
  const [open, setOpen] = useState(false);
  const kinds: OutcomeExportKind[] = ["customer", "internal", "salesforce", "email"];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="press inline-flex items-center gap-1 rounded border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
      >
        Export ▾
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-44 rounded-md border border-border bg-white p-1 shadow-[var(--shadow-lg)]">
          {kinds.map((kind) => (
            <div key={kind} className="[&>button]:w-full [&>button]:justify-start [&>button]:border-0">
              <CopyTextButton text={formatOutcomeExport(kind, input)} label={OUTCOME_EXPORT_LABELS[kind]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatAnswer(value: AnswerValue) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
