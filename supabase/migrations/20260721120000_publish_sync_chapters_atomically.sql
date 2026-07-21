-- ============================================================
-- Atomic chapter publish for PDF sync runs.
--
-- Problem: inserting a chapter in the middle (e.g. MEDA) shifts every later
-- chapter_number by +1. chapter_number is UNIQUE, so updating rows one at a
-- time collides ("duplicate key value violates chapters_chapter_number_key")
-- because a shifted row's target number is still held by its un-moved neighbour.
--
-- Fix: run all writes inside ONE transaction in two phases:
--   Phase 1 — move every UPDATE target out of the live number range by adding a
--             large temp offset (100000), so the whole final range is free.
--   Phase 2 — write each update's content + final number, and insert genuinely
--             new chapters. Because the caller (buildPublishPlan) guarantees the
--             batch has unique slugs and unique final numbers, and every touched
--             existing row was moved to the temp range first, no final
--             assignment can collide.
--
-- Idempotency: the caller excludes already-applied rows from p_operations, so a
-- retry after a partial publish only writes the rows that still differ, and
-- edit_history is not filled with no-op entries.
--
-- Safety:
--   - SECURITY INVOKER: runs with the caller's role, respecting existing RLS on
--     chapters / edit_history (the same permissions the route already used for
--     direct writes). No service-role escalation.
--   - Pinned search_path. No dynamic SQL.
--   - Only touches public.chapters and public.edit_history. Does not read or
--     write sync_runs / sync_staged_changes (those stay owned by the route).
--   - The whole function is one transaction; any error rolls back all writes,
--     so a failure never leaves chapters stranded at temporary numbers.
--
-- Input p_operations: JSONB array from buildPublishPlan, each element:
--   {
--     "op": "update" | "insert",
--     "chapterId": "<uuid>" | null,   -- required for update
--     "slug": "<slug>",               -- required for insert
--     "finalNumber": <int>,
--     "title": "<title>",
--     "bodyText": "<text>",
--     "contentBlocks": [...] | null,  -- null keeps the existing blocks (update)
--     "keywords": ["..."] | null,     -- null keeps the existing keywords (update)
--     "wordCount": <int>
--   }
-- Returns: {"published": <int>, "failed": []}
-- ============================================================

create or replace function public.publish_sync_chapters(
  p_operations jsonb,
  p_editor uuid,
  p_editor_email text,
  p_source_version text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  temp_offset constant int := 100000;
  op jsonb;
  v_id uuid;
  v_prev_body text;
  v_prev_keywords text[];
  v_prev_blocks jsonb;
  v_published int := 0;
begin
  if p_operations is null or jsonb_typeof(p_operations) <> 'array' then
    raise exception 'publish_sync_chapters: p_operations must be a JSON array';
  end if;

  -- Phase 1: move every UPDATE target out of the final number range.
  for op in select value from jsonb_array_elements(p_operations)
  loop
    if op->>'op' = 'update' then
      if op->>'chapterId' is null then
        raise exception 'publish_sync_chapters: update op missing chapterId';
      end if;
      update public.chapters
        set chapter_number = chapter_number + temp_offset
        where id = (op->>'chapterId')::uuid;
    end if;
  end loop;

  -- Phase 2: apply content updates with final numbers, then inserts.
  for op in select value from jsonb_array_elements(p_operations)
  loop
    if op->>'op' = 'update' then
      v_id := (op->>'chapterId')::uuid;

      select body_text, search_keywords, content_blocks
        into v_prev_body, v_prev_keywords, v_prev_blocks
        from public.chapters
        where id = v_id;

      -- Preserve manual-edit history, same shape as the route's previous logic.
      insert into public.edit_history (
        chapter_id, edited_by, edited_by_email, change_type,
        previous_body_text, new_body_text, previous_keywords, new_keywords,
        source_version
      ) values (
        v_id, p_editor, p_editor_email, 'pdf_sync',
        v_prev_body, op->>'bodyText', v_prev_keywords,
        case
          when op->'keywords' is null or jsonb_typeof(op->'keywords') = 'null' then null
          else array(select jsonb_array_elements_text(op->'keywords'))
        end,
        p_source_version
      );

      update public.chapters set
        chapter_number  = (op->>'finalNumber')::int,
        title           = op->>'title',
        body_text       = op->>'bodyText',
        content_blocks  = case
                            when op->'contentBlocks' is null
                              or jsonb_typeof(op->'contentBlocks') = 'null'
                            then coalesce(v_prev_blocks, '[]'::jsonb)
                            else op->'contentBlocks'
                          end,
        search_keywords = case
                            when op->'keywords' is null
                              or jsonb_typeof(op->'keywords') = 'null'
                            then search_keywords
                            else array(select jsonb_array_elements_text(op->'keywords'))
                          end,
        word_count      = (op->>'wordCount')::int,
        source_version  = p_source_version,
        updated_at      = now(),
        updated_by      = p_editor
      where id = v_id;

      v_published := v_published + 1;

    elsif op->>'op' = 'insert' then
      insert into public.chapters (
        chapter_number, title, slug, search_keywords, body_text,
        content_blocks, word_count, source_version, updated_by
      ) values (
        (op->>'finalNumber')::int,
        op->>'title',
        op->>'slug',
        case
          when op->'keywords' is null or jsonb_typeof(op->'keywords') = 'null' then '{}'::text[]
          else array(select jsonb_array_elements_text(op->'keywords'))
        end,
        op->>'bodyText',
        case
          when op->'contentBlocks' is null
            or jsonb_typeof(op->'contentBlocks') = 'null'
          then '[]'::jsonb
          else op->'contentBlocks'
        end,
        (op->>'wordCount')::int,
        p_source_version,
        p_editor
      );

      v_published := v_published + 1;

    else
      raise exception 'publish_sync_chapters: unknown op "%"', op->>'op';
    end if;
  end loop;

  return jsonb_build_object('published', v_published, 'failed', '[]'::jsonb);
end;
$$;

-- Callable by signed-in admins via the authenticated role; the API route still
-- checks canManageUsers() before invoking, and RLS on the tables applies.
grant execute on function public.publish_sync_chapters(jsonb, uuid, text, text) to authenticated;
