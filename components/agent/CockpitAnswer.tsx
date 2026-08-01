"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { deriveOperationalAnswer } from "@/lib/operational-answer";
import { getWorkflowAvailability } from "@/lib/decision-engine/availability";
import type { JsonValue } from "@/lib/types";
import type { CockpitSearchResult } from "./CockpitSearch";

// In-place best operational answer (OPS-1). Loaded dynamically so the
// availability layer (which imports the decision registry) stays out of the
// initial homepage bundle. Reuses deriveOperationalAnswer — no second
// derivation layer — and getWorkflowAvailability gates the guided action.
// Never shows review status, source version, scores, slugs, or raw JSON.

export function CockpitAnswer({
  result,
  guidedActive,
  onStartGuided,
  onSearchAnother,
}: {
  result: CockpitSearchResult;
  /** True while the guided flow is mounted below the answer. */
  guidedActive: boolean;
  onStartGuided: () => void;
  onSearchAnother: () => void;
}) {
  const answer = useMemo(
    () =>
      deriveOperationalAnswer({
        title: result.title,
        summary: result.summary,
        when_to_use: result.when_to_use,
        cut_off_time: result.cut_off_time,
        who_can_action: result.who_can_action as JsonValue[],
        required_information: result.required_information as JsonValue[],
        system_steps: result.system_steps as JsonValue[],
        passenger_advice: result.passenger_advice as JsonValue[],
        allowed: result.allowed as JsonValue[],
        not_allowed: result.not_allowed as JsonValue[],
        escalation_points: result.escalation_points as JsonValue[],
        fees_charges: result.fees_charges,
      }),
    [result]
  );

  // Cards from /api/search are always published+approved (the API filter).
  const availability = useMemo(
    () =>
      getWorkflowAvailability({
        slug: result.slug,
        is_published: true,
        review_status: "approved",
        source_version: result.source_version,
      }),
    [result.slug, result.source_version]
  );

  // Focus the answer heading when a new answer resolves, so keyboard and
  // screen-reader users land on the result (mirrors QuestionFlow's pattern).
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => headingRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [result.slug]);

  const escalationPreview = answer.escalation[0] ?? null;
  const advicePreview = answer.passengerAdvice[0] ?? null;

  return (
    <section className="agent-hero mt-5 p-5 sm:p-6" aria-label="Best operational answer">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky">
        Best operational answer
      </p>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mt-1 font-display text-xl font-semibold leading-snug text-ink focus-visible:outline-none sm:text-2xl"
      >
        {answer.title}
      </h2>
      {answer.summary ? (
        <p className="mt-1.5 text-sm leading-6 text-ink-muted">{answer.summary}</p>
      ) : null}

      <dl className="mt-4 space-y-3">
        <Row label="Can we action?" value={answer.canAction} strong />
        {answer.deadline ? <Row label="Deadline" value={answer.deadline} /> : null}
        {answer.handler ? <Row label="Who handles it?" value={answer.handler} /> : null}
        {answer.primaryAction ? <Row label="Agent action" value={answer.primaryAction} /> : null}
        {answer.criticalBlocker ? (
          <Row label="Do not proceed when" value={answer.criticalBlocker} tone="warn" />
        ) : null}
        {escalationPreview ? <Row label="Escalate when" value={escalationPreview} tone="warn" /> : null}
        {advicePreview ? <Row label="Tell the passenger" value={advicePreview} /> : null}
      </dl>

      {availability.available && !guidedActive ? (
        <div className="mt-5 rounded-xl border border-border bg-white p-4">
          <p className="text-sm font-semibold text-ink">Need more certainty?</p>
          <p className="mt-0.5 text-sm leading-6 text-ink-muted">Answer a few guided questions.</p>
          <button
            type="button"
            onClick={onStartGuided}
            className="agent-primary touch-target mt-3 inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold focus-visible:outline-none"
          >
            Start guided questions
          </button>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2.5">
        <Link
          href={`/procedure/${result.slug}`}
          className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
        >
          Open full procedure
        </Link>
        {result.chapterSlug ? (
          <Link
            href={`/chapter/${encodeURIComponent(result.chapterSlug)}`}
            className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
          >
            View source
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onSearchAnother}
          className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
        >
          Search another issue
        </button>
      </div>
      {!result.chapterSlug ? (
        <p className="mt-2.5 text-xs font-medium text-ink-faint">Source reference is not linked yet.</p>
      ) : null}
    </section>
  );
}

function Row({
  label,
  value,
  strong = false,
  tone = "default",
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "default" | "warn";
}) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[168px_1fr] sm:gap-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint sm:pt-0.5">{label}</dt>
      <dd
        className={`text-sm leading-6 ${tone === "warn" ? "font-semibold text-warn" : strong ? "font-semibold text-ink" : "text-ink"}`}
      >
        {value}
      </dd>
    </div>
  );
}

export default CockpitAnswer;
