-- ============================================================
-- Phase D.1 Pass 2: v81.2 source alignment — card review-state reset
--
-- Scope: the five Decision Assistant procedure cards whose deterministic
-- trees are verified against GO TO v81.2 (10-Jul-2026):
--   sporting-equipment, check-in-olci, flight-disruption,
--   extra-seat-cbbg, minimum-connection-time
--
-- WHAT THIS FILE DOES
--   1. (Section A) Verifies each card's chapter mapping — READ ONLY.
--   2. (Section B) Returns the five cards to manual review — METADATA ONLY.
--   3. (Section C) Report + compatibility queries — READ ONLY.
--
-- WHAT THIS FILE DELIBERATELY DOES NOT DO
--   - It does NOT touch chapter rows. The linked chapters are refreshed to
--     v81.2 by the project's existing extraction/sync importer
--     (extraction/extract.py + attach_pdf_links.py, then sync/sync.mjs,
--     reviewed and published from /admin/sync). That path preserves rich
--     content_blocks, tables, images, and attached PDF links, which a
--     hand-written SQL overwrite would flatten. See "IMPORTER STEPS" below.
--   - It does NOT change source_version, source_updated_at, last_reviewed_at,
--     or last_reviewed_by on the cards. The card source snapshot must stay at
--     the previously reviewed 80.8 state until an admin manually re-reviews
--     and approves each card against the refreshed 81.2 chapter. That
--     approval is what legitimately snapshots 81.2 + the chapter date and
--     clears the freshness guard.
--   - It does NOT approve, publish, or feature anything.
--   - It does NOT change decision-tree definitions, auth, schema, search,
--     the homepage, services, dependencies, or the admin workflow.
--
-- EXPECTED STATE AFTER (chapter refreshed via importer, before approval):
--   chapter source_version = 81.2 (10-Jul-2026)
--   card source_version    = 80.8 (23-Jun-2026)  [unchanged, intentional]
--   review_status          = needs_review
--   is_published           = false
--   compatibility          = Card version mismatch   [correct + temporary]
-- The Decision Assistant workflow stays unavailable to ordinary agents until
-- an admin approves each card. The freshness guard is never weakened.
--
-- ORDER OF OPERATIONS (run manually, verifying between steps):
--   1. Run Section A and confirm every row maps to the expected chapter and
--      that chapter_id is NOT NULL. If any mapping is wrong, STOP.
--   2. Refresh the five linked chapters to v81.2 via the importer
--      (IMPORTER STEPS). Approve ONLY those five chapters in /admin/sync.
--   3. Run Section B to return the five cards to manual review.
--   4. Run Section C and confirm the expected state above.
--   5. Manually re-review + approve each card in Admin.
--
-- IMPORTER STEPS (PowerShell, local, uses the Supabase service-role key):
--   cd C:\goto-manual-project\goto-project\extraction
--   python extract.py "PATH_TO_GO_TO_v81_2.pdf" output
--   python attach_pdf_links.py "PATH_TO_GO_TO_v81_2.pdf" output
--   cd ..\sync
--   node sync.mjs ..\extraction\output\chapters.json
--   # Open the /admin/sync/<id> link printed by the sync script and approve
--   # ONLY the five chapters below, then Publish. Leave all other staged
--   # chapter changes unapproved so unrelated chapters are not modified.
--
-- v81.2 page ranges the trees rely on (for reviewer cross-check):
--   sporting-equipment       -> 28. Sporting Equipment          pp.126-131
--   check-in-olci            -> 55. Ways to Check-in            pp.282-285
--   flight-disruption        -> 71. Flight Disruption           pp.329-340
--   extra-seat-cbbg          -> 33. Seat (EXST/CBBG process)    pp.160-163
--   minimum-connection-time  -> 25. Connection and Transfers    pp.100-102
-- Refresh the FULL linked chapter from v81.2, not only the tree excerpt.
-- ============================================================


-- ============================================================
-- SECTION A — mapping verification (READ ONLY; run first)
-- Confirms each card has a non-null chapter_id and that it resolves to the
-- expected chapter. Investigate any row where chapter_id is null or the
-- chapter title/slug is not the expected one before running Section B.
-- ============================================================
select
  pc.slug                as procedure_slug,
  pc.chapter_id,
  (pc.chapter_id is null) as chapter_id_is_null,
  ch.slug                as chapter_slug,
  ch.chapter_number,
  ch.title               as chapter_title,
  ch.source_version      as chapter_source_version,
  ch.page_start,
  ch.page_end
