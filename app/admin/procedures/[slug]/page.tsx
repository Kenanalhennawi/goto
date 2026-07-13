import { CopyLinkButton } from "@/components/CopyLinkButton";
import { SiteHeader } from "@/components/SiteHeader";
import {
  approveAndPublish,
  archiveProcedure,
  markNeedsReview,
  unpublish,
  updateProcedureContent,
  updateHomepageVisibility,
} from "@/app/admin/procedures/actions";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { ContentBlock, JsonValue } from "@/lib/types";
import { canArchiveProcedures, canReviewProcedures } from "@/lib/permissions";
import {
  detailQualityBadges,
  genericFillerFields,
  hasItems,
  hasText,
  isReferenceCard,
  readableJsonItem,
  sourceReviewStatus,
  sourceReviewWarnings,
  type SourceReviewWarning,
} from "@/lib/admin-procedure-quality";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type ProcedureDetail = {
  chapter_id: string | null;
  id: string;
  title: string;
  slug: string;
  category: string;
  service_code: string | null;
  service_type: string | null;
  summary: string | null;
  when_to_use: string | null;
  channels: JsonValue[];
  cut_off_time: string | null;
  who_can_action: JsonValue[];
  required_information: JsonValue[];
  system_steps: JsonValue[];
  passenger_advice: JsonValue[];
  allowed: JsonValue[];
  not_allowed: JsonValue[];
  escalation_points: JsonValue[];
  fees_charges: string | null;
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
  show_on_homepage: boolean;
  homepage_order: number;
  source_confidence: string;
  last_reviewed_at: string | null;
  last_reviewed_by: string | null;
  updated_at: string;
  chapters:
    | {
        chapter_number: number;
        title: string;
        slug: string;
        source_version: string | null;
        updated_at: string | null;
      }
    | {
        chapter_number: number;
        title: string;
        slug: string;
        source_version: string | null;
        updated_at: string | null;
      }[]
    | null;
};

type SourceChapter = {
  id: string;
  chapter_number: number;
  title: string;
  slug: string;
  body_text: string;
  content_blocks: ContentBlock[];
  page_start: number | null;
  page_end: number | null;
  source_version: string | null;
  updated_at: string | null;
};

