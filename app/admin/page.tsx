import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SiteHeader } from "@/components/SiteHeader";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminDashboard() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: role } = await supabase
    .from("user_roles")
    .select("role, full_name")
    .eq("user_id", user.id)
    .single();

  if (!role || !["quality", "admin", "owner"].includes(role.role)) {
    return (
      <div className="flex flex-col flex-1">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-sm">
            <h1 className="font-display text-xl text-ink mb-2">No edit access yet</h1>
            <p className="text-sm text-ink-muted">
              Your account is signed in but hasn&rsquo;t been granted quality team or admin
              access. Ask an existing admin to add your role in the user_roles table.
            </p>
          </div>
        </main>
      </div>
    );
  }

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

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">
              Quality team dashboard
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              Signed in as {role.full_name ?? user.email} · {role.role}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/issues"
              className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-ink hover:border-accent"
            >
              Issues{openIssueCount ? ` (${openIssueCount})` : ""}
            </Link>
            {(role.role === "admin" || role.role === "owner") && (
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

        {recentSyncs && recentSyncs.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xs uppercase tracking-wider text-ink-faint mb-3">Recent syncs</h2>
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
                  </div>
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
              <span className="text-xs text-ink-faint">Edit →</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
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
