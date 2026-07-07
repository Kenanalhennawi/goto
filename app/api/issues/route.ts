import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_SECTION_ID_LENGTH = 160;

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid issue report." }, { status: 400 });
  }

  const chapterId = stringValue(body.chapter_id);
  const chapterSlug = stringValue(body.chapter_slug);
  const sectionId = stringValue(body.section_id);
  const message = stringValue(body.message).trim();

  if (message.length < 3 || message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: "Write a short issue note before sending." },
      { status: 400 }
    );
  }

  if (sectionId && sectionId.length > MAX_SECTION_ID_LENGTH) {
    return NextResponse.json({ error: "Invalid issue report." }, { status: 400 });
  }

  if (!chapterId && !chapterSlug) {
    return NextResponse.json({ error: "Invalid chapter reference." }, { status: 400 });
  }

  if (chapterId && !UUID_PATTERN.test(chapterId)) {
    return NextResponse.json({ error: "Invalid chapter reference." }, { status: 400 });
  }

  if (chapterSlug && !SLUG_PATTERN.test(chapterSlug)) {
    return NextResponse.json({ error: "Invalid chapter reference." }, { status: 400 });
  }

  const { data: chapter, error: chapterError } = chapterId
    ? await supabase.from("chapters").select("id, slug").eq("id", chapterId).maybeSingle()
    : await supabase.from("chapters").select("id, slug").eq("slug", chapterSlug).maybeSingle();

  if (chapterError) {
    console.error("Issue report chapter lookup failed", chapterError);
    return NextResponse.json({ error: "Could not submit issue report." }, { status: 500 });
  }

  if (!chapter || (chapterSlug && chapter.slug !== chapterSlug)) {
    return NextResponse.json({ error: "Invalid chapter reference." }, { status: 400 });
  }

  const { error } = await supabase.from("content_issues").insert({
    chapter_id: chapter.id,
    chapter_slug: chapter.slug,
    section_id: sectionId || null,
    message,
    reported_by: user?.id ?? null,
    reporter_email: user?.email ?? null,
  });

  if (error) {
    console.error("Issue report insert failed", error);
    return NextResponse.json({ error: "Could not submit issue report." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
