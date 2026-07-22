"use client";

import { useMemo, useState } from "react";
import { DECISION_DEFINITIONS } from "@/lib/decision-engine/definitions";
import { QUESTION_SETS } from "@/lib/decision-engine/questions";
import { evaluate } from "@/lib/decision-engine/evaluator";
import { nextQuestion, validateAnswer } from "@/lib/decision-engine/session";
import type { AnswerValue, DecisionAnswers } from "@/lib/decision-engine/types";

// Admin-only workflow path simulator. Runs the deterministic evaluator entirely
// in memory — NO database writes, no analytics, no session persistence. Lets a
// reviewer walk any tree (including unpublished ones) to check its paths before
// publishing.
export function WorkflowSimulator() {
  const slugs = Object.keys(DECISION_DEFINITIONS).sort();
  const [slug, setSlug] = useState(slugs[0] ?? "");
  const [answers, setAnswers] = useState<DecisionAnswers>({});
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const definition = DECISION_DEFINITIONS[slug];
  const questions = QUESTION_SETS[slug] ?? [];
  const current = useMemo(() => nextQuestion(questions, answers), [questions, answers]);
  const result = current ? null : definition ? evaluate(definition, answers) : null;

  function reset(nextSlug: string) {
    setSlug(nextSlug);
    setAnswers({});
    setDraft("");
    setError(null);
  }

  function record(id: string, value: AnswerValue) {
    const question = questions.find((q) => q.id === id);
    if (!question) return;
    const problem = validateAnswer(question, value);
    if (problem) {
      setError(problem);
      return;
    }
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setDraft("");
    setError(null);
  }

  return (
    <section className="content-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">Workflow simulator</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Walk any tree in memory — no data is written.
          </p>
        </div>
        <select
          value={slug}
          onChange={(event) => reset(event.target.value)}
          aria-label="Workflow to simulate"
          className="rounded-md border border-border bg-white px-3 py-1.5 text-sm font-semibold text-ink outline-none focus:border-sky"
        >
          {slugs.map((s) => (
            <option key={s} value={s}>
              {DECISION_DEFINITIONS[s].procedureTitle}
            </option>
          ))}
        </select>
      </div>

      {Object.keys(answers).length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {questions
            .filter((q) => q.id in answers)
            .map((q) => (
              <li
                key={q.id}
                className="rounded-sm border border-border bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-ink-muted"
              >
                {q.label.replace(/\?$/, "")}: <span className="font-semibold text-ink">{String(answers[q.id])}</span>
              </li>
            ))}
        </ul>
      )}

      {current ? (
        <div className="mt-4">
          <p className="font-display text-sm font-semibold text-ink">{current.label}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{current.reason}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {current.answerType === "yes_no" && (
              <>
                <SimBtn onClick={() => record(current.id, true)}>Yes</SimBtn>
                <SimBtn onClick={() => record(current.id, false)}>No</SimBtn>
              </>
            )}
            {current.answerType === "single_choice" &&
              (current.options ?? []).map((option) => (
                <SimBtn key={option} onClick={() => record(current.id, option)}>
                  {option}
                </SimBtn>
              ))}
            {current.answerType === "number" && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  record(current.id, Number(draft));
                }}
                className="flex gap-2"
              >
                <input
                  type="number"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  min={current.min}
                  max={current.max}
                  aria-label={current.label}
                  className="w-32 rounded-md border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-sky"
                />
                <SimBtn type="submit">Continue</SimBtn>
              </form>
            )}
          </div>
          {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
        </div>
      ) : result ? (
        <div className="mt-4 rounded-md border border-border bg-slate-50 p-3">
          <p className="font-display text-sm font-bold text-ink">
            {result.outcome}{" "}
            <span className="ml-1 rounded-sm border border-border bg-white px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">
              {result.confidence}
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-muted">{result.explanation}</p>
          <p className="mt-1.5 text-[11px] text-ink-faint">
            Rule {result.matchedRuleId ?? "—"} · Page {(result.rulePages ?? definition?.sourcePages ?? []).join(", ")}
          </p>
          <button
            type="button"
            onClick={() => reset(slug)}
            className="mt-2 rounded border border-border bg-white px-3 py-1 text-xs font-semibold text-ink-muted hover:border-accent hover:text-accent"
          >
            Restart
          </button>
        </div>
      ) : null}
    </section>
  );
}

function SimBtn({
  children,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="press rounded-md border border-border bg-white px-3.5 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-sky hover:text-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-1"
    >
      {children}
    </button>
  );
}
