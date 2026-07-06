import { SiteHeader } from "@/components/SiteHeader";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import { redirect } from "next/navigation";

type SearchParams = {
  status?: string;
  category?: string;
  published?: string;
};

type ProcedureListRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  review_status: string;
  is_published: boolean;
  priority: number;
  updated_at: string;
  chapters:
    | {
    chapter_number: number;
    title: string;
    slug: string;
      }
    | {
        chapter_number: number;
        title: string;
        slug: string;
      }[]
    | null;
};

export default async function AdminProceduresPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: role } = await supabase
    .from("user_roles")
    .select("role, full_name")
    .eq("user_id", user.id)
    .single();

  if (!role || !["quality", "admin", "owner"].includes(role.role)) {
    redirect("/admin");
  }

  let query = supabase
    .from("procedure_cards")
    .select(
      "id, title, slug, category, review_status, is_published, priority, updated_at, chapters(chapter_number, title, slug)"
    )
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false });

  if (filters.status) query = query.eq("review_status", filters.status);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.published === "true") query = query.eq("is_published", true);
  if (filters.published === "false") query = query.eq("is_published", false);

  const { data: procedures } = await query;
  const rows = (procedures ?? []) as unknown as ProcedureListRow[];

  const { data: categories } = await supabase
    .from("procedure_cards")
    .select("category")
    .order("category", { ascending: true });
  const uniqueCategories = [...new Set((categories ?? []).map((item) => item.category).filter(Boolean))];

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/admin" className="mb-4 inline-flex text-xs font-semibold text-ink-muted hover:text-accent">
              &larr; Back to dashboard
            </Link>
            <h1 className="font-display text-2xl font-semibold text-ink">Procedure review</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Review seeded procedure cards before approving them for public use.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-white px-4 py-3 text-xs text-ink-muted">
            Signed in as {role.full_name ?? user.email} · {role.role}
          </div>
        </div>

        <section className="content-card mb-6 p-4">
          <div className="flex flex-wrap gap-2">
            <FilterLink href="/admin/procedures" active={!filters.status && !filters.category && !filters.published}>
              All
            </FilterLink>
            {["needs_review", "approved", "draft", "archived"].map((status) => (
              <FilterLink key={status} href={`/admin/procedures?status=${status}`} active={filters.status === status}>
                {status.replace("_", " ")}
              </FilterLink>
            ))}
            <FilterLink href="/admin/procedures?published=true" active={filters.published === "true"}>
              Published
            </FilterLink>
            <FilterLink href="/admin/procedures?published=false" active={filters.published === "false"}>
              Unpublished
            </FilterLink>
          </div>
          {uniqueCategories.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
              {uniqueCategories.map((category) => (
                <FilterLink
                  key={category}
                  href={`/admin/procedures?category=${encodeURIComponent(category)}`}
                  active={filters.category === category}
                >
                  {category}
                </FilterLink>
              ))}
            </div>
          )}
        </section>

        <section className="content-card overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-faint sm:grid-cols-[1.4fr_0.8fr_0.8fr_0.7fr_0.9fr_auto]">
            <span>Procedure</span>
            <span className="hidden sm:block">Category</span>
            <span className="hidden sm:block">Status</span>
            <span className="hidden sm:block">Priority</span>
            <span className="hidden sm:block">Chapter</span>
            <span>Open</span>
          </div>

          {rows.length > 0 ? (
            <div className="divide-y divide-border">
              {rows.map((procedure) => {
                const chapter = firstChapter(procedure.chapters);

                return (
                  <div
                    key={procedure.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-4 text-sm sm:grid-cols-[1.4fr_0.8fr_0.8fr_0.7fr_0.9fr_auto]"
                  >
                    <div>
                      <p className="font-semibold text-ink">{procedure.title}</p>
                      <p className="mt-1 text-xs text-ink-faint">Updated {safeDate(procedure.updated_at)}</p>
                    </div>
                    <span className="hidden text-ink-muted sm:block">{procedure.category}</span>
                    <div className="hidden sm:block">
                      <StatusBadge status={procedure.review_status} published={procedure.is_published} />
                    </div>
                    <span className="hidden font-mono text-xs text-ink-muted sm:block">{procedure.priority}</span>
                    <span className="hidden text-xs text-ink-muted sm:block">
                      {chapter ? `${String(chapter.chapter_number).padStart(2, "0")} ${chapter.title}` : "Not linked"}
                    </span>
                    <Link
                      href={`/admin/procedures/${procedure.slug}`}
                      className="rounded-lg border border-blue-200 bg-sky-soft px-3 py-2 text-xs font-semibold text-sky transition-colors hover:border-sky hover:bg-white"
                    >
                      Open
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-ink-muted">No procedure cards match these filters.</div>
          )}
        </section>
      </main>
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "border-accent bg-accent text-white"
          : "border-border bg-white text-ink-muted hover:border-accent hover:text-accent"
      }`}
    >
      {children}
    </Link>
  );
}

function StatusBadge({ status, published }: { status: string; published: boolean }) {
  const styles: Record<string, string> = {
    draft: "border-ink-faint/20 bg-ink-faint/10 text-ink-muted",
    needs_review: "border-warn/20 bg-warn/10 text-warn",
    approved: "border-good/20 bg-good/10 text-good",
    archived: "border-border bg-panel-hover text-ink-faint",
  };

  return (
    <div className="flex flex-wrap gap-1">
      <span className={`rounded border px-2 py-0.5 text-[11px] ${styles[status] ?? styles.needs_review}`}>
        {status.replace("_", " ")}
      </span>
      <span
        className={`rounded border px-2 py-0.5 text-[11px] ${
          published ? "border-good/20 bg-good/10 text-good" : "border-border bg-white text-ink-faint"
        }`}
      >
        {published ? "published" : "unpublished"}
      </span>
    </div>
  );
}

function safeDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function firstChapter(chapters: ProcedureListRow["chapters"]) {
  return Array.isArray(chapters) ? chapters[0] ?? null : chapters;
}
