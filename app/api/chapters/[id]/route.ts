import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { normalizeExternalUrl } from "@/lib/links";
import type { ContentBlock } from "@/lib/types";
import { canEditProcedures } from "@/lib/permissions";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_TEXT_LENGTH = 250_000;
const MAX_CONTENT_BLOCKS = 1_500;
const MAX_BLOCK_TEXT_LENGTH = 50_000;
const MAX_BLOCK_URL_LENGTH = 4_000;
const MAX_KEYWORDS = 120;

// Handles a direct, small edit to a single chapter made by the quality/admin team in the
// admin UI. Writes the change to edit_history *before* updating the chapter,
// so there's always a rollback path even if something goes wrong after.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid chapter reference." }, { status: 400 });
  }

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

  if (!canEditProcedures(role?.role)) {
    return NextResponse.json(
      { error: "Your account doesn't have edit access." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { body_text, search_keywords } = body as {
    body_text?: string;
    search_keywords?: string[];
    content_blocks?: ContentBlock[];
  };

  if (
    search_keywords !== undefined &&
    (!Array.isArray(search_keywords) ||
      search_keywords.length > MAX_KEYWORDS ||
      search_keywords.some((keyword) => typeof keyword !== "string" || keyword.length > 120))
  ) {
    return NextResponse.json({ error: "Invalid search keywords." }, { status: 400 });
  }

  if (typeof body_text !== "string" || body_text.trim().length === 0) {
    return NextResponse.json(
      { error: "Chapter text can't be empty." },
      { status: 400 }
    );
  }

  if (body_text.length > MAX_BODY_TEXT_LENGTH) {
    return NextResponse.json({ error: "Chapter text is too large." }, { status: 400 });
  }

  if (body.content_blocks !== undefined) {
    if (!Array.isArray(body.content_blocks) || body.content_blocks.length > MAX_CONTENT_BLOCKS) {
      return NextResponse.json({ error: "Invalid chapter content." }, { status: 400 });
    }

    if (!body.content_blocks.every(isValidContentBlockInput)) {
      return NextResponse.json({ error: "Invalid chapter content." }, { status: 400 });
    }
  }

  const { data: existing, error: fetchError } = await supabase
    .from("chapters")
    .select("body_text, search_keywords, content_blocks")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Chapter not found." }, { status: 404 });
  }

  const newContentBlocks = Array.isArray(body.content_blocks)
    ? sanitizeContentBlocks(body.content_blocks)
    : preserveAttachments(body_text, existing.content_blocks);

  const historyEntry = {
    chapter_id: id,
    edited_by: user.id,
    edited_by_email: user.email,
    change_type: "manual_edit",
    previous_body_text: existing.body_text,
    new_body_text: body_text,
    previous_content_blocks: existing.content_blocks,
    new_content_blocks: newContentBlocks,
    previous_keywords: existing.search_keywords,
    new_keywords: search_keywords ?? existing.search_keywords,
  };

  let { error: historyError } = await supabase.from("edit_history").insert(historyEntry);
  if (historyError?.message.includes("previous_content_blocks")) {
    const { previous_content_blocks, new_content_blocks, ...fallbackHistoryEntry } = historyEntry;
    void previous_content_blocks;
    void new_content_blocks;
    const fallback = await supabase.from("edit_history").insert(fallbackHistoryEntry);
    historyError = fallback.error;
  }

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

function preserveAttachments(bodyText: string, existingBlocks: unknown) {
  const existingAttachments = Array.isArray(existingBlocks)
    ? existingBlocks.filter((block: { type?: string }) => block.type !== "text")
    : [];
  return [{ type: "text", text: bodyText }, ...existingAttachments];
}

function sanitizeContentBlocks(blocks: ContentBlock[]) {
  const sanitized: ContentBlock[] = [];

  for (const block of blocks) {
    if (block.type === "text") {
      const text = (block.text ?? "").trim();
      if (text) sanitized.push({ type: "text", text });
      continue;
    }

    if (block.type === "image") {
      if (block.url) {
        sanitized.push({
          type: "image",
          url: block.url,
          filename: block.filename ?? "Reference screenshot",
        });
      }
      continue;
    }

    if (block.type === "link") {
      const url = normalizeExternalUrl(block.url ?? "");
      if (url) {
        sanitized.push({
          type: "link",
          title: (block.title ?? block.text ?? "Open reference").trim(),
          url,
        });
      }
    }
  }

  return sanitized;
}

function isValidContentBlockInput(block: unknown): block is ContentBlock {
  if (!block || typeof block !== "object" || Array.isArray(block)) return false;
  const candidate = block as ContentBlock;
  if (!["text", "image", "link"].includes(candidate.type)) return false;

  if (candidate.text !== undefined && typeof candidate.text !== "string") return false;
  if (candidate.text && candidate.text.length > MAX_BLOCK_TEXT_LENGTH) return false;
  if (candidate.title !== undefined && typeof candidate.title !== "string") return false;
  if (candidate.title && candidate.title.length > 500) return false;
  if (candidate.filename !== undefined && typeof candidate.filename !== "string") return false;
  if (candidate.filename && candidate.filename.length > 500) return false;
  if (candidate.url !== undefined && candidate.url !== null && typeof candidate.url !== "string") return false;
  if (candidate.url && candidate.url.length > MAX_BLOCK_URL_LENGTH) return false;
  return true;
}
