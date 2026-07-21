import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { canManageUsers } from "@/lib/permissions";
import { resolveChapterIdentity, type ExistingChapter } from "@/lib/sync-identity";

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

  // Load all existing chapters once so identity can be resolved by stable
  // attributes (slug / title / id) rather than by the volatile chapter_number.
  const { data: existingChapters, error: existingListError } = await supabase
    .from("chapters")
    .select("id, slug, title, chapter_number");

  if (existingListError) {
    return NextResponse.json({ error: "Couldn't load existing chapters." }, { status: 500 });
  }

  const existingRefs: ExistingChapter[] = existingChapters ?? [];

  let publishedCount = 0;
  const failures: string[] = [];

  for (const change of approvedChanges) {
    // Resolve identity by slug -> title -> id. chapter_number is used only in
    // diagnostic messages, never to decide insert vs update.
    const identity = resolveChapterIdentity(
      { title: change.title, chapter_number: change.chapter_number },
      existingRefs
    );
    const label = `Ch. ${change.chapter_number} (${identity.slug})`;
    const wordCount = (change.new_body_text ?? "").split(/\s+/).filter(Boolean).length;

    // INSERT only when no existing chapter matches. This guarantees we never
    // violate chapters_slug_key by inserting a slug that already exists.
    if (identity.operation === "insert") {
      const { data: inserted, error: insertError } = await supabase
        .from("chapters")
        .insert({
          chapter_number: change.chapter_number,
          title: change.title,
          slug: identity.slug,
          search_keywords: change.new_keywords ?? [],
          body_text: change.new_body_text,
          content_blocks: change.new_content_blocks ?? [],
          word_count: wordCount,
          source_version: syncRun?.source_version ?? null,
          updated_by: user.id,
        })
        .select("id")
        .single();
      if (insertError) {
        failures.push(`${label}: ${insertError.message}`);
      } else {
        publishedCount++;
        // Keep the in-memory list current so a later change with the same slug
        // resolves to this new row instead of attempting a second insert.
        if (inserted) {
          existingRefs.push({
            id: inserted.id,
            slug: identity.slug,
            title: change.title,
            chapter_number: change.chapter_number,
          });
        }
      }
      continue;
    }

    // UPDATE the matched chapter by its stable id. Fetch its current content so
    // existing content_blocks/keywords are preserved and edit_history is logged.
    const { data: existingChapter, error: existingError } = await supabase
      .from("chapters")
      .select("id, body_text, search_keywords, content_blocks")
      .eq("id", identity.existingId)
      .single();

    if (existingError || !existingChapter) {
      failures.push(`${label}: existing chapter not found`);
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
      failures.push(`${label}: edit history was not saved`);
      continue;
    }

    const { error: updateError } = await supabase
      .from("chapters")
      .update({
        // chapter_number may shift when a chapter is inserted earlier; keep it
        // in sync while identity itself stays anchored to the stable id/slug.
        chapter_number: change.chapter_number,
        title: change.title,
        body_text: change.new_body_text,
        content_blocks: change.new_content_blocks ?? existingChapter.content_blocks ?? [],
        search_keywords: change.new_keywords ?? existingChapter.search_keywords,
        word_count: wordCount,
        source_version: syncRun?.source_version ?? null,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", existingChapter.id);

    if (updateError) {
      failures.push(`${label}: ${updateError.message}`);
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