export default async function AdminProcedureDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const status = await searchParams;
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

  if (!canReviewProcedures(role?.role)) {
    redirect("/admin");
  }

  const { data } = await supabase
    .from("procedure_cards")
    .select(
      [
        "id",
        "chapter_id",
        "title",
        "slug",
        "category",
        "service_code",
        "service_type",
        "summary",
        "when_to_use",
        "channels",
        "cut_off_time",
        "who_can_action",
        "required_information",
        "system_steps",
        "passenger_advice",
        "allowed",
        "not_allowed",
        "escalation_points",
        "fees_charges",
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
        "show_on_homepage",
        "homepage_order",
        "source_confidence",
        "last_reviewed_at",
        "last_reviewed_by",
        "updated_at",
        "chapters(chapter_number, title, slug, source_version, updated_at)",
      ].join(", ")
    )
    .eq("slug", slug)
    .single();

  if (!data) notFound();

  const procedure = data as unknown as ProcedureDetail;
  const chapter = firstChapter(procedure.chapters);
  const canArchive = canArchiveProcedures(role?.role);
  const canFeatureOnHomepage = canArchive;
  const quality = evaluateProcedureQuality(procedure);
  const { data: sourceChapterData } = procedure.chapter_id
    ? await supabase
        .from("chapters")
        .select("id, chapter_number, title, slug, body_text, content_blocks, page_start, page_end, source_version, updated_at")
        .eq("id", procedure.chapter_id)
        .single()
    : { data: null };
  const sourceChapter = sourceChapterData as SourceChapter | null;

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Link href="/admin/procedures" className="inline-flex text-xs font-semibold text-ink-muted hover:text-accent">
            &larr; Back to procedures
          </Link>
        </div>

        <ActionStatusMessage status={status} />

        <section className="hero-panel mb-6 overflow-hidden rounded-[22px]">
          <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
            <div className="hero-main border-b border-border/80 p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Procedure review
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge>{procedure.category}</Badge>
                {procedure.service_code && <Badge>{procedure.service_code}</Badge>}
                {procedure.service_type && <Badge>{procedure.service_type}</Badge>}
                <Badge>{procedure.review_status.replace("_", " ")}</Badge>
                <Badge>{procedure.source_confidence.replace("_", " ")}</Badge>
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
              {quality.level !== "ready" && (
                <div
                  className={`mt-4 rounded-xl border px-3 py-2 text-xs font-semibold ${
                    quality.level === "critical"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-warn/20 bg-warn/10 text-warn"
                  }`}
                >
                  This card has missing operational fields. Review before publishing.
                </div>
              )}
              {quality.fillerFields.length > 0 && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  Do not publish: generic filler detected.
                </div>
              )}
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
            <GenericFillerWarning fields={quality.fillerFields} />
            <SourceReviewWarnings
              warnings={quality.sourceWarnings}
              cardSourceVersion={procedure.source_version}
              chapterSourceVersion={chapter?.source_version ?? null}
            />
            <QualityChecklist quality={quality} />
            <TextSection title="Summary" value={procedure.summary} />
            <TextSection title="When to use" value={procedure.when_to_use} />
            <ServicePreview procedure={procedure} />
            <ListSection title="Agent action" items={procedure.agent_action} />
            <ListSection title="Rules" items={procedure.rules} />
            <ListSection title="Exceptions" items={procedure.exceptions} />
            <TextSection title="Required approval" value={procedure.required_approval} />
            <TextSection title="Customer script" value={procedure.customer_script} isScript />
            <TextSection title="SPRINT comment template" value={procedure.sprint_comment_template} isScript />
            <TextSection title="Salesforce classification" value={procedure.salesforce_classification} />
            <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <SourceChapterPanel sourceChapter={sourceChapter} fallbackChapter={chapter} />
              <EditProcedureForm procedure={procedure} />
            </div>
          </div>

          <aside className="space-y-5">
            <section className="content-card quick-card p-5">
              <h2 className="font-display text-lg font-semibold text-ink">Source evidence</h2>
              <dl className="mt-4 space-y-3 text-sm">
                {procedure.source_version && <Fact label="Card source version" value={procedure.source_version} />}
                {chapter?.source_version && <Fact label="Chapter source version" value={chapter.source_version} />}
                {procedure.source_pages.length > 0 && (
                  <Fact label="Pages" value={formatSourcePages(procedure.source_pages)} />
                )}
                {procedure.source_updated_at && (
                  <Fact label="Source updated" value={safeDate(procedure.source_updated_at)} />
                )}
                <Fact label="Updated" value={safeDate(procedure.updated_at)} />
                <Fact label="Confidence" value={procedure.source_confidence.replace("_", " ")} />
                <Fact label="Last reviewed" value={safeDate(procedure.last_reviewed_at)} />
                {chapter?.updated_at && <Fact label="Chapter updated" value={safeDate(chapter.updated_at)} />}
                <Fact label="Review freshness" value={sourceReviewStatus(procedure)} />
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
            {canFeatureOnHomepage && <HomepageVisibilityForm procedure={procedure} />}
          </aside>
        </div>
      </main>
    </div>
  );
}

type QualityLevel = "ready" | "review" | "critical";

type QualityItem = {
  label: string;
  ok: boolean;
  severity: "green" | "amber" | "red";
};

type QualityResult = {
  level: QualityLevel;
  summary: string;
  badges: string[];
  items: QualityItem[];
  fillerFields: string[];
  sourceWarnings: SourceReviewWarning[];
};

