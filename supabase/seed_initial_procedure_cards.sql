-- ============================================================
-- Seed: initial private procedure card stubs
-- Run after supabase/migration_procedure_cards.sql.
--
-- Safety:
-- - Creates needs_review, unpublished cards only.
-- - Does not make any procedure public.
-- - Does not overwrite cards that have already been approved or published.
-- ============================================================

with seed (
  title,
  slug,
  category,
  aliases,
  keywords,
  priority,
  title_patterns,
  body_patterns
) as (
  values
    (
      'Minimum Connection Time',
      'minimum-connection-time',
      'Connection',
      array['MCT', 'minimum connection time', 'connection time', 'transfer time'],
      array['MCT', 'minimum connection time', 'connection', 'transfer'],
      100,
      array['Connection and Transfers', 'Terminal 3 Operation'],
      array['MCT', 'Minimum Connection Time', 'connection transfer', 'transfer time']
    ),
    (
      'Auto Split OD',
      'auto-split-od',
      'Booking',
      array['Auto Split OD', 'FZ-FZ connection booking', 'OD split'],
      array['Auto Split OD', 'FZ-FZ', 'connection booking', 'OD split'],
      90,
      array['Fare Types'],
      array['Auto Split One-Direction', 'Auto Split OD', 'FZ-FZ connection booking']
    ),
    (
      'Dubai Stopover',
      'dubai-stopover',
      'Booking',
      array['DSO', 'Dubai Stopover', 'stopover'],
      array['DSO', 'Dubai Stopover', 'stopover'],
      90,
      array['Dubai Stopover'],
      array['DSO', 'Dubai Stopover', 'stopover']
    ),
    (
      'Lounge Access during OLCI',
      'lounge-access-during-olci',
      'Check-in',
      array['Lounge OLCI', 'lounge access', 'online check-in lounge'],
      array['lounge', 'OLCI', 'online check-in', 'check-in'],
      80,
      array['Ways to Check-in', 'Upgrade to Business Class'],
      array['lounge access during OLCI', 'lounge', 'online check-in']
    ),
    (
      'Extra Seat / CBBG',
      'extra-seat-cbbg',
      'Seats',
      array['EXST', 'CBBG', 'extra seat', 'cabin baggage seat'],
      array['EXST', 'CBBG', 'extra seat', 'cabin baggage seat', 'seat'],
      95,
      array['Seat'],
      array['EXST', 'CBBG', 'extra seat', 'cabin baggage seat']
    ),
    (
      'Sporting Equipment',
      'sporting-equipment',
      'Baggage & SSR',
      array['SPEQ', 'sports equipment', 'sporting SSR', 'weapon'],
      array['SPEQ', 'sporting equipment', 'sports equipment', 'weapon'],
      95,
      array['Sporting Equipment'],
      array['SPEQ', 'sporting equipment', 'sports equipment', 'weapon']
    ),
    (
      'Falcon Handling',
      'falcon-handling',
      'Special Handling',
      array['falcon', 'birds', 'animal', 'cabin bird'],
      array['falcon', 'birds', 'animal', 'cabin bird'],
      90,
      array['Falcon Handling'],
      array['falcon', 'birds', 'cabin bird']
    ),
    (
      'Baggage Upgrade',
      'baggage-upgrade',
      'Baggage',
      array['baggage upgrade', 'excess baggage', 'baggage rates'],
      array['baggage upgrade', 'excess baggage', 'baggage rates', 'baggage'],
      80,
      array['Baggage'],
      array['baggage upgrade', 'excess baggage', 'baggage rates']
    ),
    (
      'Flight Disruption',
      'flight-disruption',
      'Disruption',
      array['FDIS', 'disruption', 'schedule change', 'cancellation', 'refund due to disruption'],
      array['FDIS', 'flight disruption', 'schedule change', 'cancellation', 'refund'],
      100,
      array['Flight Disruption'],
      array['FDIS', 'flight disruption', 'schedule change', 'refund due to disruption']
    ),
    (
      'Name Correction',
      'name-correction',
      'Booking',
      array['name correction', 'name change', 'NCFB', 'NCFE'],
      array['name correction', 'name change', 'NCFB', 'NCFE'],
      80,
      array['Name Change', 'Name Correction'],
      array['name correction', 'name change', 'NCFB', 'NCFE']
    ),
    (
      'Wheelchair',
      'wheelchair',
      'Special Assistance',
      array['WCHR', 'WCHS', 'WCHC', 'WCBD', 'WCBW', 'WCLB', 'lithium battery'],
      array['WCHR', 'WCHS', 'WCHC', 'WCBD', 'WCBW', 'WCLB', 'wheelchair', 'lithium battery'],
      85,
      array['Wheelchair'],
      array['WCHR', 'WCHS', 'WCHC', 'WCBD', 'WCBW', 'WCLB', 'lithium battery']
    ),
    (
      'Interline / Connection',
      'interline-connection',
      'Interline',
      array['interline', 'connection', 'transfer', 'EK', 'OAL', 'APIS'],
      array['interline', 'connection', 'transfer', 'EK', 'OAL', 'APIS'],
      85,
      array['Interline', 'Connection and Transfers'],
      array['interline', 'connection', 'transfer', 'OAL', 'APIS']
    ),
    (
      'Government Deals',
      'government-deals',
      'Booking',
      array['ESAAD', 'ALSAADA', 'GDRFA', 'immigration deal', 'government deals'],
      array['ESAAD', 'ALSAADA', 'GDRFA', 'immigration deal', 'government deals'],
      75,
      array['Government Deals'],
      array['ESAAD', 'ALSAADA', 'GDRFA', 'government deals']
    )
),
resolved as (
  select
    seed.*,
    chapter.id as chapter_id,
    chapter.page_start,
    chapter.page_end,
    chapter.source_version
  from seed
  left join lateral (
    select
      chapters.id,
      chapters.page_start,
      chapters.page_end,
      chapters.source_version
    from chapters
    where
      exists (
        select 1
        from unnest(seed.title_patterns) as pattern
        where chapters.title ilike '%' || pattern || '%'
      )
      or exists (
        select 1
        from unnest(seed.body_patterns) as pattern
        where
          chapters.body_text ilike '%' || pattern || '%'
          or array_to_string(chapters.search_keywords, ' ') ilike '%' || pattern || '%'
      )
    order by
      case
        when exists (
          select 1
          from unnest(seed.title_patterns) as pattern
          where chapters.title ilike '%' || pattern || '%'
        )
        then 0
        else 1
      end,
      chapters.chapter_number
    limit 1
  ) as chapter on true
)
insert into procedure_cards (
  chapter_id,
  title,
  slug,
  category,
  summary,
  when_to_use,
  agent_action,
  rules,
  exceptions,
  source_pages,
  source_version,
  keywords,
  aliases,
  priority,
  review_status,
  is_published
)
select
  chapter_id,
  title,
  slug,
  category,
  'Procedure card linked to the source GO TO chapter for faster access and review.',
  'Use this card as a reviewed entry point to the linked source chapter.',
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  case
    when page_start is not null and page_end is not null and page_end >= page_start
      then array(select generate_series(page_start, page_end))
    when page_start is not null
      then array[page_start]
    when page_end is not null
      then array[page_end]
    else '{}'
  end,
  source_version,
  keywords,
  aliases,
  priority,
  'needs_review',
  false
from resolved
on conflict (slug) do update set
  chapter_id = excluded.chapter_id,
  category = excluded.category,
  summary = excluded.summary,
  when_to_use = excluded.when_to_use,
  source_pages = excluded.source_pages,
  source_version = excluded.source_version,
  keywords = excluded.keywords,
  aliases = excluded.aliases,
  priority = excluded.priority,
  updated_at = now()
where procedure_cards.review_status <> 'approved'
  and procedure_cards.is_published = false;
