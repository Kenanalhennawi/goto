import { CopyLinkButton } from "@/components/CopyLinkButton";
import { SiteHeader } from "@/components/SiteHeader";
import {
  approveAndPublish,
  archiveProcedure,
  markNeedsReview,
  unpublish,
  updateProcedureContent,
} from "@/app/admin/procedures/actions";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { JsonValue } from "@/lib/types";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type ProcedureDetail = {
  id: string;
  title: string;
  slug: string;
  category: string;
  summary: string | null;
  when_to_use: string | null;
  agent_action: JsonValue[];
  rules: JsonValue[];
  exceptions: JsonValue[];
  required_approval: string | null;
  customer_script: string | null;
  sprint_comment_template: string | null;
  salesforce_classification: string | null;
  source_pages: number[];
  source_version: string | null;
  source_updated_at: string | null;
  keywords: string[];
  aliases: string[];
  priority: number;
  review_status: string;
  is_published: boolean;
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

export default async function AdminProcedureDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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

  const { data } = await supabase
    .from("procedure_cards")
    .select(
      [
        "id",
        "title",
        "slug",
        "category",
        "summary",
        "when_to_use",
        "agent_action",
        "rules",
        "exceptions",
        "required_approval",
        "customer_script",
        "sprint_comment_template",
        "salesforce_classification",
        "source_pages",
        "source_version",
        "source_updated_at",
        "keywords",
        "aliases",
        "priority",
        "review_status",
        "is_published",
        "updated_at",
        "chapters(chapter_number, title, slug)",
      ].join(", ")
    )
    .eq("slug", slug)
    .single();

  if (!data) notFound();

  const procedure = data as unknown as ProcedureDetail;
  const chapter = firstChapter(procedure.chapters);
  const canArchive = role.role === "admin" || role.role === "owner";

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Link href="/admin/procedures" className="inline-flex text-xs font-semibold text-ink-muted hover:text-accent">
            &larr; Back to procedures
          </Link>
        </div>

        <section className="hero-panel mb-6 overflow-hidden rounded-[22px]">
          <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
            <div className="hero-main border-b border-border/80 p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Procedure review
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge>{procedure.category}</Badge>
                <Badge>{procedure.review_status.replace("_", " ")}</Badge>
                <Badge>{procedure.is_published ? "published" : "unpublished"}</Badge>
              </div>
              <h1 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
                {procedure.title}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-muted">
                Review the source-linked procedure card before making it public.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <CopyLinkButton path={`/admin/procedures/${procedure.slug}`} />
                <Link
                  href={`/procedure/${procedure.slug}`}
                  className="rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent"
                >
                  Public route
                </Link>
                {chapter && (
                  <Link
                    href={`/chapter/${chapter.slug}`}
                    className="rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent"
                  >
                    Source chapter
                  </Link>
                )}
              </div>
            </div>
            <aside className="bg-white/75 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Review actions
              </p>
              <div className="mt-4 space-y-2">
                <ActionForm action={approveAndPublish} slug={procedure.slug} label="Approve & publish" tone="primary" />
                <ActionForm action={unpublish} slug={procedure.slug} label="Unpublish" />
                <ActionForm action={markNeedsReview} slug={procedure.slug} label="Mark needs review" />
                {canArchive && (
                  <ActionForm action={archiveProcedure} slug={procedure.slug} label="Archive" tone="danger" />
                )}
              </div>
            </aside>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <TextSection title="Summary" value={procedure.summary} />
            <TextSection title="When to use" value={procedure.when_to_use} />
            <ListSection title="Agent action" items={procedure.agent_action} />
            <ListSection title="Rules" items={procedure.rules} />
            <ListSection title="Exceptions" items={procedure.exceptions} />
            <TextSection title="Required approval" value={procedure.required_approval} />
            <TextSection title="Customer script" value={procedure.customer_script} isScript />
            <TextSection title="SPRINT comment template" value={procedure.sprint_comment_template} isScript />
            <TextSection title="Salesforce classification" value={procedure.salesforce_classification} />
            <EditProcedureForm procedure={procedure} />
          </div>

          <aside className="space-y-5">
            <section className="content-card quick-card p-5">
              <h2 className="font-display text-lg font-semibold text-ink">Source evidence</h2>
              <dl className="mt-4 space-y-3 text-sm">
                {procedure.source_version && <Fact label="Source" value={procedure.source_version} />}
                {procedure.source_pages.length > 0 && (
                  <Fact label="Pages" value={formatSourcePages(procedure.source_pages)} />
                )}
                {procedure.source_updated_at && (
                  <Fact label="Source updated" value={safeDate(procedure.source_updated_at)} />
                )}
                <Fact label="Updated" value={safeDate(procedure.updated_at)} />
                <Fact label="Priority" value={String(procedure.priority)} />
              </dl>
            </section>

            {chapter && (
              <section className="content-card quick-card p-5">
                <h2 className="font-display text-lg font-semibold text-ink">Linked chapter</h2>
                <Link
                  href={`/chapter/${chapter.slug}`}
                  className="mt-3 block rounded-xl border border-border bg-white p-4 transition-colors hover:border-accent"
                >
                  <span className="text-xs font-semibold text-ink-faint">
                    Chapter {String(chapter.chapter_number).padStart(2, "0")}
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-ink">{chapter.title}</span>
                </Link>
              </section>
            )}

            <ChipSection title="Keywords" items={procedure.keywords} />
            <ChipSection title="Aliases" items={procedure.aliases} />
          </aside>
        </div>
      </main>
    </div>
  );
}

