import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const body = (await request.json().catch(() => ({}))) as {
    chapter_id?: string;
    chapter_slug?: string;
    section_id?: string;
    message?: string;
  };

  const message = body.message?.trim() ?? "";
  if (!body.chapter_id || !body.chapter_slug || message.length < 3 || message.length > 2000) {
    return NextResponse.json(
      { error: "Write a short issue note before sending." },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("content_issues").insert({
    chapter_id: body.chapter_id,
    chapter_slug: body.chapter_slug,
    section_id: body.section_id ?? null,
    message,
    reported_by: user?.id ?? null,
    reporter_email: user?.email ?? null,
  });

  if (error) {
    return NextResponse.json(
      { error: "Issue reports are not set up yet. Run the content_issues SQL migration." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
