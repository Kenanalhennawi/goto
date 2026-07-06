"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
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

  if (!role || !["quality", "admin", "owner"].includes(role.role)) {
    redirect("/admin");
  }

  const title = stringField(formData, "title");
  const category = stringField(formData, "category");
  const priority = numberField(formData, "priority");
  const sourcePages = numberListField(formData, "source_pages");

  if (!title || !category) {
    throw new Error("Title and category are required.");
  }

  const { data: previous, error: fetchError } = await supabase
    .from("procedure_cards")
    .select("*")
    .eq("slug", slug)
    .single();

  if (fetchError || !previous) {
    redirect("/admin/procedures");
  }

  const updatePayload = {
    title,
    category,
    summary: nullableStringField(formData, "summary"),
    when_to_use: nullableStringField(formData, "when_to_use"),
    agent_action: lineListField(formData, "agent_action"),
    rules: lineListField(formData, "rules"),
    exceptions: lineListField(formData, "exceptions"),
    required_approval: nullableStringField(formData, "required_approval"),
    customer_script: nullableStringField(formData, "customer_script"),
    sprint_comment_template: nullableStringField(formData, "sprint_comment_template"),
    salesforce_classification: nullableStringField(formData, "salesforce_classification"),
    source_pages: sourcePages,
    keywords: splitListField(formData, "keywords"),
    aliases: splitListField(formData, "aliases"),
    priority,
    review_status: previous.review_status === "archived" ? "archived" : "needs_review",
    is_published: false,
  };

  const { data: updated, error: updateError } = await supabase
    .from("procedure_cards")
    .update(updatePayload)
    .eq("slug", slug)
    .select("*")
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? "Could not update procedure content.");
  }

  const { error: historyError } = await supabase.from("procedure_edit_history").insert({
    procedure_id: previous.id,
    edited_by: user.id,
    previous_data: previous,
    new_data: updated,
  });

  if (historyError) {
    throw new Error(historyError.message);
  }

  revalidatePath("/admin/procedures");
  revalidatePath(`/admin/procedures/${slug}`);
  revalidatePath(`/procedure/${slug}`);
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

  const userRole = role?.role;
  const canReview = userRole && ["quality", "admin", "owner"].includes(userRole);
  const canArchive = userRole && ["admin", "owner"].includes(userRole);

  if (!canReview || (action === "archive" && !canArchive)) {
    redirect("/admin");
  }

  const { data: previous, error: fetchError } = await supabase
    .from("procedure_cards")
    .select("*")
    .eq("slug", slug)
    .single();

  if (fetchError || !previous) {
    redirect("/admin/procedures");
  }

  const nextState = nextReviewState(action);
  const { data: updated, error: updateError } = await supabase
    .from("procedure_cards")
    .update(nextState)
    .eq("slug", slug)
    .select("*")
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? "Could not update procedure review state.");
  }

  const { error: historyError } = await supabase.from("procedure_edit_history").insert({
    procedure_id: previous.id,
    edited_by: user.id,
    previous_data: previous,
    new_data: updated,
  });

  if (historyError) {
    throw new Error(historyError.message);
  }

  revalidatePath("/admin/procedures");
  revalidatePath(`/admin/procedures/${slug}`);
  revalidatePath(`/procedure/${slug}`);
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
    throw new Error("Source pages must be valid page numbers.");
  }
  return [...new Set(numbers)].sort((a, b) => a - b);
}

function numberField(formData: FormData, name: string) {
  const value = Number(stringField(formData, name) || "0");
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a number.`);
  }
  return value;
}

function nextReviewState(action: ProcedureAction) {
  switch (action) {
    case "approve_publish":
      return { review_status: "approved", is_published: true };
    case "unpublish":
      return { is_published: false };
    case "needs_review":
      return { review_status: "needs_review", is_published: false };
    case "archive":
      return { review_status: "archived", is_published: false };
  }
}
