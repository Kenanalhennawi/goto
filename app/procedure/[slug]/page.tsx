import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { AgentPage } from "@/components/agent/AgentPage";
import { ProcedureQuickAnswer } from "@/components/agent/ProcedureQuickAnswer";
import { FullOperationalDetails } from "@/components/agent/FullOperationalDetails";
import { CopySummaryButton } from "@/components/agent/CopySummaryButton";
import { FavoriteButton } from "@/components/FavoriteButton";
import { RecentTracker } from "@/components/RecentTracker";
import { CopyTextButton } from "@/components/CopyTextButton";
import { getProcedureBySlug, type ProcedureCardWithChapter } from "@/lib/procedures";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getWorkflowAvailability } from "@/lib/decision-engine/availability";
import { deriveOperationalAnswer } from "@/lib/operational-answer";
import { sourceReviewWarnings } from "@/lib/admin-procedure-quality";
import { groupForCard } from "@/lib/work-areas";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { procedure } = await getProcedureBySlug(slug);
  if (!procedure) return { title: "Procedure not found | GO TO" };
  return {
    title: `${procedure.title} | GO TO`,
    description: procedure.summary || procedure.category,
  };
}

export default async function ProcedurePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { procedure, canManage } = await getProcedureBySlug(slug);

  if (!procedure) return <NotFoundState />;

  const answer = deriveOperationalAnswer(procedure);
  const availability = getWorkflowAvailability({
    slug: procedure.slug,
    is_published: procedure.is_published,
    review_status: procedure.review_status,
    source_version: procedure.source_version,
    last_reviewed_at: procedure.last_reviewed_at,
    chapters: procedure.chapters,
  });
  const summaryText = buildSummaryText(procedure, answer);
  const related = await fetchRelatedProcedures(procedure);
  const scripts = [
    procedure.customer_script?.trim() ? { label: "Customer script", text: procedure.customer_script.trim() } : null,
    procedure.sprint_comment_template?.trim()
      ? { label: "SPRINT comment template", text: procedure.sprint_comment_template.trim() }
      : null,
  ].filter(Boolean) as { label: string; text: string }[];

  return (
    <div className="dashboard-shell flex min-h-full flex-col">
      <SiteHeader />
      <RecentTracker kind="procedure" slug={procedure.slug} title={procedure.title} code={procedure.service_code} />

      <AgentPage>
        {/* A. Simple header */}
        <Link
          href="/search"
          className="agent-secondary touch-target inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold focus-visible:outline-none"
        >
          &larr; Back to search
        </Link>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {procedure.category ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                {procedure.category}
              </p>
            ) : null}
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {procedure.title}
            </h1>
            {answer.summary ? (
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-muted">{answer.summary}</p>
            ) : null}
          </div>
          <FavoriteButton
            kind="procedure"
            slug={procedure.slug}
            title={procedure.title}
            code={procedure.service_code}
          />
        </div>

        {/* C. Primary actions */}
        <div className="mt-4 flex flex-wrap gap-2.5">
          {availability.available ? (
            <Link
              href={availability.href}
              className="agent-primary touch-target inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold focus-visible:outline-none"
            >
              Start guided questions
            </Link>
          ) : null}
          <CopySummaryButton text={summaryText} />
          <Link
            href="/"
            className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
          >
            Search another scenario
          </Link>
        </div>
        {!availability.available && availability.hasTree ? (
          <p className="mt-2 text-xs font-medium text-ink-faint">
            Guided questions are not currently available.
          </p>
        ) : null}

        {/* B. Quick operational answer */}
        <div className="mt-5">
          <ProcedureQuickAnswer answer={answer} requiredApproval={procedure.required_approval} />
        </div>

        {/* D. Full operational details */}
        <FullOperationalDetails answer={answer} />

        {/* Scripts & templates — preserved tool, collapsed, only when present */}
        {scripts.length > 0 && (
          <details className="agent-disclosure mt-8">
            <summary className="touch-target flex cursor-pointer list-none items-center gap-2 font-display text-base font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky">
              <span className="disclosure-chevron text-sky" aria-hidden="true">
                ▸
              </span>
              Scripts &amp; templates
            </summary>
            <div className="mt-3 space-y-4">
              {scripts.map((script) => (
                <section key={script.label}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-sm font-semibold text-ink">{script.label}</h3>
                    <CopyTextButton text={script.text} />
                  </div>
                  <p className="mt-2 whitespace-pre-line rounded-lg border border-border bg-white p-3.5 text-sm leading-6 text-ink">
                    {script.text}
                  </p>
                </section>
              ))}
            </div>
          </details>
        )}

        {/* E. Related guidance */}
        {related.length > 0 && (
          <section className="mt-8" aria-label="Related guidance">
            <h2 className="font-display text-base font-semibold text-ink">Related guidance</h2>
            <div className="mt-3 space-y-2.5">
              {related.map((card) => (
                <Link
                  key={card.slug}
                  href={`/procedure/${card.slug}`}
                  className="agent-tile touch-target flex items-center justify-between gap-3 px-4 py-3 focus-visible:outline-none"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-ink">{card.title}</span>
                    {card.summary ? (
                      <span className="mt-0.5 block truncate text-xs text-ink-muted">{card.summary}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-sky">Open procedure</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* F. Source & reference — collapsed, last (for agents) */}
        <SourceReference procedure={procedure} />

        {/* G. Review details — role-gated */}
        {canManage ? <ReviewDetails procedure={procedure} /> : null}
      </AgentPage>
    </div>
  );
}

function buildSummaryText(
  procedure: ProcedureCardWithChapter,
  answer: ReturnType<typeof deriveOperationalAnswer>
): string {
  const lines: string[] = [procedure.title, "", `Can we action? ${answer.canAction}`];
  if (answer.deadline) lines.push(`Deadline: ${answer.deadline}`);
  if (answer.handler) lines.push(`Who handles it? ${answer.handler}`);
  if (answer.primaryAction) lines.push(`Agent action: ${answer.primaryAction}`);
  if (answer.criticalBlocker) lines.push(`Do not proceed when: ${answer.criticalBlocker}`);
  if (answer.escalation[0]) lines.push(`Escalate when: ${answer.escalation[0]}`);
  return lines.join("\n");
}

type RelatedProcedure = { title: string; slug: string; summary: string | null };

async function fetchRelatedProcedures(procedure: ProcedureCardWithChapter): Promise<RelatedProcedure[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("procedure_cards")
    .select("title, slug, summary, category, service_code, service_type")
    .eq("is_published", true)
    .eq("review_status", "approved")
    .neq("slug", procedure.slug)
    .order("priority", { ascending: false })
    .limit(60);

  const area = groupForCard(procedure);
  return ((data ?? []) as (RelatedProcedure & { category: string; service_code: string | null; service_type: string | null })[])
    .filter((card) => groupForCard(card) === area)
    .slice(0, 3)
    .map((card) => ({ title: card.title, slug: card.slug, summary: card.summary }));
}

function SourceReference({ procedure }: { procedure: ProcedureCardWithChapter }) {
  const pages = formatSourcePages(procedure.source_pages);
  const reviewed = safeDate(procedure.last_reviewed_at);
  const confidence = procedure.source_confidence?.replace(/_/g, " ") ?? null;

  return (
    <details className="agent-disclosure mt-8">
      <summary className="touch-target flex cursor-pointer list-none items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky">
        <span className="disclosure-chevron text-sky" aria-hidden="true">
          ▸
        </span>
        <span>
          <span className="block font-display text-base font-semibold text-ink">Source &amp; reference</span>
          <span className="mt-0.5 block text-xs text-ink-muted">
            The source pages this guidance is based on.
          </span>
        </span>
      </summary>
      <div className="mt-3 rounded-xl border border-border bg-white p-4">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {procedure.chapters ? (
            <Fact
              label="Source chapter"
              value={`Chapter ${String(procedure.chapters.chapter_number).padStart(2, "0")} — ${procedure.chapters.title}`}
            />
          ) : null}
          {pages ? <Fact label="Pages" value={pages} /> : null}
          {procedure.source_version ? <Fact label="Source version" value={procedure.source_version} /> : null}
          {reviewed ? <Fact label="Last reviewed" value={reviewed} /> : null}
          {confidence ? <Fact label="Source confidence" value={confidence} /> : null}
        </dl>
        {procedure.chapters ? (
          <Link
            href={`/chapter/${procedure.chapters.slug}`}
            className="agent-secondary touch-target mt-3 inline-flex items-center rounded-lg px-3.5 py-2 text-xs font-semibold focus-visible:outline-none"
          >
            Open source chapter
          </Link>
        ) : (
          <p className="mt-3 text-xs font-medium text-ink-faint">Source reference is not linked yet.</p>
        )}
      </div>
    </details>
  );
}

function ReviewDetails({ procedure }: { procedure: ProcedureCardWithChapter }) {
  const warnings = sourceReviewWarnings({
    source_version: procedure.source_version,
    last_reviewed_at: procedure.last_reviewed_at,
    chapters: procedure.chapters,
  });
  const reviewed = safeDate(procedure.last_reviewed_at);

  return (
    <details className="mt-6 rounded-xl border border-dashed border-border bg-white/70">
      <summary className="touch-target flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Review details (reviewers only)
        </span>
        <span className="rounded border border-border bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
          {procedure.is_published ? "Published" : "Unpublished"} · {procedure.review_status.replace(/_/g, " ")}
        </span>
      </summary>
      <div className="border-t border-border px-4 py-3">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Fact label="Review status" value={procedure.review_status.replace(/_/g, " ")} />
          <Fact label="Published" value={procedure.is_published ? "Yes" : "No"} />
          {procedure.source_confidence ? (
            <Fact label="Source confidence" value={procedure.source_confidence.replace(/_/g, " ")} />
          ) : null}
          {procedure.source_version ? <Fact label="Card source version" value={procedure.source_version} /> : null}
          {procedure.chapters?.source_version ? (
            <Fact label="Chapter source version" value={procedure.chapters.source_version} />
          ) : null}
          {reviewed ? <Fact label="Last reviewed" value={reviewed} /> : null}
        </dl>
        {warnings.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {warnings.map((w) => (
              <li key={w} className="text-xs font-semibold text-warn">
                {w}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/admin/procedures"
            className="agent-secondary touch-target inline-flex items-center rounded-lg px-3.5 py-2 text-xs font-semibold focus-visible:outline-none"
          >
            Manage in Admin
          </Link>
          <Link
            href="/admin/quality"
            className="agent-secondary touch-target inline-flex items-center rounded-lg px-3.5 py-2 text-xs font-semibold focus-visible:outline-none"
          >
            Review in Quality
          </Link>
        </div>
      </div>
    </details>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5 last:border-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="dashboard-shell flex min-h-full flex-col">
      <SiteHeader />
      <AgentPage>
        <div className="mt-8 rounded-2xl border border-border bg-white p-6 text-center">
          <h1 className="font-display text-xl font-semibold text-ink">We couldn&rsquo;t find this procedure</h1>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-ink-muted">
            It may have moved or is not currently available. Try searching for what the customer needs.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2.5">
            <Link
              href="/search"
              className="agent-primary touch-target inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold focus-visible:outline-none"
            >
              Search for another procedure
            </Link>
            <Link
              href="/services"
              className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
            >
              Browse services
            </Link>
            <Link
              href="/"
              className="agent-secondary touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </AgentPage>
    </div>
  );
}

function formatSourcePages(pages: number[] | null | undefined): string | null {
  if (!pages || pages.length === 0) return null;
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  if (sorted.length === 1) return `Page ${sorted[0]}`;
  const contiguous = sorted.every((p, i) => i === 0 || p === sorted[i - 1] + 1);
  return contiguous ? `Pages ${sorted[0]}–${sorted[sorted.length - 1]}` : `Pages ${sorted.join(", ")}`;
}

function safeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", year: "numeric" }).format(date);
}
