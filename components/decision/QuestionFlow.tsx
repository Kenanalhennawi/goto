"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { answeredCount, nextQuestion, validateAnswer } from "@/lib/decision-engine/session";
import { evaluate } from "@/lib/decision-engine/evaluator";
import { DECISION_DEFINITIONS, sourceVersionMatches } from "@/lib/decision-engine/definitions";
import { CopyTextButton } from "@/components/CopyTextButton";
import { CopySummaryButton } from "@/components/agent/CopySummaryButton";
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
// Never throws during render. Returns an empty session for missing, corrupt,
// non-object, array, or mismatched-procedure storage. (Unchanged from prior.)
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

// Guided clarifying-question stepper (UX-R1D presentation rebuild).
// One question per screen, keyboard-first, accessible outcome. Session model,
// evaluator, analytics and source-freshness guard are unchanged.
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
  cardSourceVersion?: string | null;
  cardChapterSlug?: string | null;
  onClose: () => void;
}) {
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

  // Persist outward to sessionStorage only (non-sensitive modeled answers).
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

  // Record the started workflow (slug + title only) and fire the started
  // analytics event. Once per mounted procedure — never double-fires.
  useEffect(() => {
    recordRecentWorkflow(procedureSlug, procedureTitle);
    recordAnalyticsEvent({ type: "workflow_started", slug: procedureSlug });
  }, [procedureSlug, procedureTitle]);

  const current = useMemo(() => nextQuestion(questions, answers), [questions, answers]);
  const done = answeredCount(questions, answers);
  const definition = DECISION_DEFINITIONS[procedureSlug];

  // Options for the current question (drives clicks AND keyboard shortcuts).
  const optionList = useMemo<{ label: string; value: AnswerValue }[]>(() => {
    if (!current) return [];
    if (current.answerType === "yes_no") {
      return [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ];
    }
    if (current.answerType === "single_choice") {
      return (current.options ?? []).map((option) => ({ label: option, value: option }));
    }
    return [];
  }, [current]);

  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  optionRefs.current = [];
  const headingRef = useRef<HTMLElement | null>(null);

  const stale =
    definition !== undefined &&
    cardSourceVersion !== undefined &&
    !sourceVersionMatches(cardSourceVersion, definition.sourceVersion);

  // Move focus to the current question heading / outcome heading after each
  // advance, so keyboard and screen-reader users track the change.
  const screenKey = stale ? "__stale__" : current ? current.id : "__outcome__";
  useEffect(() => {
    const id = window.setTimeout(() => headingRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [screenKey]);

  function record(question: DecisionQuestion, value: AnswerValue) {
    const problem = validateAnswer(question, value);
    if (problem) {
      setError(problem);
      return;
    }
    setSession((cur) => ({ ...cur, answers: { ...cur.answers, [question.id]: value } }));
    setDraft("");
    setError(null);
  }

  function reopen(questionId: string) {
    setSession((cur) => {
      const next = { ...cur.answers };
      delete next[questionId];
      return { ...cur, answers: next };
    });
    setError(null);
  }

  function reopenLast() {
    const answered = questions.filter((question) => question.id in answers);
    const last = answered[answered.length - 1];
    if (last) reopen(last.id);
  }

  // Keyboard shortcuts — guarded so they never fire while typing in a field.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const inField =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (inField) return;

      // On the outcome screen only "go back to edit" applies.
      if (!current) {
        if (event.key === "ArrowLeft" || event.key === "Backspace") {
          event.preventDefault();
          reopenLast();
        }
        return;
      }

      // Number keys select the corresponding visible option.
      if (/^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        const option = optionList[index];
        if (option) {
          event.preventDefault();
          record(current, option.value);
        }
        return;
      }

      const buttons = optionRefs.current.filter((el): el is HTMLButtonElement => el !== null);
      if (event.key === "ArrowDown" && buttons.length) {
        event.preventDefault();
        const active = document.activeElement;
        const idx = buttons.findIndex((b) => b === active);
        (buttons[idx + 1] ?? buttons[0]).focus();
        return;
      }
      if (event.key === "ArrowUp" && buttons.length) {
        event.preventDefault();
        const active = document.activeElement;
        const idx = buttons.findIndex((b) => b === active);
        (buttons[idx - 1] ?? buttons[buttons.length - 1]).focus();
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "Backspace") {
        event.preventDefault();
        reopenLast();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, answers, optionList, onClose]);

  // Source-freshness guard (unchanged): disable the flow rather than risk a
  // stale outcome. No internal reason is exposed to ordinary agents.
  if (stale) {
    return (
      <section className="agent-hero mt-4 p-5" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <h2 ref={headingRef as RefObject<HTMLHeadingElement>} tabIndex={-1} className="font-display text-lg font-semibold text-ink focus-visible:outline-none">
            {procedureTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="agent-secondary touch-target inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold"
          >
            Close
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          Guided questions are not currently available. Use the full procedure instead.
        </p>
        <Link
          href={`/procedure/${procedureSlug}`}
          className="agent-primary touch-target mt-3 inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold"
        >
          Open full procedure
        </Link>
      </section>
    );
  }

  const total = questions.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <section className="agent-hero mt-4 p-5 sm:p-6">
      {/* Progress */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky" aria-live="polite">
          {current ? `Question ${Math.min(done + 1, total)} of ${total}` : "Result"}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="agent-secondary touch-target inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold focus-visible:outline-none"
        >
          Close
        </button>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border" aria-hidden="true">
        <div className="h-full rounded-full bg-sky transition-[width] duration-300" style={{ width: `${current ? percent : 100}%` }} />
      </div>

      {current ? (
        <fieldset className="mt-5 border-0 p-0">
          <legend className="p-0">
            <span
              ref={headingRef as RefObject<HTMLSpanElement>}
              tabIndex={-1}
              className="block font-display text-lg font-semibold leading-snug text-ink focus-visible:outline-none sm:text-xl"
            >
              {current.label}
            </span>
          </legend>
          {current.reason ? (
            <p id={`help-${current.id}`} className="mt-1.5 text-sm leading-6 text-ink-muted">
              {current.reason}
            </p>
          ) : null}

          <div className="mt-4 space-y-2.5" aria-describedby={current.reason ? `help-${current.id}` : undefined}>
            {current.answerType === "number" ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  record(current, Number(draft));
                }}
                className="flex flex-col gap-2.5 sm:flex-row"
              >
                <input
                  type="number"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  min={current.min}
                  max={current.max}
                  autoFocus
                  aria-label={current.label}
                  className="agent-search-input touch-target w-full px-4 py-3 text-[15px] text-ink sm:w-48"
                />
                <button
                  type="submit"
                  className="agent-primary touch-target inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold focus-visible:outline-none"
                >
                  Continue
                </button>
              </form>
            ) : (
              optionList.map((option, index) => (
                <button
                  key={option.label}
                  ref={(el) => {
                    optionRefs.current[index] = el;
                  }}
                  type="button"
                  onClick={() => record(current, option.value)}
                  className="group flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 text-left transition-colors hover:border-sky hover:bg-sky-soft/40 focus-visible:border-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-slate-50 text-xs font-bold text-ink-muted group-hover:border-sky group-hover:text-sky">
                    {index + 1}
                  </span>
                  <span className="text-[15px] font-semibold text-ink">{option.label}</span>
                </button>
              ))
            )}
          </div>
          {error ? <p className="mt-2 text-sm font-semibold text-warn">{error}</p> : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {done > 0 ? (
              <button
                type="button"
                onClick={reopenLast}
                className="agent-secondary touch-target inline-flex items-center rounded-lg px-3.5 py-2 text-xs font-semibold focus-visible:outline-none"
              >
                &larr; Back
              </button>
            ) : null}
            <p className="hidden text-xs text-ink-faint sm:block">
              Press <Kbd>1</Kbd>–<Kbd>9</Kbd> to choose · <Kbd>↑</Kbd><Kbd>↓</Kbd> to move · <Kbd>Enter</Kbd> to select
            </p>
          </div>

          {done > 0 ? <ReviewAnswers questions={questions} answers={answers} onEdit={reopen} /> : null}
        </fieldset>
      ) : definition ? (
        <OutcomeScreen
          definition={definition}
          answers={answers}
          procedureSlug={procedureSlug}
          chapterSlug={cardChapterSlug}
          startedAt={session.startedAt}
          questionsAnswered={done}
          headingRef={headingRef as RefObject<HTMLHeadingElement>}
          onStartAgain={() => setSession((cur) => ({ ...cur, answers: {} }))}
        />
      ) : null}
    </section>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="mx-0.5 rounded border border-border bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-muted">
      {children}
    </kbd>
  );
}

