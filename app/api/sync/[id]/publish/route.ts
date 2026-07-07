import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { canManageUsers } from "@/lib/permissions";

export async function POST(
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

  if (!canManageUsers(role?.role)) {
    return NextResponse.json(
      { error: "Only admins can publish live content." },
      { status: 403 }
    );
  }

  const { data: syncRun } = await supabase
    .from("sync_runs")
    .select("source_version")
    .eq("id", id)
    .single();

  const { data: approvedChanges, error: fetchError } = await supabase
    .from("sync_staged_changes")
    .select("chapter_number, title, is_new_chapter, new_body_text, new_content_blocks, new_keywords")
    .eq("sync_run_id", id)
    .eq("approved", true);

  if (fetchError) {
    return NextResponse.json({ error: "Couldn't load approved changes." }, { status: 500 });
  }

  if (!approvedChanges || approvedChanges.length === 0) {
    return NextResponse.json({ error: "No approved changes to publish." }, { status: 400 });
  }

  let publishedCount = 0;
  const failures: string[] = [];

  for (const change of approvedChanges) {
    if (change.is_new_chapter) {
      const { error: insertError } = await supabase.from("chapters").insert({
        chapter_number: change.chapter_number,
        title: change.title,
        slug: slugify(change.title),
        search_keywords: change.new_keywords ?? [],
        body_text: change.new_body_text,
        content_blocks: change.new_content_blocks ?? [],
        word_count: change.new_body_text.split(/\s+/).filter(Boolean).length,
        source_version: syncRun?.source_version ?? null,
        updated_by: user.id,
      });
      if (insertError) {
        failures.push(`Ch. ${change.chapter_number}: ${insertError.message}`);
      } else {
        publishedCount++;
      }
      continue;
    }

    const { data: existingChapter, error: existingError } = await supabase
      .from("chapters")
      .select("id, body_text, search_keywords, content_blocks")
      .eq("chapter_number", change.chapter_number)
      .single();

    if (existingError || !existingChapter) {
      failures.push(`Ch. ${change.chapter_number}: existing chapter not found`);
      continue;
    }

    // Log to edit_history before applying, same as manual edits
    const { error: historyError } = await supabase.from("edit_history").insert({
      chapter_id: existingChapter.id,
      edited_by: user.id,
      edited_by_email: user.email,
      change_type: "pdf_sync",
      previous_body_text: existingChapter.body_text,
      new_body_text: change.new_body_text,
      previous_keywords: existingChapter.search_keywords,
      new_keywords: change.new_keywords,
      source_version: syncRun?.source_version ?? null,
    });

    if (historyError) {
      failures.push(`Ch. ${change.chapter_number}: edit history was not saved`);
      continue;
    }

    const { error: updateError } = await supabase
      .from("chapters")
      .update({
        body_text: change.new_body_text,
        content_blocks: change.new_content_blocks ?? existingChapter.content_blocks ?? [],
        search_keywords: change.new_keywords ?? existingChapter.search_keywords,
        word_count: change.new_body_text.split(/\s+/).filter(Boolean).length,
        source_version: syncRun?.source_version ?? null,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", existingChapter.id);

    if (updateError) {
      failures.push(`Ch. ${change.chapter_number}: ${updateError.message}`);
    } else {
      publishedCount++;
    }
  }

  if (failures.length > 0) {
    return NextResponse.json(
      {
        error: "Publish stopped because one or more approved changes failed.",
        published: publishedCount,
        failures,
      },
      { status: 500 }
    );
  }

  const { error: runUpdateError } = await supabase
    .from("sync_runs")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id);

  if (runUpdateError) {
    return NextResponse.json(
      { error: "Changes were published, but the sync run status could not be updated." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, published: publishedCount });
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .slice(0, 60);
}
