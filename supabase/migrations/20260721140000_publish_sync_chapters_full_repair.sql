-- ============================================================
-- Follow-up to:
--   20260721120000_publish_sync_chapters_atomically.sql
--   20260721130000_publish_sync_chapters_fix.sql
--
-- Full atomic chapter-ordering repair. The earlier versions derived the
-- temporary-move set implicitly from update operations, so existing rows that
-- were skipped as "already applied" — yet still occupied a final number needed
-- by another chapter — were never moved. Assigning finals then collided with
-- chapters_chapter_number_key (23505).
--
-- This replaces the function (CREATE OR REPLACE; earlier migrations kept as
-- history) with a signature that takes an EXPLICIT, complete list of ids to
-- move temporarily, computed by buildPublishPlan from the whole 79-chapter
-- target state. It also supports a number-only "renumber" op (no content write,
-- no edit_history) so already-correct content can be repositioned cheaply.
--
-- One transaction. Any validation error or write failure rolls everything back.
-- SECURITY INVOKER (runs as the calling admin under existing RLS). Pinned
-- search_path. Only touches public.chapters and public.edit_history.
--
-- p_operations: JSONB array; each element:
--   { "op": "insert"|"update"|"renumber",
--     "chapterId": "<uuid>"|null, "slug": "<slug>", "finalNumber": <int>,
--     "title": "<t>", "bodyText": "<t>", "contentBlocks": [...]|null,
--     "keywords": ["..."]|null, "wordCount": <int> }
-- p_temporary_move_ids: uuid[] — every existing id that must leave the final
--   number range before finals are assigned (unique).
-- Returns: {"published": <int>, "failed": []}
-- ============================================================

create or replace function public.publish_sync_chapters(
  p_operations jsonb,
  p_temporary_move_ids uuid[],
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
  v_temp_base int;
  v_counter int := 0;
  v_final_numbers int[] := '{}';
  v_slugs text[] := '{}';
  v_move_ids uuid[];
  v_stranded int;
  v_blocker text;
begin
  if p_operations is null or jsonb_typeof(p_operations) <> 'array' then
    raise exception 'SYNC_INVALID_PAYLOAD: p_operations must be a JSON array';
  end if;

  -- De-duplicate / validate the temporary-move id list.
  v_move_ids := coalesce(
    (select array_agg(distinct m) from unnest(coalesce(p_temporary_move_ids, '{}'::uuid[])) as m),
    '{}'::uuid[]
  );

  -- Validation: unique finals + slugs; positive numbers; every required final
  -- number is free once the move set is out of the way.
  for op in select value from jsonb_array_elements(p_operations)
  loop
    v_final := (op->>'finalNumber')::int;
    if v_final is null or v_final < 1 then
      raise exception 'SYNC_INVALID_FINAL_NUMBER: % (%)', v_final, coalesce(op->>'slug', '?');
    end if;
    if v_final = any(v_final_numbers) then
      raise exception 'SYNC_DUPLICATE_FINAL_NUMBER: %', v_final;
    end if;
    if (op->>'slug') = any(v_slugs) then
      raise exception 'SYNC_DUPLICATE_SLUG: %', op->>'slug';
    end if;
    v_final_numbers := array_append(v_final_numbers, v_final);
    v_slugs := array_append(v_slugs, op->>'slug');

    -- Any occupant of this final number that is NOT being moved (and is not the
    -- op's own target) would collide. Fail loudly with the blocking slug.
    select slug into v_blocker
    from public.chapters
    where chapter_number = v_final
      and not (id = any(v_move_ids))
      and id is distinct from nullif(op->>'chapterId','')::uuid
    limit 1;
    if v_blocker is not null then
      raise exception
        'SYNC_FINAL_NUMBER_CONFLICT: number % is held by "%" which is not in the move set',
        v_final, v_blocker;
    end if;
  end loop;

  -- Dynamic, always-free temporary range: strictly above the current maximum.
  select coalesce(max(chapter_number), 0) + 1000 into v_temp_base from public.chapters;

  -- Phase 1: move every supplied id to a unique temporary number.
  if array_length(v_move_ids, 1) is not null then
    foreach v_id in array v_move_ids
    loop
      v_counter := v_counter + 1;
      update public.chapters
        set chapter_number = v_temp_base + v_counter
        where id = v_id;
    end loop;
  end if;

  -- Phase 2: apply operations. Final numbers are free now.
  for op in select value from jsonb_array_elements(p_operations)
  loop
    if op->>'op' = 'renumber' then
      -- Number-only repair: no content rewrite, no history.
      update public.chapters
        set chapter_number = (op->>'finalNumber')::int,
            updated_at = now(),
            updated_by = p_editor
        where id = (op->>'chapterId')::uuid;
      v_published := v_published + 1;

    elsif op->>'op' = 'update' then
      v_id := (op->>'chapterId')::uuid;

      select body_text, search_keywords, content_blocks
        into v_prev_body, v_prev_keywords, v_prev_blocks
        from public.chapters where id = v_id;

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

  -- Safety net: nothing may remain parked in the temporary range.
  select count(*) into v_stranded from public.chapters where chapter_number >= v_temp_base;
  if v_stranded > 0 then
    raise exception 'SYNC_STRANDED_TEMP: % chapter(s) left in the temporary range', v_stranded;
  end if;

  return jsonb_build_object('published', v_published, 'failed', '[]'::jsonb);
end;
$$;

-- Replace the older 4-arg overload so only the new signature remains callable.
drop function if exists public.publish_sync_chapters(jsonb, uuid, text, text);

grant execute on function public.publish_sync_chapters(jsonb, uuid[], uuid, text, text) to authenticated;
revoke execute on function public.publish_sync_chapters(jsonb, uuid[], uuid, text, text) from anon;