function ReviewAnswers({
  questions,
  answers,
  onEdit,
}: {
  questions: DecisionQuestion[];
  answers: DecisionAnswers;
  onEdit: (id: string) => void;
}) {
  const answered = questions.filter((question) => question.id in answers);
  if (answered.length === 0) return null;
  return (
    <details className="agent-disclosure mt-4 border-t border-border pt-3">
      <summary className="touch-target flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-sky focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky">
        <span className="disclosure-chevron" aria-hidden="true">▸</span>
        Review answers ({answered.length})
      </summary>
      <ul className="mt-3 space-y-2">
        {answered.map((question) => (
          <li key={question.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-2">
            <span className="min-w-0">
              <span className="block truncate text-xs text-ink-muted">{question.label}</span>
              <span className="block text-sm font-semibold text-ink">{formatAnswer(answers[question.id])}</span>
            </span>
            <button
              type="button"
              onClick={() => onEdit(question.id)}
              className="shrink-0 text-xs font-semibold text-sky transition-colors hover:text-accent"
            >
              Edit
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

const OUTCOME_STYLE: Record<string, { badge: string; icon: string }> = {
  "Can proceed": { badge: "border-good/30 bg-mint-soft text-good", icon: "✓" },
  "Can proceed with conditions": { badge: "border-good/30 bg-mint-soft text-good", icon: "✓" },
  "Requires document": { badge: "border-blue-200 bg-sky-soft text-sky", icon: "▤" },
  "Requires supervisor": { badge: "border-blue-200 bg-sky-soft text-sky", icon: "↑" },
  "Not permitted": { badge: "border-red-200 bg-red-50 text-red-700", icon: "✕" },
  "Insufficient information": { badge: "border-amber-200 bg-amber-soft text-warn", icon: "?" },
};

function OutcomeScreen({
  definition,
  answers,
  procedureSlug,
  chapterSlug = null,
  startedAt,
  questionsAnswered,
  headingRef,
  onStartAgain,
}: {
  definition: (typeof DECISION_DEFINITIONS)[string];
  answers: DecisionAnswers;
  procedureSlug: string;
  chapterSlug?: string | null;
  startedAt?: number;
  questionsAnswered?: number;
  headingRef: RefObject<HTMLHeadingElement>;
  onStartAgain: () => void;
}) {
  const result = evaluate(definition, answers);
  const pages = result.rulePages ?? definition.sourcePages;
  const insufficient = result.outcome === "Insufficient information";
  const showNotes = !insufficient && definition.notes.length > 0;
  const matchedRule = definition.rules.find((rule) => rule.id === result.matchedRuleId);
  const sourceField = matchedRule?.sourceField ?? null;
  const style = OUTCOME_STYLE[result.outcome] ?? OUTCOME_STYLE["Insufficient information"];

  // Log outcome to device-local history + fire the completed analytics event.
  // Runs exactly once per completed outcome panel (never double-fires).
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
    passengerAdvice: showNotes ? definition.notes : null,
    matchedRuleId: result.matchedRuleId,
    sourceChapter: definition.sourceChapter,
    sourcePages: pages,
    sourceVersion: definition.sourceVersion,
  };
  const summary = formatOutcomeSummary(summaryInput);

  return (
    <div className="mt-5" aria-live="polite">
      {insufficient ? (
        <>
          <h2 ref={headingRef} tabIndex={-1} className="font-display text-xl font-semibold text-ink focus-visible:outline-none">
            More information is needed
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-ink-muted">{result.explanation}</p>
          {result.missing.length > 0 ? (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Still needed</p>
              <ul className="mt-1.5 space-y-1.5">
                {result.missing.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-6 text-ink">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky">Result</p>
          <div className="mt-1 flex items-center gap-2.5">
            <span
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${style.badge}`}
              aria-hidden="true"
            >
              {style.icon}
            </span>
            <h2 ref={headingRef} tabIndex={-1} className="font-display text-xl font-semibold text-ink focus-visible:outline-none sm:text-2xl">
              {result.outcome}
            </h2>
          </div>

          <OutcomeField label="What this means">{result.explanation}</OutcomeField>
          {result.nextAction ? <OutcomeField label="Required action">{result.nextAction}</OutcomeField> : null}
          {result.derived ? (
            <p className="mt-1.5 rounded-md border border-border bg-white/70 px-3 py-2 text-sm leading-6 text-ink">
              {result.derived}
            </p>
          ) : null}
          {showNotes ? (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Notes</p>
              <ul className="mt-1.5 space-y-1.5">
                {definition.notes.map((note) => (
                  <li key={note.slice(0, 28)} className="flex gap-2 text-sm leading-6 text-ink">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky" aria-hidden="true" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}

      {/* Source — collapsed, no source version / freshness on the agent screen */}
      <details className="agent-disclosure mt-4 border-t border-border pt-3">
        <summary className="touch-target flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-sky focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky">
          <span className="disclosure-chevron" aria-hidden="true">▸</span>
          Source &amp; reference
        </summary>
        <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          <SourceFact label="Source chapter" value={definition.sourceChapter} />
          <SourceFact label="Pages" value={pages.join(", ")} />
          {sourceField ? <SourceFact label="Source field" value={sourceField} /> : null}
        </dl>
      </details>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <Link
          href={`/procedure/${procedureSlug}`}
          className="agent-primary touch-target inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold focus-visible:outline-none"
        >
          Open full procedure
        </Link>
        <button
          type="button"
          onClick={onStartAgain}
          className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
        >
          Start again
        </button>
        <CopySummaryButton text={summary} label="Copy outcome summary" announce="Outcome summary copied" />
        {chapterSlug ? (
          <Link
            href={`/chapter/${chapterSlug}`}
            className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
          >
            View source
          </Link>
        ) : null}
        <ExportMenu input={summaryInput} />
      </div>
    </div>
  );
}

function OutcomeField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
      <p className="mt-0.5 text-sm leading-6 text-ink">{children}</p>
    </div>
  );
}

function SourceFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5 last:border-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

// Copy the verified outcome in an audience-specific format. Reuses the pure
// export formatter (no new content, no passenger data). Unchanged behavior.
function ExportMenu({ input }: { input: OutcomeSummaryInput }) {
  const [open, setOpen] = useState(false);
  const kinds: OutcomeExportKind[] = ["customer", "internal", "salesforce", "email"];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="agent-secondary touch-target inline-flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
      >
        Copy for… ▾
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-48 rounded-md border border-border bg-white p-1 shadow-[var(--shadow-lg)]">
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
