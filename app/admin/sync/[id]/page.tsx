import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SiteHeader } from "@/components/SiteHeader";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { SyncReviewClient } from "@/components/SyncReviewClient";
import { SyncRunSummary } from "@/components/admin/SyncRunSummary";
import { canAccessAdmin, canManageUsers } from "@/lib/permissions";
import type { ChangeClass } from "@/lib/sync-diff";

// UPD-2.1: the staged-run review screen now surfaces validation metadata, the
// diff classification counts, removed-chapter warnings and the impact report.
// Publishing still goes through the existing atomic publish RPC, unchanged.
export const dynamic = "force-dynamic";

export default async function SyncReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!canAccessAdmin(role?.role)) {
    redirect("/admin");
  }

  const { data: syncRun } = await supabase
    .from("sync_runs")
    .select(
      "id, source_filename, original_filename, source_version, status, state, progress_pct, progress_message, chapters_changed, chapters_added, pdf_version, pdf_version_date, pdf_page_count, pdf_sha256, extractor_version, error_code, error_detail, retry_of_run_id, created_at, completed_at, new_ratio, removed_ratio, ambiguous_count, reclass_override_reason"
    )
    .eq("id", id)
    .single();

  if (!syncRun) notFound();

  const { data: changes } = await supabase
    .from("sync_staged_changes")
    .select(
      "id, chapter_number, title, is_new_chapter, old_body_text, new_body_text, old_keywords, new_keywords, approved, change_class, identity_match_method, old_page_start, old_page_end, new_page_start, new_page_end, old_source_version, new_source_version, change_reasons"
    )
    .eq("sync_run_id", id)
    .order("chapter_number", { ascending: true });

  const { data: impact } = await supabase
    .from("sync_impact_report")
    .select("impact_type, entity_slug, entity_title, current_version, target_version, status, reason")
    .eq("run_id", id)
    .order("status", { ascending: true });

  const rows = changes ?? [];
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    const key = (row.change_class as ChangeClass | null) ?? "unclassified";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  // UPD-2.7: block publishing when identity matching produced a mass
  // reclassification, unless an owner recorded an audited override.
  const RECLASS_LIMIT = 0.2;
  const newRatio = Number(syncRun.new_ratio ?? 0);
  const removedRatio = Number(syncRun.removed_ratio ?? 0);
  const overridden = Boolean((syncRun.reclass_override_reason ?? "").trim());
  const reclassBlocked =
    !overridden && (newRatio > RECLASS_LIMIT || removedRatio > RECLASS_LIMIT);

  const canPublish = canManageUsers(role?.role) && !reclassBlocked;

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10">
        <Link
          href="/admin/sync"
          className="mb-6 inline-flex text-xs font-semibold text-ink-muted hover:text-accent"
        >
          &larr; Back to sync runs
        </Link>

        <SyncRunSummary
          run={syncRun}
          counts={counts}
          impact={impact ?? []}
          canRetry={canManageUsers(role?.role)}
          reclass={{
            newRatio,
            removedRatio,
            ambiguousCount: Number(syncRun.ambiguous_count ?? 0),
            blocked: reclassBlocked,
            overridden,
            limit: RECLASS_LIMIT,
          }}
        />

        <div className="mt-6">
          <SyncReviewClient
            syncRun={syncRun}
            changes={rows}
            canPublish={canPublish}
          />
        </div>
      </main>
    </div>
  );
}
