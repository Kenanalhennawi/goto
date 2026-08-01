-- ============================================================
-- UPD-1: GO TO v81.7 (30-Jul-2026) alignment — procedure cards.
-- Run AFTER the v81.7 chapters are imported/published through the Admin sync
-- tool. Idempotent. No card is auto-published: content-changed cards are set
-- to needs_review for manual approval; metadata-only cards keep their state.
-- ============================================================

-- ---------- 0. Diagnostics (run first, review output) ----------
-- Cards still on old versions:
--   select slug, source_version, review_status, is_published from procedure_cards order by slug;
-- Cards containing retired SPEX references (fields must be cleaned in review):
--   select slug from procedure_cards where (to_jsonb(procedure_cards)::text) ilike '%spex%';

-- ---------- 1. Sporting Equipment — new process (v81.7 ch.28 pp.126-129) ----
update procedure_cards set
  summary = 'Sporting equipment travels within the checked baggage allowance — no separate handling fee. SSR SPEQ (equipment) or BIKE (bicycles), pre-booked at least 24 hours before departure; weapons need 96 hours.',
  when_to_use = 'Passenger wants to carry sporting equipment, a bicycle, or a sporting weapon/firearm/ammunition (new process effective 01-Aug-2026).',
  cut_off_time = 'Pre-book at least 24 hours before departure (weapons: 96 hours). Within 24h only SUP/FS may add the SSR, up to 12 hours prior; report for check-in 2 hours before departure.',
  allowed = jsonb_build_array(
    'Accepted as part of the checked baggage allowance; excess weight follows the standard excess baggage policy — no additional sporting equipment charges',
    'SSR SPEQ for sporting equipment (max 10 per flight); SSR BIKE for bicycles (max 10 per flight); 20-piece flight inventory',
    'GOSHOW equipment subject to space and payload availability',
    'Snooker cues, rackets and similar items may travel as normal baggage'
  ),
  not_allowed = jsonb_build_array(
    'Items over 300 cm total (L+W+H), width over 115 cm or height over 80 cm — must move as cargo/freight',
    'Any individual item over 32 kg (health and safety)',
    'SSR SPEX — retired effective 01-Aug-2026',
    'Dangerous goods inside equipment except those permitted under IATA DGR Table 2.3.A'
  ),
  system_steps = jsonb_build_array(
    'Verify the flight is more than 24 hours from departure',
    'Advise maximum dimensions (300 cm total, W<=115, H<=80), packing requirements and carriage conditions',
    'Add SSR SPEQ or BIKE per passenger per flight (connections: escalate to Supervisor to add per sector)',
    'Update Sprint comments'
  ),
  fees_charges = 'No sporting equipment handling fee. Excess weight beyond the baggage allowance follows the standard excess baggage policy. Sporting weapons/firearms: AED 300 per passenger per sector (SSR WEAP, Dubai Police approval).',
  passenger_advice = jsonb_build_array(
    'Your equipment counts within your checked baggage allowance; excess baggage charges apply only beyond it',
    'Maximum size 300 cm (L+W+H) and 32 kg per item — larger items must go as cargo',
    'Please report for check-in at least 2 hours before departure',
    'For onward flights on other airlines, confirm acceptance directly with that airline'
  ),
  escalation_points = jsonb_build_array(
    'Within 24 hours of departure: SUP in charge decides; SUP/FS may add the SSR up to 12 hours prior',
    'More than 10 pieces (per SSR type): prior confirmation required, subject to space and payload',
    'Weapons/firearms/ammunition: Security@flydubai.com documents 4 working days ahead; Supervisor escalation'
  ),
  source_version = '81.7 (30-Jul-2026)',
  source_pages = array[126,127,128,129],
  review_status = 'needs_review',
  updated_at = now()
where slug = 'sporting-equipment';

-- ---------- 2. Wheelchair — Accessibility seating guidelines (v81.7 ch.34/35) ----
update procedure_cards set
  passenger_advice = coalesce(passenger_advice, '[]'::jsonb) || jsonb_build_array(
    'Seat assignment follows the Guidelines on seat allocation for passengers requiring additional assistance: complimentary adjacent seats, preferably rows 18-31, no emergency-exit rows'
  ),
  source_version = '81.7 (30-Jul-2026)',
  review_status = 'needs_review',
  updated_at = now()
where slug = 'wheelchair';

-- ---------- 3. DPNA — Accessibility seating guidelines ----------
update procedure_cards set
  passenger_advice = coalesce(passenger_advice, '[]'::jsonb) || jsonb_build_array(
    'Seat assignment follows the Guidelines on seat allocation for passengers requiring additional assistance; emergency-exit rows are never assigned'
  ),
  source_version = '81.7 (30-Jul-2026)',
  review_status = 'needs_review',
  updated_at = now()
where slug = 'dpna';

-- ---------- 4. Metadata-only alignment for the remaining workflow cards ------
-- Content verified source-identical in the UPD-1 audit (pages shift only).
-- Pregnancy is intentionally excluded (tree remains verified against v80.8).
update procedure_cards set
  source_version = '81.7 (30-Jul-2026)',
  updated_at = now()
where slug in (
  'check-in-olci','flight-disruption','extra-seat-cbbg','minimum-connection-time',
  'name-correction','falcon-handling','duplicate-booking','government-deals',
  'auto-split-od','travel-requirements','ok-to-board','visa-change',
  'meet-assist','business-lounge','blue-ribbon-bags','worldtracer',
  'meda','oxygen','service-animal','plaster-cast-leg-brace','human-remains','death-case'
)
and review_status = 'approved';

-- ---------- 5. Post-run verification ----------
-- select slug, source_version, review_status from procedure_cards
--   where slug in ('sporting-equipment','wheelchair','dpna') order by slug;
-- select count(*) from procedure_cards where source_version like '81.2%';
-- After manual review, approve the three needs_review cards in Admin so their
-- guided workflows become available again (tree versions are already 81.7).
