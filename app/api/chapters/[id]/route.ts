import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// Handles a direct, small edit to a single chapter made by quality team in the
// admin UI. Writes the change to edit_history *before* updating the chapter,
// so there's always a rollback path even if something goes wrong after.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!role || !["quality", "admin", "owner"].includes(role.role)) {
    return NextResponse.json(
      { error: "Your account doesn't have edit access." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { body_text, search_keywords } = body as {
    body_text?: string;
    search_keywords?: string[];
  };

  if (typeof body_text !== "string" || body_text.trim().length === 0) {
    return NextResponse.json(
      { error: "Chapter text can't be empty." },
      { status: 400 }
    );
  }

  const { data: existing, error: fetchError } = await supabase
    .from("chapters")
    .select("body_text, search_keywords, content_blocks")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Chapter not found." }, { status: 404 });
  }

  // Manual edits happen in a plain text box, which has no way to say where
  // an image should sit within the new text. To avoid silently deleting the
  // chapter's screenshots on every edit, we keep them and place them after
  // the edited text rather than losing them. Re-running a PDF sync later
  // will restore full original inline positioning.
  const existingImages = Array.isArray(existing.content_blocks)
    ? existing.content_blocks.filter((b: { type: string }) => b.type === "image")
    : [];
  const newContentBlocks = [{ type: "text", text: body_text }, ...existingImages];

  const { error: historyError } = await supabase.from("edit_history").insert({
    chapter_id: id,
    edited_by: user.id,
    edited_by_email: user.email,
    change_type: "manual_edit",
    previous_body_text: existing.body_text,
    new_body_text: body_text,
    previous_keywords: existing.search_keywords,
    new_keywords: search_keywords ?? existing.search_keywords,
  });

  if (historyError) {
    return NextResponse.json(
      { error: "Couldn't save edit history. Change was not applied." },
      { status: 500 }
    );
  }

  const { error: updateError } = await supabase
    .from("chapters")
    .update({
      body_text,
      content_blocks: newContentBlocks,
      search_keywords: search_keywords ?? existing.search_keywords,
      word_count: body_text.split(/\s+/).filter(Boolean).length,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: "Edit was logged but couldn't be applied. Contact an admin." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
