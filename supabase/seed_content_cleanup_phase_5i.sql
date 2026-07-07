-- ============================================================
-- Phase 5I: Source-backed content cleanup and generic text removal
--
-- Safety:
-- - Does not delete procedure cards.
-- - Moves published cards with generic filler back to review.
-- - Rewrites selected cards conservatively from their linked source chapters.
-- - Does not approve, publish, or feature corrected cards.
-- - Leaves unclear cut-off, fee, allowed/not-allowed, and escalation fields blank.
-- ============================================================

-- Any published card containing generic filler must be reviewed again.
with filler_phrases(phrase) as (
  values
    ('source chapter'),
    ('source-supported'),
    ('linked source'),
    ('quality review'),
    ('check the source'),
    ('according to source'),
    ('source rules'),
    ('source process'),
    ('escalate unclear'),
    ('where source allows'),
    ('pending source review'),
    ('draft operational card'),
    ('use this card after')
),
cards_with_filler as (
  select distinct pc.id
  from public.procedure_cards pc
  cross join filler_phrases fp
  where pc.is_published = true
    and (
      lower(coalesce(pc.summary, '')) like '%' || fp.phrase || '%'
      or lower(coalesce(pc.when_to_use, '')) like '%' || fp.phrase || '%'
      or lower(coalesce(pc.required_information::text, '')) like '%' || fp.phrase || '%'
      or lower(coalesce(pc.system_steps::text, '')) like '%' || fp.phrase || '%'
      or lower(coalesce(pc.passenger_advice::text, '')) like '%' || fp.phrase || '%'
      or lower(coalesce(pc.allowed::text, '')) like '%' || fp.phrase || '%'
      or lower(coalesce(pc.not_allowed::text, '')) like '%' || fp.phrase || '%'
      or lower(coalesce(pc.escalation_points::text, '')) like '%' || fp.phrase || '%'
      or lower(coalesce(pc.fees_charges, '')) like '%' || fp.phrase || '%'
    )
)
update public.procedure_cards pc
set
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  updated_at = now()
from cards_with_filler
where pc.id = cards_with_filler.id;

-- Corrected drafts. Each row is intentionally conservative.
-- auto-split-od | source: auto-split-od | source did not provide enough clear handling detail in local seeds; operational fields left blank for reviewer extraction.
-- dubai-stopover | source: dubai-stopover | no universal cut-off or fee found in prior source-backed seed; left blank.
-- government-deals | source: government-deals | informational booking reference; cut-off/fees left blank pending source review.
-- interline-connection | source: interline | kept as Interline Reference only; no Connection and Transfers content mixed in.
with corrected (
  slug,
  title,
  source_chapter_slug,
  service_code,
  service_type,
  category,
  summary,
  when_to_use,
  cut_off_time,
  required_information,
  system_steps,
  passenger_advice,
  allowed,
  not_allowed,
  escalation_points,
  fees_charges,
  keywords,
  aliases,
  priority
) as (
  values
    (
      'auto-split-od',
      'Auto Split OD',
      'auto-split-od',
      null,
      'Booking Reference',
      'Booking',
      null,
      null,
      null,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      null,
      array['auto split', 'OD', 'booking'],
      array['Auto Split OD', 'split OD'],
      80
    ),
    (
      'dubai-stopover',
      'Dubai Stopover',
      'dubai-stopover',
      'DSO',
      'Stopover Reference',
      'Stopover',
      'Dubai Stopover is a source-defined stopover benefit linked to eligible flydubai bookings and DSO/FDSO handling.',
      'Use when a booking has Dubai Stopover, FDSO/DSO indicators, hotel voucher handling, or a stopover-related customer query.',
      null,
      jsonb_build_array('PNR', 'Passenger name', 'Affected segment', 'DSO or FDSO indicator', 'Customer request or complaint details'),
      jsonb_build_array('Open the booking and confirm whether DSO/FDSO appears on the PNR.', 'Check whether the customer request relates to stopover eligibility, modification, disruption, hotel voucher, or hotel complaint.', 'For DSO-tagged segment changes, review the source warning before completing modification.', 'Update case comments with the DSO/FDSO status and customer request.'),
      jsonb_build_array('Advise eligible passengers to review Dubai Stopover information on the flydubai website.', 'For hotel complaints, advise the customer to contact holidays@flydubai.com when the source scenario applies.', 'If extension or additional nights are requested, advise that the passenger should arrange directly with the hotel when the source scenario applies.'),
      jsonb_build_array('DSO SSR may appear under the services tab and Services window.', 'Dubai Stopover label may display on the PNR header.', 'DSO may be retained when modification is completed on a non-DSO segment.'),
      jsonb_build_array('Do not promise a universal stopover cut-off or fee when it is not stated in the source.', 'Do not promise hotel complaint resolution through Contact Centre when the source routes hotel complaints to holidays email.'),
      '[]'::jsonb,
      null,
      array['DSO', 'FDSO', 'Dubai Stopover', 'stopover', 'hotel voucher'],
      array['Dubai Stopover', 'DSO', 'FDSO', 'stopover'],
      75
    ),
    (
      'government-deals',
      'Government Deals',
      'government-deals',
      'GOV',
      'Booking Reference',
      'Booking',
      'Government Deals is a booking reference topic for government-related fares or booking handling.',
      'Use when a customer or agent query relates to Government Deals booking handling.',
      null,
      jsonb_build_array('Booking reference if available', 'Passenger name', 'Government deal or fare context', 'Customer request'),
      jsonb_build_array('Open the booking or request details.', 'Confirm the query belongs to Government Deals handling.', 'Record the customer request and action taken in comments.'),
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      null,
      array['government deals', 'government', 'booking'],
      array['government deals', 'GOV'],
      55
    ),
    (
      'interline-connection',
      'Interline',
      'interline',
      'OAL / APIS',
      'Interline Reference',
      'Interline',
      'Interline is a reference topic for bookings involving other airlines or partner airline handling.',
      'Use when the query is specifically about interline or other-airline handling.',
      null,
      jsonb_build_array('PNR', 'Operating carrier', 'Ticketing carrier', 'Route and connection details', 'Customer request'),
      jsonb_build_array('Identify whether the itinerary involves another airline or interline handling.', 'Review the applicable carrier or ticketing responsibility.', 'Record the interline scenario and customer request in comments.'),
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      null,
      array['interline', 'OAL', 'APIS', 'partner airline'],
      array['interline', 'other airline', 'OAL', 'APIS'],
      60
    )
),
resolved as (
  select
    corrected.*,
    chapters.id as chapter_id,
    chapters.page_start,
    chapters.page_end,
    chapters.source_version,
    chapters.updated_at as chapter_updated_at
  from corrected
  join public.chapters on chapters.slug = corrected.source_chapter_slug
),
prepared as (
  select
    *,
    case
      when page_start is null and page_end is null then '{}'::int[]
      when page_end is null or page_end = page_start then array[page_start]
      else array[page_start, page_end]
    end as source_pages
  from resolved
)
insert into public.procedure_cards (
  chapter_id,
  title,
  slug,
  category,
  summary,
  when_to_use,
  required_information,
  system_steps,
  passenger_advice,
  allowed,
  not_allowed,
  escalation_points,
  fees_charges,
  cut_off_time,
  service_code,
  service_type,
  source_pages,
  source_version,
  source_updated_at,
  keywords,
  aliases,
  priority,
  review_status,
  is_published,
  show_on_homepage,
  source_confidence
)
select
  chapter_id,
  title,
  slug,
  category,
  summary,
  when_to_use,
  required_information,
  system_steps,
  passenger_advice,
  allowed,
  not_allowed,
  escalation_points,
  fees_charges,
  cut_off_time,
  service_code,
  service_type,
  source_pages,
  source_version,
  chapter_updated_at::date,
  keywords,
  aliases,
  priority,
  'needs_review',
  false,
  false,
  'source_backed'