function QualityChecklist({ quality }: { quality: QualityResult }) {
  const styles: Record<QualityLevel, string> = {
    ready: "border-good/20 bg-good/10 text-good",
    review: "border-warn/20 bg-warn/10 text-warn",
    critical: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <section className="content-card quick-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Quality checklist
          </p>
          <h2 className="mt-2 font-display text-xl font-semibold text-ink">
            Operational publish readiness
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Checks critical service-card fields before review actions.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${styles[quality.level]}`}>
          {quality.summary}
        </span>
      </div>

      {quality.badges.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {quality.badges.map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-border bg-slate-50 px-3 py-1 text-xs font-semibold text-ink-muted"
            >
              {badge}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {quality.items.map((item) => (
          <div
            key={item.label}
            className={`rounded-xl border px-3 py-2 text-sm ${
              item.ok
                ? "border-good/20 bg-good/10 text-good"
                : item.severity === "red"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-warn/20 bg-warn/10 text-warn"
            }`}
          >
            <span className="font-semibold">{item.ok ? "OK" : "Review"}</span> - {item.label}
          </div>
        ))}
      </div>
    </section>
  );
}

function GenericFillerWarning({ fields }: { fields: string[] }) {
  if (fields.length === 0) return null;

  return (
    <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700 shadow-sm sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em]">
        Generic filler detected
      </p>
      <h2 className="mt-2 font-display text-xl font-semibold">
        This card should not be published yet
      </h2>
      <p className="mt-2 text-sm leading-6">
        This card contains generic filler text and should not be published until rewritten into real operational guidance.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {fields.map((field) => (
          <span key={field} className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold">
            {field}
          </span>
        ))}
      </div>
    </section>
  );
}

function SourceReviewWarnings({
  warnings,
  cardSourceVersion,
  chapterSourceVersion,
}: {
  warnings: SourceReviewWarning[];
  cardSourceVersion: string | null;
  chapterSourceVersion: string | null;
}) {
  if (warnings.length === 0) return null;

  return (
    <section className="rounded-2xl border border-warn/30 bg-warn/10 p-5 text-ink sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-warn">Source review warning</p>
      {warnings.includes("Source updated") && (
        <div className="mt-3">
          <h2 className="font-display text-xl font-semibold">Source updated after card review</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            The linked manual chapter was updated after this operational card was last reviewed. Re-check the card
            against the source before publishing or relying on it.
          </p>
        </div>
      )}
      {warnings.includes("Never reviewed against source") && (
        <div className="mt-3">
          <h2 className="font-display text-xl font-semibold">Source review not recorded</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            This card has no recorded source-review date.
          </p>
        </div>
      )}
      {warnings.includes("Version mismatch") && (
        <div className="mt-3 rounded-xl border border-warn/30 bg-white/70 p-3 text-sm">
          <h2 className="font-semibold">Source version mismatch</h2>
          <p className="mt-2 text-ink-muted">Card version: {cardSourceVersion ?? "Not recorded"}</p>
          <p className="text-ink-muted">Linked chapter version: {chapterSourceVersion ?? "Not recorded"}</p>
        </div>
      )}
    </section>
  );
}

function evaluateProcedureQuality(procedure: ProcedureDetail): QualityResult {
  const isReference = isReferenceCard(procedure);
  const fillerFields = genericFillerFields(procedure);
  const sourceWarnings = sourceReviewWarnings(procedure);
  const items: QualityItem[] = [
    check("No generic filler text", fillerFields.length === 0, "red"),
    check("Has service code or clear reference code", hasText(procedure.service_code), "red"),
    check("Has service type", hasText(procedure.service_type), "red"),
    check("Has who can action", hasItems(procedure.who_can_action), "red"),
    check("Has required information", hasItems(procedure.required_information), "amber"),
    check("Has system steps or handling steps", hasItems(procedure.system_steps) || hasItems(procedure.agent_action), "red"),
    check("Has passenger advice", hasItems(procedure.passenger_advice), "red"),
    check("Has allowed rules or applicability", hasItems(procedure.allowed), "amber"),
    check("Has not allowed / restrictions", hasItems(procedure.not_allowed), "red"),
    check("Has escalation guidance", hasItems(procedure.escalation_points), "amber"),
    check("Has source confidence", hasText(procedure.source_confidence), "red"),
  ];

  if (isReference) {
    items.push(
      check("Has timing rule or reference rule", hasText(procedure.cut_off_time), "red"),
      check("Has applicability / allowed conditions", hasItems(procedure.allowed), "amber"),
      check("Has not allowed / exclusions if applicable", hasItems(procedure.not_allowed), "amber"),
      check("Does not label timing as service cut-off", getTimingLabel(procedure) !== "Cut-off time", "amber")
    );
  } else {
    const hasExceptions = hasItems(procedure.exceptions) || hasItems(procedure.not_allowed);
    items.push(
      check("Has deadline / cut-off captured", hasText(procedure.cut_off_time), "red"),
      check("Has blocking conditions / not allowed", hasItems(procedure.not_allowed), "red"),
      check("Has passenger advice", hasItems(procedure.passenger_advice), "red"),
      check("Has escalation if exceptions exist", !hasExceptions || hasItems(procedure.escalation_points), "amber")
    );
  }

  if (procedure.chapters) {
    items.push(
      check("Source review recorded", !sourceWarnings.includes("Never reviewed against source"), "amber"),
      check("Linked source has not changed after review", !sourceWarnings.includes("Source updated"), "amber"),
      check("Source versions match", !sourceWarnings.includes("Version mismatch"), "amber")
    );
  }

  const redMissing = items.some((item) => !item.ok && item.severity === "red");
  const amberMissing = items.some((item) => !item.ok && item.severity === "amber");
  const level: QualityLevel = redMissing ? "critical" : amberMissing ? "review" : "ready";
  const badges = detailQualityBadges(procedure, isReference);

  return {
    level,
    summary: level === "ready" ? "Ready-looking" : level === "critical" ? "Critical missing fields" : "Needs review",
    badges,
    items,
    fillerFields,
    sourceWarnings,
  };
}

function check(label: string, ok: boolean, severity: "amber" | "red"): QualityItem {
  return { label, ok, severity: ok ? "green" : severity };
}

function ActionStatusMessage({ status }: { status: Record<string, string | undefined> }) {
  const message =
    status.saved === "1"
      ? "Procedure content saved. It is now unpublished and marked for review."
      : status.approved === "1"
        ? "Procedure approved and published."
        : status.unpublished === "1"
          ? "Procedure unpublished."
          : status.needs_review === "1"
            ? "Procedure marked as needs review and unpublished."
            : status.archived === "1"
              ? "Procedure archived and unpublished."
              : status.homepage === "1"
                ? "Homepage visibility updated."
                : "";

  if (status.error) {
    return (
      <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        {status.error}
      </div>
    );
  }

  if (!message) return null;

  return (
    <div className="mb-6 rounded-xl border border-good/20 bg-good/10 px-4 py-3 text-sm font-medium text-good">
      {message}
    </div>
  );
}

function HomepageVisibilityForm({ procedure }: { procedure: ProcedureDetail }) {
  return (
    <section className="content-card quick-card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
        Homepage visibility
      </p>
      <h2 className="mt-2 font-display text-lg font-semibold text-ink">Featured card</h2>
      <p className="mt-2 text-xs leading-5 text-ink-muted">
        Admin/owner control for selecting the few cards shown on the homepage. This does not
        publish, unpublish, or change review status.
      </p>
      <form action={updateHomepageVisibility} className="mt-4 space-y-4">
        <input type="hidden" name="slug" value={procedure.slug} />
        <label className="flex items-center gap-3 rounded-xl border border-border bg-white p-3 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            name="show_on_homepage"
            defaultChecked={procedure.show_on_homepage}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          Show on homepage
        </label>
        <Field
          label="Homepage display order"
          name="homepage_order"
          defaultValue={String(procedure.homepage_order)}
          type="number"
        />
        <p className="-mt-2 text-xs leading-5 text-ink-faint">
          Lower number appears first. Use 1 for the first featured card, 2 for the second.
        </p>
        <button
          type="submit"
          className="w-full rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent"
        >
          Update homepage visibility
        </button>
      </form>
    </section>
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
          <Field label="Service code" name="service_code" defaultValue={procedure.service_code ?? ""} />
          <Field label="Service type" name="service_type" defaultValue={procedure.service_type ?? ""} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea
            label="Channels"
            name="channels"
            defaultValue={jsonListToLines(procedure.channels)}
            rows={4}
            hint="One line per channel."
          />
          <TextArea
            label="Who can action"
            name="who_can_action"
            defaultValue={jsonListToLines(procedure.who_can_action)}
            rows={4}
            hint="One line per role/team."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea
            label="Cut-off / timing rule"
            name="cut_off_time"
            defaultValue={procedure.cut_off_time}
            rows={5}
            hint="For services, enter the cut-off time. For reference cards such as MCT, enter timing rules on separate lines."
          />
          <TextArea
            label="Required information"
            name="required_information"
            defaultValue={jsonListToLines(procedure.required_information)}
            rows={4}
            hint="One line per required item."
          />
        </div>

        <TextArea
          label="System steps"
          name="system_steps"
          defaultValue={jsonListToLines(procedure.system_steps)}
          rows={6}
          hint="One line per system/tool step."
        />
        <TextArea
          label="Passenger advice"
          name="passenger_advice"
          defaultValue={jsonListToLines(procedure.passenger_advice)}
          rows={5}
          hint="One line per advice item."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea
            label="Allowed"
            name="allowed"
            defaultValue={jsonListToLines(procedure.allowed)}
            rows={5}
            hint="One line per allowed action/rule."
          />
          <TextArea
            label="Not allowed"
            name="not_allowed"
            defaultValue={jsonListToLines(procedure.not_allowed)}
            rows={5}
            hint="One line per restriction."
          />
        </div>

        <TextArea
          label="Escalation points"
          name="escalation_points"
          defaultValue={jsonListToLines(procedure.escalation_points)}
          rows={5}
          hint="One line per escalation trigger/team."
        />
        <TextArea
          label="Fees / charges"
          name="fees_charges"
          defaultValue={procedure.fees_charges}
          rows={3}
        />

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

function ServicePreview({ procedure }: { procedure: ProcedureDetail }) {
  const serviceFacts = [
    procedure.service_code ? { label: "Service code", value: procedure.service_code } : null,
    procedure.service_type ? { label: "Service type", value: procedure.service_type } : null,
    procedure.cut_off_time ? { label: getTimingLabel(procedure), value: procedure.cut_off_time } : null,
    procedure.fees_charges ? { label: "Fees / charges", value: procedure.fees_charges } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  const sections = [
    { title: "Channels", items: procedure.channels },
    { title: "Who can action", items: procedure.who_can_action },
    { title: "Required information", items: procedure.required_information },
    { title: "System steps", items: procedure.system_steps },
    { title: "Passenger advice", items: procedure.passenger_advice },
    { title: "Allowed", items: procedure.allowed },
    { title: "Not allowed", items: procedure.not_allowed },
    { title: "Escalation points", items: procedure.escalation_points },
  ];

  if (serviceFacts.length === 0 && sections.every((section) => section.items.length === 0)) {
    return null;
  }

  return (
    <section className="content-card quick-card p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold text-ink">Service card fields</h2>
      {serviceFacts.length > 0 && (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {serviceFacts.map((fact) => (
            <div key={fact.label} className="rounded-xl border border-border bg-white p-3">
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                {fact.label}
              </dt>
              <dd className="mt-1 whitespace-pre-line text-sm font-semibold text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {sections.map((section) => {
          const items = section.items.map((item) => readableJsonItem(item, { fallbackJson: true })).filter(Boolean);
          if (items.length === 0) return null;
          return (
            <div key={section.title} className="rounded-xl border border-border bg-white p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                {section.title}
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm leading-6 text-ink-muted">
                {items.map((item, index) => (
                  <li key={`${section.title}-${index}`}>- {item}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function getTimingLabel(card: Pick<ProcedureDetail, "service_code" | "service_type" | "category">) {
  if (card.service_code?.toUpperCase() === "MCT") return "MCT rule";
  const type = `${card.service_type ?? ""} ${card.category ?? ""}`.toLowerCase();
  if (type.includes("reference")) return "Reference rule";
  if (type.includes("rule")) return "Timing rule";
  return "Cut-off time";
}

function SourceChapterPanel({
  sourceChapter,
  fallbackChapter,
}: {
  sourceChapter: SourceChapter | null;
  fallbackChapter: ReturnType<typeof firstChapter>;
}) {
  if (!sourceChapter) {
    return (
      <section className="content-card quick-card p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Linked source chapter
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold text-ink">Source preview unavailable</h2>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          This procedure is not linked to a source chapter record with readable text yet.
          {fallbackChapter ? " Open the linked chapter from the source panel to review it." : ""}
        </p>
      </section>
    );
  }

  const preview = sourceChapter.body_text.trim().slice(0, 2200);
  const textBlocks = safeTextBlocks(sourceChapter.content_blocks);
  const linkBlocks = safeLinkBlocks(sourceChapter.content_blocks);
  const imageCount = sourceChapter.content_blocks.filter((block) => block.type === "image").length;

  return (
    <section className="content-card quick-card p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
        Linked source chapter
      </p>
      <h2 className="mt-2 font-display text-xl font-semibold text-ink">
        Ch. {String(sourceChapter.chapter_number).padStart(2, "0")} - {sourceChapter.title}
      </h2>
      <p className="mt-3 rounded-xl border border-warn/20 bg-warn/10 p-3 text-xs leading-5 text-ink-muted">
        Draft procedure content only from the linked source chapter. Do not add unsupported policy.
      </p>

      <dl className="mt-4 space-y-3 text-sm">
        {sourceChapter.source_version && <Fact label="Source" value={sourceChapter.source_version} />}
        {pageRange(sourceChapter.page_start, sourceChapter.page_end) && (
          <Fact label="Pages" value={pageRange(sourceChapter.page_start, sourceChapter.page_end)} />
        )}
        {sourceChapter.updated_at && <Fact label="Updated" value={safeDate(sourceChapter.updated_at)} />}
      </dl>

      <Link
        href={`/chapter/${sourceChapter.slug}`}
        className="mt-4 inline-flex rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent"
      >
        Open source chapter
      </Link>

      {preview && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Source text preview
          </h3>
          <pre className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-white p-4 text-xs leading-6 text-ink-muted">
            {preview}
            {sourceChapter.body_text.length > preview.length ? "\n\n..." : ""}
          </pre>
        </div>
      )}

      {(textBlocks.length > 0 || linkBlocks.length > 0 || imageCount > 0) && (
        <div className="mt-5 space-y-4 border-t border-border pt-5">
          {textBlocks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Readable text blocks
              </h3>
              <div className="mt-2 space-y-2">
                {textBlocks.map((block, index) => (
                  <p
                    key={`${block}-${index}`}
                    className="rounded-lg border border-border bg-white p-3 text-xs leading-5 text-ink-muted"
                  >
                    {block}
                  </p>
                ))}
              </div>
            </div>
          )}

          {linkBlocks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Source links
              </h3>
              <div className="mt-2 space-y-2">
                {linkBlocks.map((block, index) => (
                  <a
                    key={`${block.url}-${index}`}
                    href={block.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg border border-blue-200 bg-sky-soft p-3 text-xs font-semibold text-sky transition-colors hover:border-sky hover:bg-white"
                  >
                    {block.title}
                  </a>
                ))}
              </div>
            </div>
          )}

          {imageCount > 0 && (
            <p className="rounded-lg border border-border bg-white p-3 text-xs leading-5 text-ink-muted">
              {imageCount} image block{imageCount === 1 ? "" : "s"} available in the source chapter.
              Open the source chapter to review screenshots in context.
            </p>
          )}
        </div>
      )}

      {sourceChapter.body_text && (
        <details className="mt-5 rounded-xl border border-border bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">
            Show full source text
          </summary>
          <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap border-t border-border p-4 text-xs leading-6 text-ink-muted">
            {sourceChapter.body_text}
          </pre>
        </details>
      )}
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
  const rendered = items.map((item) => readableJsonItem(item, { fallbackJson: true })).filter(Boolean);
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

function jsonListToLines(items: JsonValue[]) {
  return items.map((item) => readableJsonItem(item, { fallbackJson: true })).filter(Boolean).join("\n");
}

function formatSourcePages(pages: number[]) {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  if (sorted.length === 1) return `Page ${sorted[0]}`;
  const isContiguous = sorted.every((page, index) => index === 0 || page === sorted[index - 1] + 1);
  if (isContiguous) return `Pages ${sorted[0]}-${sorted[sorted.length - 1]}`;
  return `Pages ${sorted.join(", ")}`;
}

function pageRange(start: number | null, end: number | null) {
  if (!start && !end) return "";
  if (start === end || !end) return `Page ${start ?? end}`;
  return `Pages ${start}-${end}`;
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

function safeTextBlocks(blocks: ContentBlock[]) {
  return blocks
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text?.replace(/\s+/g, " ").trim() ?? "")
    .filter((text) => text.length > 60)
    .slice(0, 4)
    .map((text) => (text.length > 420 ? `${text.slice(0, 420)}...` : text));
}

function safeLinkBlocks(blocks: ContentBlock[]) {
  return blocks
    .filter((block) => block.type === "link" && block.url)
    .slice(0, 5)
    .map((block) => ({
      title: (block.title || block.text || block.url || "Open source link").replace(/\s+/g, " ").trim(),
      url: block.url ?? "#",
    }));
}
