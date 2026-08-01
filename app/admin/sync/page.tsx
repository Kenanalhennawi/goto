import { SiteHeader } from "@/components/SiteHeader";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessAdmin, canManageUsers } from "@/lib/permissions";
import { PdfUploadPanel } from "@/components/admin/PdfUploadPanel";

// UPD-2: the PDF Update Studio entry point. Admins upload a new manual here;
// extraction happens asynchronously in the background worker. Chapter review
// and the existing atomic publish flow are unchanged.
export const dynamic = "force-dynamic";

type RunRow = {
  id: string;
  original_filename: string | null;
  source_filename: string | null;
  source_version: string | null;
  pdf_version: string | null;
  state: string | null;
  status: string | null;
  progress_pct: number | null;
  progress_message: string | null;
  error_code: string | null;
  chapters_changed: number | null;
  created_at: string;
};

const STATE_LABEL: Record<string, string> = {
  uploaded: "Uploaded",
  queued: "Queued",
  validating: "Validating",
  extracting: "Extracting",
  staged: "Ready for review",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
  cancelled: "Cancelled",
};

export default async function NewSyncPage() {
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

  if (!canAccessAdmin(role?.role)) {
    redirect("/admin");
  }

  // Only admin/owner may upload a new manual; quality reviewers can still see
  // run history and open the review screens.
  const canUpload = canManageUsers(role?.role);

  const { data: runs } = await supabase
    .from("sync_runs")
    .select(
      "id, original_filename, source_filename, source_version, pdf_version, state, status, progress_pct, progress_message, error_code, chapters_changed, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(10);

  const rows = (runs ?? []) as RunRow[];

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <Link
          href="/admin"
          className="mb-6 inline-flex text-xs font-semibold text-ink-muted hover:text-accent"
        >
          &larr; Back to dashboard
        </Link>

        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          PDF Update Studio
        </p>
        <h1 className="font-display text-2xl font-semibold text-ink">Sync a new GO TO manual</h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          Upload the manual, then review the staged chapter changes before publishing. Procedure
          cards are never approved or published automatically.
        </p>

        <div className="mt-6 space-y-6">
          {canUpload ? (
            <PdfUploadPanel />
          ) : (
            <section className="content-card p-5">
              <p className="text-sm text-ink-muted">
                Uploading a new manual requires admin or owner access. You can review and publish
                staged chapters from the runs below.
              </p>
            </section>
          )}

          <section className="content-card p-5">
            <h2 className="font-display text-base font-semibold text-ink">Recent sync runs</h2>
            {rows.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">No sync runs yet.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {rows.map((run) => {
                  const state = run.state ?? run.status ?? "uploaded";
                  const pct = Math.max(0, Math.min(100, run.progress_pct ?? 0));
                  const failed = state === "failed";
                  return (
                    <li key={run.id} className="rounded-lg border border-border bg-white px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink">
                            {run.original_filename ?? run.source_filename ?? "Manual upload"}
                          </span>
                          <span className="block text-xs text-ink-muted">
                            {run.pdf_version ?? run.source_version ?? "version pending"} ·{" "}
                            {new Date(run.created_at).toLocaleString()}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                            failed
                              ? "border-red-200 bg-red-50 text-red-700"
                              : state === "published"
                                ? "border-good/30 bg-mint-soft text-good"
                                : "border-border bg-slate-50 text-ink-muted"
                          }`}
                        >
                          {STATE_LABEL[state] ?? state}
                        </span>
                      </div>

                      {!failed && state !== "published" ? (
                        <div
                          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border"
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div className="h-full rounded-full bg-sky" style={{ width: `${pct}%` }} />
                        </div>
                      ) : null}

                      <p className="mt-1.5 text-xs text-ink-muted">
                        {failed
                          ? `Failed${run.error_code ? ` (${run.error_code})` : ""}. Upload again to retry; the previous run is kept.`
                          : (run.progress_message ?? "")}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link
                          href={`/admin/sync/${run.id}`}
                          className="agent-secondary touch-target inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold"
                        >
                          {state === "staged" ? "Review changes" : "View run"}
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Emergency fallback only. Paths are repository-relative — no machine
              specific paths. The web upload above is the supported route. */}
          <details className="content-card p-5">
            <summary className="cursor-pointer text-sm font-semibold text-ink">
              Advanced: local sync (emergency fallback)
            </summary>
            <p className="mt-3 text-sm leading-6 text-ink-muted">
              Run from the repository root with the service-role key in the local environment. Use
              only if the background worker is unavailable.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-slate-50 p-3 text-xs text-ink">
              <code>{`# 1. Extract chapters and attach PDF page links
python ./tools/extraction/extract.py "<path-to-manual.pdf>" ./tmp/extraction-output
python ./tools/extraction/attach_pdf_links.py "<path-to-manual.pdf>" ./tmp/extraction-output

# 2. Stage the run (requires SUPABASE_SERVICE_ROLE_KEY in the local shell)
node ./tools/sync/sync.mjs ./tmp/extraction-output/chapters.json

# 3. Open the printed /admin/sync/<run-id> link to review and publish`}</code>
            </pre>
          </details>
        </div>
      </main>
    </div>
  );
}
