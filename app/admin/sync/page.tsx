import { SiteHeader } from "@/components/SiteHeader";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/permissions";

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

        <section className="content-card p-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            New PDF Sync
          </p>
          <h1 className="font-display text-2xl font-semibold text-ink">
            Run the PDF sync from PowerShell
          </h1>
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            For security, the website cannot run this directly because it needs the Supabase
            service role key. Run these commands locally, then open the review link printed
            by the sync script.
          </p>

          <div className="mt-6 space-y-5">
            <Step number="1" title="Extract and attach PDF links">
              <CodeBlock
                code={`cd C:\\goto-manual-project\\goto-project\\extraction
python extract.py "PATH_TO_NEW_PDF.pdf" output
python attach_pdf_links.py "PATH_TO_NEW_PDF.pdf" output`}
              />
            </Step>

            <Step number="2" title="Run sync">
              <CodeBlock
                code={`cd C:\\goto-manual-project\\goto-project\\sync
node sync.mjs ..\\extraction\\output\\chapters.json`}
              />
            </Step>

            <Step number="3" title="Review and publish">
              <p className="text-sm leading-6 text-ink-muted">
                Open the <span className="font-mono text-ink">/admin/sync/...</span> link
                printed by PowerShell, then use <strong>Approve all</strong> and{" "}
                <strong>Publish</strong>.
              </p>
            </Step>
          </div>
        </section>
      </main>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 font-mono text-xs font-semibold text-accent">
          {number}
        </span>
        <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-ink p-4 text-xs leading-6 text-white">
      <code>{code}</code>
    </pre>
  );
}
