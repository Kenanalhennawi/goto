import { SiteHeader } from "@/components/SiteHeader";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { canReviewProcedures } from "@/lib/permissions";
import { DECISION_DEFINITIONS } from "@/lib/decision-engine/definitions";
import { getWorkflowAvailability } from "@/lib/decision-engine/availability";
import { validateAllTrees, treeErrors } from "@/lib/decision-engine/validate-trees";
import { categoryForWorkflow } from "@/lib/decision-engine/categories";
import { WorkflowSimulator } from "@/components/WorkflowSimulator";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Workflow QA | GO TO Admin" };

type CardRow = {
  slug: string;
  review_status: string;
  is_published: boolean;
  source_version: string | null;
  last_reviewed_at: string | null;
  chapters: { slug: string; source_version: string | null; updated_at: string | null } | null;
};

type QaStatus = "Published" | "Needs Review" | "Outdated" | "Missing Source" | "Broken";

// Read-only workflow QA dashboard + in-memory path simulator. Reuses the
// availability helper and the structural validator; writes nothing.
export default async function AdminWorkflowsPage() {
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

  const slugs = Object.keys(DECISION_DEFINITIONS);
  const { data } = await supabase
    .from("procedure_cards")
    .select(
      "slug, review_status, is_published, source_version, last_reviewed_at, chapters(slug, source_version, updated_at)"
    )
    .in("slug", slugs);
  const cards = new Map((((data ?? []) as unknown) as CardRow[]).map((c) => [c.slug, c]));

  const issues = validateAllTrees(DECISION_DEFINITIONS);
  const errorsBySlug = new Set(treeErrors(issues).map((i) => i.slug));

  const rows = Object.values(DECISION_DEFINITIONS)
    .map((definition) => {
      const slug = definition.procedureSlug;
      const card = cards.get(slug) ?? null;
      const availability = getWorkflowAvailability({
        slug,
        is_published: card?.is_published,
        review_status: card?.review_status,
        source_version: card?.source_version ?? null,
        last_reviewed_at: card?.last_reviewed_at,
        chapters: card?.chapters ?? null,
      });
      let status: QaStatus;
      if (errorsBySlug.has(slug)) status = "Broken";
      else if (!card || !card.chapters) status = "Missing Source";
      else if (availability.status === "available") status = "Published";
      else if (
        availability.status === "unavailable_source_mismatch" ||
        availability.status === "unavailable_source_stale"
      )
        status = "Outdated";
      else status = "Needs Review";
      return {
        slug,
        title: definition.procedureTitle,
        category: categoryForWorkflow(slug),
        version: definition.sourceVersion,
        pages: definition.sourcePages.join(", "),
        cardVersion: card?.source_version ?? "—",
        status,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  const warningIssues = issues.filter((i) => i.level === "warning");

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <Link href="/admin" className="mb-6 inline-flex text-xs font-semibold text-ink-muted hover:text-accent">
          &larr; Back to dashboard
        </Link>
        <h1 className="font-display text-2xl font-semibold text-ink">Decision workflow QA</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {rows.length} deterministic workflows · {treeErrors(issues).length} structural error(s) ·{" "}
          {warningIssues.length} warning(s). Read-only.
        </p>

        <div className="mt-6 overflow-hidden rounded-lg border border-border bg-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-ink-faint">
                <th className="px-4 py-2.5">Workflow</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Tree ver</th>
                <th className="px-4 py-2.5">Card ver</th>
                <th className="px-4 py-2.5">Pages</th>
                <th className="px-4 py-2.5">QA status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.slug} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-ink">{row.title}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{row.category}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-ink-muted">{row.version}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-ink-muted">{row.cardVersion}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-ink-muted">{row.pages}</td>
                  <td className="px-4 py-2.5">
                    <QaBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {issues.length > 0 && (
          <details className="mt-4 rounded-lg border border-border bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">
              Validator issues ({issues.length})
            </summary>
            <ul className="border-t border-border px-4 py-3 text-xs">
              {issues.map((issue, index) => (
                <li key={`${issue.slug}-${index}`} className="py-0.5">
                  <span className={issue.level === "error" ? "font-bold text-red-600" : "text-warn"}>
                    [{issue.level}]
                  </span>{" "}
                  <span className="font-mono">{issue.slug}</span>: {issue.message}
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="mt-8">
          <WorkflowSimulator />
        </div>
      </main>
    </div>
  );
}

function QaBadge({ status }: { status: QaStatus }) {
  const styles: Record<QaStatus, string> = {
    Published: "bg-good/10 text-good border-good/20",
    "Needs Review": "bg-warn/10 text-warn border-warn/20",
    Outdated: "bg-amber-100 text-amber-800 border-amber-200",
    "Missing Source": "bg-ink-faint/10 text-ink-faint border-ink-faint/20",
    Broken: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}
