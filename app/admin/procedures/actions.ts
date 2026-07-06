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
