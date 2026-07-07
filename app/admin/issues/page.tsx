import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { IssueStatusSelect } from "@/components/IssueStatusSelect";
import { DeleteButton } from "@/components/DeleteButton";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { isEditorRole } from "@/lib/permissions";

type IssueRow = {
  id: string;
  chapter_slug: string;
  section_id: string | null;
  reporter_email: string | null;
  message: string;
  status: string;
  created_at: string;
  chapters: { chapter_number: number; title: string; slug: string } | null;
};

export default async function AdminIssuesPage() {
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

  if (!isEditorRole(role?.role)) {
    redirect("/admin");
  }

  const { data: issues, error } = await supabase
    .from("content_issues")
    .select("id, chapter_slug, section_id, reporter_email, message, status, created_at, chapters(chapter_number, title, slug)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <Link href="/admin" className="mb-6 inline-flex text-xs text-ink-muted hover:text-accent">
          &larr; Back to dashboard
        </Link>
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-ink">Content issues</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Notes reported by agents while reading the guide.
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-accent/20 bg-accent/10 p-4 text-sm text-accent">
            Run <span className="font-mono">supabase/migration_content_issues.sql</span> in Supabase first.
          </div>
        ) : (
          <div className="grid gap-3">
            {((issues ?? []) as unknown as IssueRow[]).map((issue) => (
              <article key={issue.id} className="content-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-md bg-sky-soft px-2 py-1 font-semibold text-sky">
                        {issue.status}
                      </span>
                      <Link
                        href={`/chapter/${issue.chapters?.slug ?? issue.chapter_slug}`}
                        className="font-semibold text-ink hover:text-accent"
                      >
                        Ch. {issue.chapters?.chapter_number ?? "-"} - {issue.chapters?.title ?? issue.chapter_slug}
                      </Link>
                      <span className="text-ink-faint">
                        {new Date(issue.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="whitespace-pre-line text-sm leading-6 text-ink">{issue.message}</p>
                    <p className="mt-2 text-xs text-ink-faint">
                      Reported by {issue.reporter_email ?? "anonymous"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <IssueStatusSelect id={issue.id} status={issue.status} />
                    <DeleteButton
                      endpoint={`/api/issues/${issue.id}`}
                      confirmText="Delete this issue permanently?"
                    />
                  </div>
                </div>
              </article>
            ))}
            {issues?.length === 0 && (
              <div className="content-card p-6 text-sm text-ink-muted">
                No content issues yet.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
