"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { routeIntent } from "@/lib/decision-engine/router";
import { QUESTION_SETS } from "@/lib/decision-engine/questions";
import { getWorkflowAvailability } from "@/lib/decision-engine/availability";
import { QuestionFlow } from "@/components/decision/QuestionFlow";
import type { RoutableCard } from "@/lib/decision-engine/types";

// Phase A intake: routes an operational question to verified procedures.
// Runs fully client-side over already-public card data; nothing typed
// here is stored or sent anywhere.
export function DecisionIntake({
  cards,
  initialProcedureSlug = null,
}: {
  cards: RoutableCard[];
  initialProcedureSlug?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [activeFlow, setActiveFlow] = useState<{
    slug: string;
    title: string;
    sourceVersion: string | null;
  } | null>(null);
  // A direct /decision?procedure=... link preselects a workflow. The user must
  // still click to start; questions never auto-run. Dismissing returns to the
  // general scenario search.
  const [showPreselect, setShowPreselect] = useState(Boolean(initialProcedureSlug));

  const preselectCard = useMemo(
    () =>
      initialProcedureSlug
        ? cards.find((card) => card.slug === initialProcedureSlug) ?? null
        : null,
    [cards, initialProcedureSlug]
  );

  const result = useMemo(
    () => (submitted.trim().length >= 3 ? routeIntent(submitted, cards) : null),
    [submitted, cards]
  );

  if (showPreselect && initialProcedureSlug) {
    return (
      <PreselectedWorkflow
        slug={initialProcedureSlug}
        card={preselectCard}
        onBack={() => setShowPreselect(false)}
      />
    );
  }

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(query);
        }}
        className="content-card border-t-2 border-t-navy p-5"
      >
        <label htmlFor="decision-question" className="block font-display text-lg font-semibold text-ink">
          What is the operational situation?
        </label>
        <p className="mt-1 text-sm text-ink-muted">
          Describe the case in operational terms, e.g. &ldquo;passenger cannot walk&rdquo; or
          &ldquo;customer missed flight after online check-in&rdquo;.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            id="decision-question"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="passenger is pregnant and wants to change the flight..."
            className="min-w-0 flex-1 rounded-md border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-sky"
          />
          <button
            type="submit"
            className="press rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent"
          >
            Route
          </button>
        </div>
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-soft px-3 py-2 text-xs font-medium text-warn">
          Do not enter personal passenger information. Use operational facts only — no names,
          PNRs, passport numbers, phone numbers, or documents.
        </p>
      </form>

      {result && (
        <section className="reveal mt-5 space-y-4" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-sm border px-2 py-0.5 text-[11px] font-bold ${
                result.confidence === "High confidence"
                  ? "border-good/30 bg-mint-soft text-good"
                  : result.confidence === "Possible workflows"
                    ? "border-blue-200 bg-sky-soft text-sky"
                    : "border-amber-200 bg-amber-soft text-warn"
              }`}
            >
              {result.confidence}
            </span>
            {result.matchedConcepts.map((concept) => (
              <span
                key={`${concept.intent}-${concept.phrase}`}
                className="rounded-sm border border-border bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-muted"
              >
                {concept.intent}: &ldquo;{concept.phrase}&rdquo;
              </span>
            ))}
          </div>

          {result.needsClarification && (
            <p className="rounded-md border border-blue-200 bg-sky-soft px-4 py-2.5 text-sm font-semibold text-sky">
              More than one workflow may apply. Review the matched procedures below and pick the
              one that fits the case.
            </p>
          )}

          {!result.primary ? (
            <div className="content-card p-5">
              <p className="text-sm font-bold text-ink">Insufficient verified guidance</p>
              <p className="mt-1 text-sm text-ink-muted">
                No approved operational card matches this question yet. Try different operational
                wording, search the guide directly, or check the source chapters.
              </p>
              <Link
                href={`/search?q=${encodeURIComponent(submitted)}`}
                className="mt-3 inline-flex rounded bg-navy px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent"
              >
                Search the guide
              </Link>
            </div>
          ) : (
            <>
              <ProcedureMatch
                card={result.primary}
                primary
                onStartFlow={
                  QUESTION_SETS[result.primary.slug]
                    ? () =>
                        setActiveFlow({
                          slug: result.primary!.slug,
                          title: result.primary!.title,
                          sourceVersion: result.primary!.source_version ?? null,
                        })
                    : undefined
                }
              />
              {activeFlow && QUESTION_SETS[activeFlow.slug] && (
                <QuestionFlow
                  key={activeFlow.slug}
                  procedureSlug={activeFlow.slug}
                  procedureTitle={activeFlow.title}
                  questions={QUESTION_SETS[activeFlow.slug]}
                  cardSourceVersion={activeFlow.sourceVersion}
                  onClose={() => setActiveFlow(null)}
                />
              )}
              {result.related.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {result.related.map((card) => (
                    <ProcedureMatch key={card.id} card={card} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

function ProcedureMatch({
  card,
  primary = false,
  onStartFlow,
}: {
  card: RoutableCard & { viaIntent: boolean };
  primary?: boolean;
  onStartFlow?: () => void;
}) {
  return (
    <article
      className={`content-card hover-lift p-4 ${primary ? "border-t-2 border-t-accent" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {primary && (
          <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Primary match
          </span>
        )}
        {card.service_code && (
          <span className="rounded-sm border border-orange-200 bg-orange-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent">
            {card.service_code}
          </span>
        )}
        <span className="rounded-sm border border-blue-200 bg-sky-soft px-1.5 py-0.5 text-[10px] font-semibold text-sky">
          {card.service_type || card.category}
        </span>
        {card.viaIntent && (
          <span className="rounded-sm border border-border bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
            Intent match
          </span>
        )}
      </div>
      <h2 className={`mt-2 font-display font-semibold leading-snug text-ink ${primary ? "text-lg" : "text-sm"}`}>
        {card.title}
      </h2>
      {primary && card.summary && (
        <p className="mt-1.5 text-sm leading-6 text-ink-muted">{card.summary}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          href={`/procedure/${card.slug}`}
          className="press inline-flex rounded bg-navy px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent"
        >
          Open procedure
        </Link>
        {onStartFlow ? (
          <button
            type="button"
            onClick={onStartFlow}
            className="press inline-flex rounded border border-sky bg-sky-soft px-3.5 py-1.5 text-xs font-semibold text-sky transition-colors hover:bg-white"
          >
            Start guided decision
          </button>
        ) : (
          <span className="rounded border border-dashed border-border px-2.5 py-1 text-[11px] font-medium text-ink-faint">
            Guided decision coming soon
          </span>
        )}
      </div>
    </article>
  );
}

// Direct-entry panel for /decision?procedure=<slug>. Preselects the workflow,
// shows its verified source state, and lets the agent start it (never auto-run)
// or return to general scenario search. Unsupported or unavailable slugs fall
// back to a safe message without crashing.
function PreselectedWorkflow({
  slug,
  card,
  onBack,
}: {
  slug: string;
  card: RoutableCard | null;
  onBack: () => void;
}) {
  const [started, setStarted] = useState(false);
  const hasQuestions = Boolean(QUESTION_SETS[slug]);
  const availability = card
    ? getWorkflowAvailability({
        slug,
        is_published: true,
        review_status: "approved",
        source_version: card.source_version ?? null,
      })
    : getWorkflowAvailability({ slug });
  const title = card?.title ?? slug;
  const canStart = availability.available && hasQuestions;

  return (
    <div className="space-y-4">
      <section className="content-card border-t-2 border-t-navy p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              Guided decision
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold text-ink">{title}</h2>
            {canStart ? (
              <p className="mt-1 text-xs font-medium text-ink-muted">
                Verified source: GO TO v{card?.source_version} — answer the questions to reach the outcome.
              </p>
            ) : (
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                {availability.hasTree
                  ? availability.safeMessage
                  : "This procedure does not have a guided decision. Use the operational card or look up a scenario."}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onBack}
            className="press inline-flex shrink-0 items-center rounded border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          >
            Look up a different scenario
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {canStart && !started && (
            <button
              type="button"
              onClick={() => setStarted(true)}
              className="press inline-flex items-center rounded-md bg-sky px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2"
            >
              Start guided decision
            </button>
          )}
          {card && (
            <Link
              href={`/procedure/${slug}`}
              className="inline-flex items-center rounded border border-border bg-white px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
            >
              Open procedure card
            </Link>
          )}
        </div>
      </section>

      {canStart && started && (
        <QuestionFlow
          key={slug}
          procedureSlug={slug}
          procedureTitle={title}
          questions={QUESTION_SETS[slug]}
          cardSourceVersion={card?.source_version ?? null}
          onClose={() => setStarted(false)}
        />
      )}
    </div>
  );
}
