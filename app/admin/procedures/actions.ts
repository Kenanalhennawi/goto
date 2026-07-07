"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { canApproveProcedures, canArchiveProcedures, canEditProcedures } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type ProcedureAction = "approve_publish" | "unpublish" | "needs_review" | "archive";

export async function approveAndPublish(formData: FormData) {
  await updateProcedureReviewState(formData, "approve_publish");
}

export async function unpublish(formData: FormData) {
  await updateProcedureReviewState(formData, "unpublish");
}

export async function markNeedsReview(formData: FormData) {
  await updateProcedureReviewState(formData, "needs_review");
}

export async function archiveProcedure(formData: FormData) {
  await updateProcedureReviewState(formData, "archive");
}

export async function updateProcedureContent(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) redirect("/admin/procedures");

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

  if (!canEditProcedures(role?.role)) {
    redirect("/admin");
  }

  const title = stringField(formData, "title");
  const category = stringField(formData, "category");
  const serviceCode = nullableStringField(formData, "service_code");
  const serviceType = nullableStringField(formData, "service_type");
  const priority = numberField(formData, "priority");
  const sourcePages = numberListField(formData, "source_pages");

  if (!title || !category) {
    redirectWithStatus(slug, { error: "Title and category are required." });
  }

  if (priority.error) {
    redirectWithStatus(slug, { error: priority.error });
  }

  if (sourcePages.error) {
    redirectWithStatus(slug, { error: sourcePages.error });
  }

  const { data: previous, error: fetchError } = await supabase
    .from("procedure_cards")
    .select("*")
    .eq("slug", slug)
    .single();

  if (fetchError || !previous) {
    redirectWithStatus(slug, { error: fetchError?.message ?? "Procedure was not found." });
  }

  const updatePayload = {
    title,
    category,
    service_code: serviceCode,
    service_type: serviceType,
    summary: nullableStringField(formData, "summary"),
    when_to_use: nullableStringField(formData, "when_to_use"),
    channels: lineListField(formData, "channels"),
    cut_off_time: nullableStringField(formData, "cut_off_time"),
    who_can_action: lineListField(formData, "who_can_action"),
    required_information: lineListField(formData, "required_information"),
    system_steps: lineListField(formData, "system_steps"),
    passenger_advice: lineListField(formData, "passenger_advice"),
    allowed: lineListField(formData, "allowed"),
    not_allowed: lineListField(formData, "not_allowed"),
    escalation_points: lineListField(formData, "escalation_points"),
    fees_charges: nullableStringField(formData, "fees_charges"),
    agent_action: lineListField(formData, "agent_action"),
    rules: lineListField(formData, "rules"),
    exceptions: lineListField(formData, "exceptions"),
    required_approval: nullableStringField(formData, "required_approval"),
    customer_script: nullableStringField(formData, "customer_script"),
    sprint_comment_template: nullableStringField(formData, "sprint_comment_template"),
    salesforce_classification: nullableStringField(formData, "salesforce_classification"),
    source_pages: sourcePages.value,
    keywords: splitListField(formData, "keywords"),
    aliases: splitListField(formData, "aliases"),
    priority: priority.value,
    review_status: previous.review_status === "archived" ? "archived" : "needs_review",
    is_published: false,
    source_confidence: previous.review_status === "archived" ? previous.source_confidence : "needs_review",
  };

  const { data: updated, error: updateError } = await supabase
    .from("procedure_cards")
    .update(updatePayload)
    .eq("slug", slug)
    .select("*")
    .single();

  if (updateError || !updated) {
    redirectWithStatus(slug, {
      error: updateError?.message ?? "Could not update procedure content.",
    });
  }

  const { error: historyError } = await supabase.from("procedure_edit_history").insert({
    procedure_id: previous.id,
    edited_by: user.id,
    previous_data: previous,
    new_data: updated,
  });

  if (historyError) {
    redirectWithStatus(slug, { error: historyError.message });
  }

  revalidatePath("/admin/procedures");
  revalidatePath(`/admin/procedures/${slug}`);
  revalidatePath(`/procedure/${slug}`);
  redirectWithStatus(slug, { saved: "1" });
}

async function updateProcedureReviewState(formData: FormData, action: ProcedureAction) {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) redirect("/admin/procedures");

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

  const canReview = canApproveProcedures(role?.role);
  const canArchive = canArchiveProcedures(role?.role);

  if (!canReview || (action === "archive" && !canArchive)) {
    redirect("/admin");
  }

  const { data: previous, error: fetchError } = await supabase
    .from("procedure_cards")
    .select("*")
    .eq("slug", slug)
    .single();

  if (fetchError || !previous) {
    redirectWithStatus(slug, { error: fetchError?.message ?? "Procedure was not found." });
  }

  const nextState = nextReviewState(action, user.id);
  const { data: updated, error: updateError } = await supabase
    .from("procedure_cards")
    .update(nextState)
    .eq("slug", slug)
    .select("*")
    .single();

  if (updateError || !updated) {
    redirectWithStatus(slug, {
      error: updateError?.message ?? "Could not update procedure review state.",
    });
  }

  const { error: historyError } = await supabase.from("procedure_edit_history").insert({
    procedure_id: previous.id,
    edited_by: user.id,
    previous_data: previous,
    new_data: updated,
  });

  if (historyError) {
    redirectWithStatus(slug, { error: historyError.message });
  }

  revalidatePath("/admin/procedures");
  revalidatePath(`/admin/procedures/${slug}`);
  revalidatePath(`/procedure/${slug}`);
  redirectWithStatus(slug, { [successParam(action)]: "1" });
}

function stringField(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function nullableStringField(formData: FormData, name: string) {
  const value = stringField(formData, name);
  return value || null;
}

function lineListField(formData: FormData, name: string) {
  return String(formData.get(name) ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitListField(formData: FormData, name: string) {
  return String(formData.get(name) ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberListField(formData: FormData, name: string) {
  const rawItems = splitListField(formData, name);
  const numbers = rawItems.map((item) => Number(item));
  if (numbers.some((item) => !Number.isInteger(item) || item < 1)) {
    return { value: [] as number[], error: "Source pages must be valid page numbers." };
  }
  return { value: [...new Set(numbers)].sort((a, b) => a - b), error: "" };
}

function numberField(formData: FormData, name: string) {
  const value = Number(stringField(formData, name) || "0");
  if (!Number.isFinite(value)) {
    return { value: 0, error: `${name} must be a number.` };
  }
  return { value, error: "" };
}

function nextReviewState(action: ProcedureAction, userId: string) {
  switch (action) {
    case "approve_publish":
      return {
        review_status: "approved",
        is_published: true,
        source_confidence: "approved",
        last_reviewed_at: new Date().toISOString(),
        last_reviewed_by: userId,
      };
    case "unpublish":
      return { is_published: false };
    case "needs_review":
      return { review_status: "needs_review", is_published: false };
    case "archive":
      return { review_status: "archived", is_published: false };
  }
}

function redirectWithStatus(slug: string, params: Record<string, string>) {
  const query = new URLSearchParams(params);
  redirect(`/admin/procedures/${slug}?${query.toString()}`);
}

function successParam(action: ProcedureAction) {
  switch (action) {
    case "approve_publish":
      return "approved";
    case "unpublish":
      return "unpublished";
    case "needs_review":
      return "needs_review";
    case "archive":
      return "archived";
  }
}
