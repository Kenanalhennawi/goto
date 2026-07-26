"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { routeIntent } from "@/lib/decision-engine/router";
import { QUESTION_SETS } from "@/lib/decision-engine/questions";
import { getWorkflowAvailability } from "@/lib/decision-engine/availability";
import { DECISION_DEFINITIONS } from "@/lib/decision-engine/definitions";
import { WORKFLOW_CATEGORY_ORDER, categoryForWorkflow } from "@/lib/decision-engine/categories";
import { QuestionFlow } from "@/components/decision/QuestionFlow";
import type { RoutableCard } from "@/lib/decision-engine/types";

type ActiveFlow = {
  slug: string;
  title: string;
  sourceVersion: string | null;
  chapterSlug: string | null;
};

// Guided decision landing (UX-R1D). Describe a scenario → confirm the likely
// workflow → run the guided questions. Routing runs client-side over the same
// approved+published cards; no scoring change. Nothing auto-starts.
export function DecisionIntake({
  cards,
  initialProcedureSlug = null,
}: {
  cards: RoutableCard[];
  initialProcedureSlug?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [activeFlow, setActiveFlow] = useState<ActiveFlow | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [selectedSlug] = useState<string | null>(initialProcedureSlug);

  const result = useMemo(
    () => (submitted.trim().length >= 3 ? routeIntent(submitted, cards) : null),
    [submitted, cards]
  );

  function availabilityFor(slug: string) {
    const card = cards.find((c) => c.slug === slug);
    return getWorkflowAvailability({
      slug,
      is_published: Boolean(card),
      review_status: card ? "approved" : "needs_review",
      source_version: card?.source_version ?? null,
    });
  }

  function startFlow(card: RoutableCard) {
    setActiveFlow({
      slug: card.slug,
      title: card.title,
      sourceVersion: card.source_version ?? null,
      chapterSlug: card.chapters?.slug ?? null,
    });
  }

  // Direct /decision?procedure=<slug> preselect.
  if (selectedSlug) {
    return <PreselectedWorkflow slug={selectedSlug} card={cards.find((c) => c.slug === selectedSlug) ?? null} />;
  }

  const matches = result
    ? [result.primary, ...result.related].filter((c): c is NonNullable<typeof c> => Boolean(c))
    : [];
  const multiple = Boolean(result?.needsClarification) && matches.length > 1;

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky">Guided decision</p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        Describe the customer&rsquo;s request
      </h1>
      <p className="mt-1.5 max-w-xl text-sm leading-6 text-ink-muted">
        We&rsquo;ll guide you through the relevant operational questions.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(query);
          setActiveFlow(null);
        }}
        role="search"
        className="mt-4"
      >
        <label htmlFor="decision-scenario" className="sr-only">
          Describe the customer&rsquo;s request
        </label>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <input
            id="decision-scenario"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            placeholder="Passenger has a plaster cast and wants to travel"
            className="agent-search-input touch-target min-w-0 flex-1 px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint"
          />
          <button
            type="submit"
            className="agent-primary touch-target inline-flex items-center justify-center rounded-xl px-6 py-3 text-[15px] font-semibold focus-visible:outline-none"
          >
            Find guidance
          </button>
        </div>
      </form>
      <p className="mt-2 rounded-md border border-amber-200 bg-amber-soft px-3 py-2 text-xs font-medium text-warn">
        Use operational facts only — no names, PNRs, passport numbers, or documents.
      </p>

      {result ? (
        <div className="mt-6">
          {!result.primary ? (
            <NoMatch query={submitted} onBrowse={() => setBrowseOpen(true)} />
          ) : multiple ? (
            <section aria-label="Possible guided topics">
              <h2 className="font-display text-base font-semibold text-ink">Possible guided topics</h2>
              <p className="mt-1 text-sm text-ink-muted">Pick the one that fits the case.</p>
              <div className="mt-3 space-y-2.5">
                {matches.slice(0, 3).map((card) => (
                  <TopicOption
                    key={card.slug}
                    card={card}
                    available={availabilityFor(card.slug).available}
                    hasQuestions={Boolean(QUESTION_SETS[card.slug])}
                    onStart={() => startFlow(card)}
                  />
                ))}
              </div>
            </section>
          ) : (
            <MatchConfirmation
              card={result.primary}
              availability={availabilityFor(result.primary.slug)}
              hasQuestions={Boolean(QUESTION_SETS[result.primary.slug])}
              onStart={() => startFlow(result.primary!)}
              onSearchDifferent={() => {
                setSubmitted("");
                setQuery("");
              }}
            />
          )}
        </div>
      ) : null}

      {activeFlow && QUESTION_SETS[activeFlow.slug] ? (
        <QuestionFlow
          key={activeFlow.slug}
          procedureSlug={activeFlow.slug}
          procedureTitle={activeFlow.title}
          questions={QUESTION_SETS[activeFlow.slug]}
          cardSourceVersion={activeFlow.sourceVersion}
          cardChapterSlug={activeFlow.chapterSlug}
          onClose={() => setActiveFlow(null)}
        />
      ) : null}

      <BrowseTopics cards={cards} open={browseOpen} onToggle={() => setBrowseOpen((v) => !v)} onStart={startFlow} />
    </div>
  );
}