function EditProcedureForm({ procedure }: { procedure: ProcedureDetail }) {
  return (
    <section className="content-card quick-card p-5 sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Edit content
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold text-ink">Procedure fields</h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Saving edits will mark this procedure as needs review and unpublish it.
        </p>
      </div>

      <form action={updateProcedureContent} className="space-y-5">
        <input type="hidden" name="slug" value={procedure.slug} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" name="title" defaultValue={procedure.title} required />
          <Field label="Category" name="category" defaultValue={procedure.category} required />
        </div>

        <TextArea label="Summary" name="summary" defaultValue={procedure.summary} rows={3} />
        <TextArea label="When to use" name="when_to_use" defaultValue={procedure.when_to_use} rows={3} />
        <TextArea
          label="Agent action"
          name="agent_action"
          defaultValue={jsonListToLines(procedure.agent_action)}
          rows={6}
          hint="One line per action item."
        />
        <TextArea
          label="Rules"
          name="rules"
          defaultValue={jsonListToLines(procedure.rules)}
          rows={5}
          hint="One line per rule."
        />
        <TextArea
          label="Exceptions"
          name="exceptions"
          defaultValue={jsonListToLines(procedure.exceptions)}
          rows={5}
          hint="One line per exception."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea
            label="Required approval"
            name="required_approval"
            defaultValue={procedure.required_approval}
            rows={3}
          />
          <TextArea
            label="Salesforce classification"
            name="salesforce_classification"
            defaultValue={procedure.salesforce_classification}
            rows={3}
          />
        </div>

        <TextArea
          label="Customer script"
          name="customer_script"
          defaultValue={procedure.customer_script}
          rows={5}
        />
        <TextArea
          label="SPRINT comment template"
          name="sprint_comment_template"
          defaultValue={procedure.sprint_comment_template}
          rows={5}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea
            label="Source pages"
            name="source_pages"
            defaultValue={procedure.source_pages.join(", ")}
            rows={3}
            hint="Comma-separated page numbers."
          />
          <Field label="Priority" name="priority" defaultValue={String(procedure.priority)} type="number" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea
            label="Keywords"
            name="keywords"
            defaultValue={procedure.keywords.join(", ")}
            rows={4}
            hint="Comma-separated or one per line."
          />
          <TextArea
            label="Aliases"
            name="aliases"
            defaultValue={procedure.aliases.join(", ")}
            rows={4}
            hint="Comma-separated or one per line."
          />
        </div>

        <div className="flex justify-end border-t border-border pt-5">
          <button
            type="submit"
            className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-dim"
          >
            Save edits
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent"
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
  rows,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string | null;
  rows: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={rows}
        className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition-colors focus:border-accent"
      />
      {hint && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}

function ActionForm({
  action,
  slug,
  label,
  tone = "secondary",
}: {
  action: (formData: FormData) => Promise<void>;
  slug: string;
  label: string;
  tone?: "primary" | "secondary" | "danger";
}) {
  const styles = {
    primary: "border-accent bg-accent text-white hover:bg-accent-dim",
    secondary: "border-border bg-white text-ink-muted hover:border-accent hover:text-accent",
    danger: "border-red-200 bg-red-50 text-red-700 hover:border-red-300",
  };

  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        className={`w-full rounded-lg border px-4 py-2 text-left text-xs font-semibold transition-colors ${styles[tone]}`}
      >
        {label}
      </button>
    </form>
  );
}

function TextSection({ title, value, isScript = false }: { title: string; value: string | null; isScript?: boolean }) {
  const text = value?.trim();
  if (!text) return null;

  return (
    <section className="content-card quick-card p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      <p
        className={`mt-3 whitespace-pre-line text-sm leading-7 text-ink-muted ${
          isScript ? "rounded-xl border border-blue-200 bg-sky-soft p-4 font-mono text-xs text-ink" : ""
        }`}
      >
        {text}
      </p>
    </section>
  );
}

function ListSection({ title, items }: { title: string; items: JsonValue[] }) {
  const rendered = items.map(readableJsonItem).filter(Boolean);
  if (rendered.length === 0) return null;

  return (
    <section className="content-card quick-card p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      <ol className="mt-4 space-y-3">
        {rendered.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-3 text-sm leading-6 text-ink-muted">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
              {index + 1}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ChipSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <section className="content-card quick-card p-5">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="rounded-full border border-blue-200 bg-sky-soft px-3 py-1 text-xs font-semibold text-sky">
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-blue-200 bg-sky-soft px-3 py-1 text-xs font-semibold text-sky">
      {children}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

function readableJsonItem(item: JsonValue) {
  if (typeof item === "string") return item.trim();
  if (typeof item === "number" || typeof item === "boolean") return String(item);
  if (!item || Array.isArray(item)) return "";

  const record = item as Record<string, JsonValue>;
  for (const key of ["label", "text", "value", "title", "description"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return JSON.stringify(item);
}

function jsonListToLines(items: JsonValue[]) {
  return items.map(readableJsonItem).filter(Boolean).join("\n");
}

function formatSourcePages(pages: number[]) {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  if (sorted.length === 1) return `Page ${sorted[0]}`;
  const isContiguous = sorted.every((page, index) => index === 0 || page === sorted[index - 1] + 1);
  if (isContiguous) return `Pages ${sorted[0]}-${sorted[sorted.length - 1]}`;
  return `Pages ${sorted.join(", ")}`;
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

function firstChapter(chapters: ProcedureDetail["chapters"]) {
  return Array.isArray(chapters) ? chapters[0] ?? null : chapters;
}