from prepared
on conflict (slug) do update set
  chapter_id = excluded.chapter_id,
  title = excluded.title,
  category = excluded.category,
  summary = excluded.summary,
  when_to_use = excluded.when_to_use,
  required_information = excluded.required_information,
  system_steps = excluded.system_steps,
  passenger_advice = excluded.passenger_advice,
  allowed = excluded.allowed,
  not_allowed = excluded.not_allowed,
  escalation_points = excluded.escalation_points,
  fees_charges = excluded.fees_charges,
  cut_off_time = excluded.cut_off_time,
  service_code = excluded.service_code,
  service_type = excluded.service_type,
  source_pages = excluded.source_pages,
  source_version = excluded.source_version,
  source_updated_at = excluded.source_updated_at,
  keywords = excluded.keywords,
  aliases = excluded.aliases,
  priority = excluded.priority,
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  source_confidence = 'source_backed',
  updated_at = now();

-- Report corrected cards after cleanup.
select
  slug,
  title,
  review_status,
  is_published,
  service_type,
  cut_off_time,
  source_confidence,
  updated_at
from public.procedure_cards
where slug in (
  'auto-split-od',
  'dubai-stopover',
  'government-deals',
  'interline-connection'
)
order by slug;

-- Remaining generic filler detection report.
select
  slug,
  title,
  review_status,
  is_published
from public.procedure_cards
where
  lower(coalesce(summary, '')) like '%source chapter%'
  or lower(coalesce(summary, '')) like '%quality review%'
  or lower(coalesce(when_to_use, '')) like '%source chapter%'
  or lower(coalesce(when_to_use, '')) like '%quality review%'
  or lower(coalesce(required_information::text, '')) like '%source chapter%'
  or lower(coalesce(system_steps::text, '')) like '%source chapter%'
  or lower(coalesce(passenger_advice::text, '')) like '%source chapter%'
  or lower(coalesce(allowed::text, '')) like '%source chapter%'
  or lower(coalesce(not_allowed::text, '')) like '%source chapter%'
  or lower(coalesce(escalation_points::text, '')) like '%source chapter%'
order by title;