function MatchConfirmation({
  card,
  availability,
  hasQuestions,
  onStart,
  onSearchDifferent,
}: {
  card: RoutableCard;
  availability: ReturnType<typeof getWorkflowAvailability>;
  hasQuestions: boolean;
  onStart: () => void;
  onSearchDifferent: () => void;
}) {
  const canStart = availability.available && hasQuestions;
  return (
    <section className="agent-hero p-5 sm:p-6" aria-label="Suggested guided topic">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky">This looks like</p>
      <h2 className="mt-1 font-display text-xl font-semibold leading-snug text-ink sm:text-2xl">{card.title}</h2>
      {card.summary ? <p className="mt-1.5 text-sm leading-6 text-ink-muted">{card.summary}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2.5">
        {canStart ? (
          <button
            type="button"
            onClick={onStart}
            className="agent-primary touch-target inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold focus-visible:outline-none"
          >
            Start guided questions
          </button>
        ) : null}
        <button
          type="button"
          onClick={onSearchDifferent}
          className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
        >
          Search a different scenario
        </button>
        <Link
          href={`/procedure/${card.slug}`}
          className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
        >
          Open full procedure
        </Link>
      </div>
      {!canStart && availability.hasTree ? (
        <p className="mt-2.5 text-xs font-medium text-ink-faint">Guided questions are not currently available.</p>
      ) : null}
    </section>
  );
}

function TopicOption({
  card,
  available,
  hasQuestions,
  onStart,
}: {
  card: RoutableCard;
  available: boolean;
  hasQuestions: boolean;
  onStart: () => void;
}) {
  return (
    <article className="rounded-xl border border-border bg-white p-4">
      <h3 className="font-display text-[15px] font-semibold text-ink">{card.title}</h3>
      {card.summary ? <p className="mt-0.5 text-sm leading-6 text-ink-muted">{card.summary}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {available && hasQuestions ? (
          <button
            type="button"
            onClick={onStart}
            className="agent-primary touch-target inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold focus-visible:outline-none"
          >
            Start
          </button>
        ) : null}
        <Link
          href={`/procedure/${card.slug}`}
          className="agent-secondary touch-target inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-xs font-semibold focus-visible:outline-none"
        >
          Open procedure
        </Link>
      </div>
    </article>
  );
}

function NoMatch({ query, onBrowse }: { query: string; onBrowse: () => void }) {
  return (
    <section className="rounded-2xl border border-border bg-white p-6" aria-label="No guided workflow found">
      <h2 className="font-display text-lg font-semibold text-ink">
        We couldn&rsquo;t identify a guided workflow for this scenario
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-ink-muted">Try different wording, or search the procedures directly.</p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <Link
          href={`/search?q=${encodeURIComponent(query)}`}
          className="agent-primary touch-target inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold focus-visible:outline-none"
        >
          Search operational procedures
        </Link>
        <button
          type="button"
          onClick={onBrowse}
          className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
        >
          Browse guided topics
        </button>
      </div>
    </section>
  );
}

// Preselected workflow for /decision?procedure=<slug>. Never auto-starts.
function PreselectedWorkflow({ slug, card }: { slug: string; card: RoutableCard | null }) {
  const [started, setStarted] = useState(false);
  const hasQuestions = Boolean(QUESTION_SETS[slug]);
  const availability = card
    ? getWorkflowAvailability({ slug, is_published: true, review_status: "approved", source_version: card.source_version ?? null })
    : getWorkflowAvailability({ slug });
  const title = card?.title ?? slug;
  const canStart = availability.available && hasQuestions;

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky">Guided decision</p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
      <p className="mt-1.5 max-w-xl text-sm leading-6 text-ink-muted">
        {canStart
          ? "Verified operational questions based on the reviewed procedure."
          : "Guided questions are not currently available. Use the full procedure instead."}
      </p>

      <div className="mt-4 flex flex-wrap gap-2.5">
        {canStart && !started ? (
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="agent-primary touch-target inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold focus-visible:outline-none"
          >
            Start guided questions
          </button>
        ) : null}
        <Link
          href={`/procedure/${slug}`}
          className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
        >
          Open full procedure
        </Link>
        <Link
          href="/decision"
          className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
        >
          Look up a different scenario
        </Link>
      </div>

      {canStart && started ? (
        <QuestionFlow
          key={slug}
          procedureSlug={slug}
          procedureTitle={title}
          questions={QUESTION_SETS[slug]}
          cardSourceVersion={card?.source_version ?? null}
          cardChapterSlug={card?.chapters?.slug ?? null}
          onClose={() => setStarted(false)}
        />
      ) : null}
    </div>
  );
}

// Secondary "Browse guided topics" — grouped, collapsible, availability-gated.
function BrowseTopics({
  cards,
  open,
  onToggle,
  onStart,
}: {
  cards: RoutableCard[];
  open: boolean;
  onToggle: () => void;
  onStart: (card: RoutableCard) => void;
}) {
  const bySlug = useMemo(() => new Map(cards.map((c) => [c.slug, c])), [cards]);
  const available = useMemo(() => {
    return Object.values(DECISION_DEFINITIONS)
      .map((definition) => {
        const card = bySlug.get(definition.procedureSlug);
        const availability = getWorkflowAvailability({
          slug: definition.procedureSlug,
          is_published: Boolean(card),
          review_status: card ? "approved" : "needs_review",
          source_version: card?.source_version ?? null,
        });
        return {
          slug: definition.procedureSlug,
          title: definition.procedureTitle,
          summary: card?.summary ?? null,
          category: categoryForWorkflow(definition.procedureSlug),
          card,
          available: availability.available && Boolean(QUESTION_SETS[definition.procedureSlug]),
        };
      })
      .filter((w) => w.available);
  }, [bySlug]);

  return (
    <section className="mt-8" aria-label="Browse guided topics">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="agent-secondary touch-target inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
      >
        <span className="disclosure-chevron" aria-hidden="true" style={{ transform: open ? "rotate(90deg)" : undefined }}>
          ▸
        </span>
        Browse guided topics
      </button>

      {open ? (
        available.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No guided topics are available yet.</p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {WORKFLOW_CATEGORY_ORDER.map((category) => {
              const items = available.filter((w) => w.category === category);
              if (items.length === 0) return null;
              return (
                <details key={category} className="agent-disclosure rounded-xl border border-border bg-white p-4">
                  <summary className="touch-target flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky">
                    <span className="disclosure-chevron text-sky" aria-hidden="true">▸</span>
                    {category} ({items.length})
                  </summary>
                  <ul className="mt-3 space-y-2">
                    {items.map((w) => (
                      <li key={w.slug} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-semibold text-ink">{w.title}</span>
                          {w.summary ? (
                            <span className="mt-0.5 block truncate text-xs text-ink-muted">{w.summary}</span>
                          ) : null}
                        </span>
                        <button
                          type="button"
                          onClick={() => w.card && onStart(w.card)}
                          className="agent-primary touch-target inline-flex shrink-0 items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold focus-visible:outline-none"
                        >
                          Start
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        )
      ) : null}
    </section>
  );
}
