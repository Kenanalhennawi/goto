import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { ProcedureCard, UserRole } from "@/lib/types";
import { canReviewProcedures } from "@/lib/permissions";

export interface ProcedureSourceChapter {
  id: string;
  chapter_number: number;
  title: string;
  slug: string;
  source_version?: string | null;
  updated_at?: string | null;
}

export interface ProcedureCardWithChapter extends ProcedureCard {
  chapters: ProcedureSourceChapter | null;
}

export async function getProcedureBySlug(slug: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: roleRow } = user
    ? await supabase.from("user_roles").select("role").eq("user_id", user.id).single()
    : { data: null };
  const role = roleRow?.role as UserRole | undefined;
  const canManage = canReviewProcedures(role);

  let query = supabase
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
        "source_confidence",
        "last_reviewed_at",
        "last_reviewed_by",
        "created_at",
        "updated_at",
        "chapters(id, chapter_number, title, slug, source_version, updated_at)",
      ].join(", ")
    )
    .eq("slug", slug);

  if (!canManage) {
    query = query.eq("is_published", true).eq("review_status", "approved");
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("Unable to fetch procedure", error.message);
    return { procedure: null, canManage };
  }

  return {
    procedure: data as ProcedureCardWithChapter | null,
    canManage,
  };
}

export async function getProceduresForChapter(chapterId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("procedure_cards")
    .select("id, title, slug, category, review_status, is_published, priority")
    .eq("chapter_id", chapterId)
    .order("priority", { ascending: false })
    .order("title", { ascending: true });

  if (error) {
    console.error("Unable to fetch procedures for chapter", error.message);
    return [];
  }

  return data ?? [];
}
