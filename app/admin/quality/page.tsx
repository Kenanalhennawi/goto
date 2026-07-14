import { SiteHeader } from "@/components/SiteHeader";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { canReviewProcedures } from "@/lib/permissions";
import {
  hasGenericFiller,
  listQualityBadges,
  sourceReviewStatus,
  type AdminQualityBaseProcedure,
} from "@/lib/admin-procedure-quality";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Content quality | GO TO Admin",
};

type QualityRow = AdminQualityBaseProcedure & {
  id: string;
  title: string;
  slug: string;
  review_status: string;
  is_published: boolean;
  updated_at: string;
};

// Read-only content-health dashboard. All quality logic reuses
// lib/admin-procedure-quality; no review metadata is written here.
export default async function AdminQualityPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!canReviewProcedures(role?.role)) redirect("/admin");

  const { data } = await supabase
    .from("procedure_cards")
    .select(
      "id, title, slug, category, service_code, service_type, summary, when_to_use, cut_off_time, required_information, system_steps, passenger_advice, allowed, not_allowed, escalation_points, fees_charges, source_confidence, source_version, last_reviewed_at, review_status, is_published, updated_at, chapters(chapter_number, title, slug, source_version, updated_at)"
    )
    .neq("review_status", "archived")
    .order("updated_at", { ascending: false });

  const rows = (data ?? []) as unknown as QualityRow[];

  const published = rows.filter((row) => row.is_published && row.review_status === "approved");
  const needsReview = rows.filter(
    (row) => row.review_status === "needs_review" || row.review_status === "draft"
  );
  const withFiller = rows.filter((row) => hasGenericFiller(row));
  const stale = rows.filter((row) => {
    const status = sourceReviewStatus(row);
    return status !== "Current" && status !== "No linked source chapter";
  });
  const health = rows.length === 0 ? 0 : Math.round((published.length / rows.length) * 100);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
        <Link
          href="/admin"
          className="mb-4 inline-flex text-xs font-semibold text-ink-muted transition-colors hover:text-accent"
        >
          &larr; Back to dashboard
        </Link>

        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            Content quality
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
            Operational content health
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">
            Live view of card readiness, review backlog, source freshness, and filler detection.
          </p>
        </div>

        <div className="reveal-stagger mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric label="Total cards" value={String(rows.length)} tone="plain" />
          <Metric label="Published" value={String(published.length)} tone="good" />
          <Metric label="Review queue" value={String(needsReview.length)} tone="sky" />
          <Metric label="Source stale" value={String(stale.length)} tone="warn" />
          <Metric label="Live coverage" value={`${health}%`} tone={health >= 60 ? "good" : "warn"} />
        </div>

        {withFiller.length > 0 && (
          <div className="mb-6 rounded-lg border border-red-200 border-l-4 border-l-red-500 bg-red-50 px-4 py-3">
            <p className="text-sm font-bold text-red-700">
              {withFiller.length} card{withFiller.length === 1 ? "" : "s"} contain generic filler
            </p>
            <p className="mt-0.5 text-xs text-red-700/80">
              Filler is a blocking issue: these cards must not be approved until the placeholder
              language is replaced with source-backed content.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {withFiller.slice(0, 8).map((row) => (
                <Link
                  key={row.id}
                  href={`/admin/procedures/${row.slug}`}
                  className="rounded border border-red-200 bg-white px-2 py-0.5 text-xs font-semibold text-red-700 transition-colors hover:border-red-400"
                >
                  {row.title}
                </Link>
              ))}
            </div>
          </div>
        )}

        <section className="content-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <h2 className="font-display text-base font-semibold text-ink">Review queue</h2>
            <Link
              href="/admin/procedures"
              className="text-xs font-semibold text-sky transition-colors hover:text-accent"
            >
              Open procedures workspace &rarr;
            </Link>
          </div>
          {needsReview.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">
              Review queue is clear. Draft new cards from source chapters to keep coverage growing.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {needsReview.map((row) => {
                const badges = listQualityBadges(row).filter((badge) => badge !== "Draft");
                const freshness = sourceReviewStatus(row);
                return (
                  <li key={row.id}>
                    <Link
                      href={`/admin/procedures/${row.slug}`}
                      className="flex flex-col gap-1.5 px-5 py-3 transition-colors hover:bg-panel-hover"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        {row.service_code && (
                          <span className="rounded-sm border border-orange-200 bg-orange-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent">
                            {row.service_code}
                          </span>
                        )}
                        <span className="text-sm font-semibold text-ink">{row.title}</span>
                        <span className="text-[11px] font-medium text-ink-faint">
                          {row.service_type || row.category}
                        </span>
                        <span className="ml-auto text-[11px] font-medium text-ink-faint">
                          {freshness}
                        </span>
                      </span>
                      {badges.length > 0 && (
                        <span className="flex flex-wrap gap-1">
                          {badges.map((badge) => (
                            <span
                              key={badge}
                              className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${
                                badge === "Generic filler"
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : badge.startsWith("Missing")
                                    ? "border-amber-200 bg-amber-soft text-warn"
                                    : "border-border bg-slate-50 text-ink-muted"
                              }`}
                            >
                              {badge}
                            </span>
                          ))}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "plain" | "good" | "sky" | "warn";
}) {
  const tones = {
    plain: "text-ink",
    good: "text-good",
    sky: "text-sky",
    warn: "text-warn",
  };
  return (
    <div className="stat-card rounded-lg border border-border bg-white px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${tones[tone]}`}>{value}</p>
    </div>
  );
}
