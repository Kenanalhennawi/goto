import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SiteHeader } from "@/components/SiteHeader";
import { DeleteButton } from "@/components/DeleteButton";
import { AdminActionButton } from "@/components/AdminActionButton";
import { redirect } from "next/navigation";
import Link from "next/link";
import { canAccessAdmin, canManageUsers, normalizeRoleLabel } from "@/lib/permissions";

export default async function AdminDashboard() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: role } = await supabase
    .from("user_roles")
    .select("role, full_name")
    .eq("user_id", user.id)
    .single();

  if (!canAccessAdmin(role?.role)) {
    return (
      <div className="flex flex-col flex-1">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-sm">
            <h1 className="font-display text-xl text-ink mb-2">No special access yet</h1>
            <p className="text-sm text-ink-muted">
              Your account is signed in but has not been assigned quality, admin, or owner
              access. Ask an admin or owner to update your access.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const activeRole = role!;

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, chapter_number, title, slug, updated_at")
    .order("chapter_number", { ascending: true });

  const { data: recentSyncs } = await supabase
    .from("sync_runs")
    .select("id, source_filename, source_version, status, chapters_changed, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  const { count: openIssueCount } = await supabase
    .from("content_issues")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "reviewing"]);

  const { count: syncRunCount } = await supabase
    .from("sync_runs")
    .select("id", { count: "exact", head: true });

  const { data: recentEdits } = await supabase
    .from("edit_history")
    .select("id, edited_by_email, change_type, created_at")
    .order("created_at", { ascending: false })
    .limit(3);

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">
              Admin dashboard
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              Signed in as {activeRole.full_name ?? user.email} - {normalizeRoleLabel(activeRole.role)}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/issues"
              className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-ink hover:border-accent"
            >
              Issues{openIssueCount ? ` (${openIssueCount})` : ""}
            </Link>
            {canManageUsers(activeRole.role) && (
              <Link
                href="/admin/users"
                className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-ink hover:border-accent"
              >
                Users
              </Link>
            )}
            <Link
              href="/admin/sync"
              className="bg-accent text-base font-medium rounded-lg px-4 py-2 text-sm hover:bg-accent-dim transition-colors"
            >
              Run new PDF sync
            </Link>
          </div>
        </div>

        <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard label="Open issues" value={String(openIssueCount ?? 0)} href="/admin/issues" />
          <SummaryCard label="Chapters" value={String(chapters?.length ?? 0)} />
          <SummaryCard label="Sync runs" value={String(syncRunCount ?? 0)} />
        </section>

        <section className="mb-8">
          <Link
            href="/admin/procedures"
            className="content-card block p-5 transition-colors hover:border-accent"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Procedure Review
            </p>
            <h2 className="mt-2 font-display text-xl font-semibold text-ink">
              Review procedure cards
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              Review, edit, approve, and publish procedure cards.
            </p>
          </Link>
        </section>

        {recentSyncs && recentSyncs.length > 0 && (
          <div className="mb-10">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xs uppercase tracking-wider text-ink-faint">Recent syncs</h2>
              {canManageUsers(activeRole.role) && (
                <AdminActionButton
                  endpoint="/api/sync-runs/cleanup"
                  method="DELETE"
                  label="Keep latest 3"
                  runningLabel="Cleaning..."
                  confirmText="Delete all sync runs except the latest 3?"
                />
              )}
            </div>
            <div className="bg-panel border border-border rounded-lg divide-y divide-border">
              {recentSyncs.map((s) => (
                <div key={s.id} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="text-ink">{s.source_filename}</span>
                    <span className="text-ink-faint ml-2 font-mono text-xs">v{s.source_version}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-ink-muted text-xs">{s.chapters_changed} changed</span>
                    <StatusBadge status={s.status} />
                    {s.id ? (
                      <Link
                        href={`/admin/sync/${s.id}`}
                        aria-label={`${syncActionLabel(s.status)} for ${s.source_filename} version ${s.source_version}`}
                        className="rounded border border-border bg-white px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                      >
                        {syncActionLabel(s.status)}
                      </Link>
                    ) : (
                      <span className="text-xs font-medium text-warn" role="status">
                        Sync ID unavailable
                      </span>
                    )}
                    {canManageUsers(activeRole.role) && (
                      <DeleteButton
                        endpoint={`/api/sync-runs/${s.id}`}
                        label="Delete"
                        confirmText="Delete this sync run from the recent list?"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentEdits && recentEdits.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xs uppercase tracking-wider text-ink-faint mb-3">Recent edits</h2>
            <div className="bg-panel border border-border rounded-lg divide-y divide-border">
              {recentEdits.map((edit) => (
                <div key={edit.id} className="px-4 py-3 flex items-center justify-between text-xs">
                  <span className="text-ink-muted">
                    {edit.edited_by_email ?? "Unknown"} - {edit.change_type.replace("_", " ")}
                  </span>
                  <span className="font-mono text-ink-faint">
                    {new Date(edit.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-xs uppercase tracking-wider text-ink-faint mb-3">
          All chapters ({chapters?.length ?? 0})
        </h2>
        <div className="bg-panel border border-border rounded-lg divide-y divide-border">
          {(chapters ?? []).map((c) => (
            <Link
              key={c.id}
              href={`/admin/chapter/${c.slug}`}
              className="px-4 py-3 flex items-center justify-between text-sm hover:bg-panel-hover transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-ink-faint tabular-nums w-6">
                  {String(c.chapter_number).padStart(2, "0")}
                </span>
                <span className="text-ink group-hover:text-accent transition-colors">{c.title}</span>
              </div>
              <span className="text-xs text-ink-faint">Edit -&gt;</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="content-card p-4 transition-colors hover:border-accent">
      <p className="text-xs uppercase tracking-wider text-ink-faint">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-ink">{value}</p>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

// Label for the "open this sync run" link, by sync-run status.
// Pending/reviewed runs are still reviewable; published runs are read-only;
// failed runs surface their error detail. Unknown statuses default to View.
function syncActionLabel(status: string): string {
  switch (status) {
    case "pending":
    case "reviewing":
    case "reviewed":
      return "Review changes";
    case "failed":
      return "View details";
    default:
      return "View sync";
  }
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-warn/10 text-warn border-warn/20",
    reviewed: "bg-accent/10 text-accent border-accent/20",
    published: "bg-good/10 text-good border-good/20",
    discarded: "bg-ink-faint/10 text-ink-faint border-ink-faint/20",
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded border ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}
