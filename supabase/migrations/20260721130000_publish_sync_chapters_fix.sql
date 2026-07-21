-- ============================================================
-- Follow-up to 20260721120000_publish_sync_chapters_atomically.sql
--
-- Diagnostic + hardening for the atomic chapter publish. The previous version
-- could still roll back with a generic message when:
--   1. A shifted chapter's FINAL number was still held by a chapter that was
--      not part of the publish batch (e.g. a neighbour that wasn't approved).
--      The final-range write then hit chapters_chapter_number_key.
--   2. The hard-coded +100000 temp offset was assumed free without checking.
--
-- This replaces the function (CREATE OR REPLACE — the earlier migration is left
-- intact as history) with:
--   - a pre-write validation phase that RAISEs a specific, coded error naming
--     the exact blocking chapter, instead of a bare unique-violation;
--   - a DYNAMIC temp offset computed from the current max(chapter_number), so
--     the temporary range is always above every existing row (including any
--     row already >= 100000) and never collides;
--   - unchanged atomic, SECURITY INVOKER, pinned search_path behaviour.
--
-- Still only touches public.chapters and public.edit_history. Still one
-- transaction: any RAISE rolls the whole batch back.
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
  op jsonb;
  v_id uuid;
  v_final int;
  v_prev_body text;
  v_prev_keywords text[];
  v_prev_blocks jsonb;
  v_published int := 0;
  v_moved_ids uuid[] := '{}';
  v_temp_base int;
  v_counter int := 0;
  v_blocker text;
begin
  if p_operations is null or jsonb_typeof(p_operations) <> 'array' then
    raise exception 'SYNC_INVALID_PAYLOAD: p_operations must be a JSON array';
  end if;

  -- Collect the ids of every chapter this batch will move (all updates), so we
  -- can tell an in-batch move apart from a real external collision.
  for op in select value from jsonb_array_elements(p_operations)
  loop
    if op->>'op' = 'update' then
      if op->>'chapterId' is null then
        raise exception 'SYNC_INVALID_PAYLOAD: update op missing chapterId';
      end if;
      v_moved_ids := array_append(v_moved_ids, (op->>'chapterId')::uuid);
    end if;
  end loop;

  -- Validation phase: a final number must not be permanently held by a chapter
  -- that this batch does not move. Fail loudly BEFORE any write.
  for op in select value from jsonb_array_elements(p_operations)
  loop
    v_final := (op->>'finalNumber')::int;
    if v_final is null or v_final < 1 then
      raise exception 'SYNC_INVALID_FINAL_NUMBER: % (%)', v_final, coalesce(op->>'slug', '?');
    end if;

    select slug into v_blocker
    from public.chapters
    where chapter_number = v_final
      and not (id = any(v_moved_ids))
    limit 1;

    if v_blocker is not null then
      raise exception
        'SYNC_FINAL_NUMBER_CONFLICT: number % is still held by chapter "%" which is not in this batch',
        v_final, v_blocker;
    end if;
  end loop;

  -- Dynamic, always-free temporary range: above the current maximum number.
  select coalesce(max(chapter_number), 0) + 1000 into v_temp_base from public.chapters;

  -- Phase 1: move every UPDATE target into the temporary range (unique per row).
  for op in select value from jsonb_array_elements(p_operations)
  loop
    if op->>'op' = 'update' then
      v_counter := v_counter + 1;
      update public.chapters
        set chapter_number = v_temp_base + v_counter
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
      raise exception 'SYNC_INVALID_PAYLOAD: unknown op "%"', op->>'op';
    end if;
  end loop;

  return jsonb_build_object('published', v_published, 'failed', '[]'::jsonb);
end;
$$;

grant execute on function public.publish_sync_chapters(jsonb, uuid, text, text) to authenticated;
-- Ordinary end-users never call this directly; the route checks canManageUsers.
revoke execute on function public.publish_sync_chapters(jsonb, uuid, text, text) from anon;