from public.procedure_cards pc
left join public.chapters ch on ch.id = pc.chapter_id
where pc.slug in (
  'sporting-equipment',
  'check-in-olci',
  'flight-disruption',
  'extra-seat-cbbg',
  'minimum-connection-time'
)
order by pc.slug;


-- ============================================================
-- SECTION B — return the five cards to manual review (METADATA ONLY)
-- Run only AFTER the five chapters are refreshed to v81.2 via the importer.
--
-- Guards:
--   - Updates exactly the five target slugs, nothing else.
--   - Only runs for cards that have a linked chapter (chapter_id not null).
--   - Does NOT touch source_version, source_updated_at, last_reviewed_at,
--     last_reviewed_by (the card snapshot stays at 80.8 until admin approval).
-- ============================================================
update public.procedure_cards as pc
set
  review_status     = 'needs_review',
  is_published      = false,
  show_on_homepage  = false,
  homepage_order    = 0,
  source_confidence = 'source_backed',
  updated_at        = now()
where pc.slug in (
    'sporting-equipment',
    'check-in-olci',
    'flight-disruption',
    'extra-seat-cbbg',
    'minimum-connection-time'
  )
  and pc.chapter_id is not null;


-- ============================================================
-- SECTION C.1 — chapter report (READ ONLY; from the task spec)
-- ============================================================
select
  pc.slug               as procedure_slug,
  pc.title              as procedure_title,
  pc.review_status,
  pc.is_published,
  pc.source_version     as card_source_version,
  pc.source_updated_at  as card_source_updated_at,
  pc.last_reviewed_at,
  ch.id                 as chapter_id,
  ch.slug               as chapter_slug,
  ch.title              as chapter_title,
  ch.source_version     as chapter_source_version,
  ch.updated_at         as chapter_updated_at,
  ch.page_start,
  ch.page_end
from public.procedure_cards pc
join public.chapters ch on ch.id = pc.chapter_id
where pc.slug in (
  'sporting-equipment',
  'check-in-olci',
  'flight-disruption',
  'extra-seat-cbbg',
  'minimum-connection-time'
)
order by pc.slug;


-- ============================================================
-- SECTION C.2 — compatibility report vs expected tree version 81.2
-- Expected after chapter refresh but before manual approval:
--   compatibility = 'Card version mismatch'  (card 80.8 vs chapter/tree 81.2)
-- After manual approval snapshots 81.2 onto the card:
--   compatibility = 'Compatible'
-- ============================================================
with target as (
  select '81.2'::text as tree_version
),
cards as (
  select
    pc.slug,
    pc.review_status,
    pc.is_published,
    pc.source_version                                  as card_source_version,
    pc.last_reviewed_at,
    ch.source_version                                  as chapter_source_version,
    ch.updated_at                                      as chapter_updated_at,
    substring(pc.source_version from '[0-9]+\.[0-9]+') as card_ver_norm,
    substring(ch.source_version from '[0-9]+\.[0-9]+') as chapter_ver_norm
  from public.procedure_cards pc
  left join public.chapters ch on ch.id = pc.chapter_id
  where pc.slug in (
    'sporting-equipment',
    'check-in-olci',
    'flight-disruption',
    'extra-seat-cbbg',
    'minimum-connection-time'
  )
)
select
  c.slug,
  c.review_status,
  c.is_published,
  c.card_source_version,
  c.chapter_source_version,
  t.tree_version,
  c.last_reviewed_at,
  case
    when c.chapter_source_version is null                     then 'No linked source chapter'
    when c.card_ver_norm    is distinct from t.tree_version
     and c.chapter_ver_norm is distinct from t.tree_version   then 'Card and chapter mismatch'
    when c.card_ver_norm    is distinct from t.tree_version   then 'Card version mismatch'
    when c.chapter_ver_norm is distinct from t.tree_version   then 'Chapter version mismatch'
    when c.last_reviewed_at is null                           then 'Never reviewed'
    when c.chapter_updated_at is not null
     and c.chapter_updated_at > c.last_reviewed_at            then 'Source updated after review'
    else 'Compatible'
  end as compatibility
from cards c
cross join target t
order by c.slug;
