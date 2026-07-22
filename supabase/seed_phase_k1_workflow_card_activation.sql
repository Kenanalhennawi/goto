-- ============================================================
-- Phase K.1 — Decision workflow card activation & source alignment
--
-- Purpose: prepare every registered deterministic workflow for NORMAL admin
-- review and eventual publication. This file:
--   1. Creates source-backed DRAFT cards for missing workflows (unique chapter
--      link supplied by the live audit).
--   2. Aligns two thin/at-risk existing cards to their verified v81.2 scope
--      (auto-split-od, government-deals).
--   3. Returns stale/source-correct existing cards to manual review
--      (metadata only).
--
-- It NEVER approves, publishes, features, version-stamps, or writes review
-- metadata. Availability/freshness guards are untouched; a normal Admin
-- "Approve & publish" is what snapshots the current (81.2) chapter version and
-- stamps the authenticated reviewer.
--
-- Live audit is the source of truth. Chapter IDs below are the verified live
-- IDs. Cards are created only when the chapter row exists AND the slug does not
-- already exist, so the file is safe to re-run and never inserts a null-linked
-- card. No deletes; no card IDs are replaced.
--
-- DO NOT MODIFY (untouched here): the 6 available cards (pregnancy,
-- check-in-olci, extra-seat-cbbg, flight-disruption, minimum-connection-time,
-- sporting-equipment); meet-assist (BLOCKED — no uniquely verified chapter row).
-- ============================================================

-- ------------------------------------------------------------
-- REPORT 1 — Pre-run live inventory (read-only)
-- ------------------------------------------------------------
with reg(slug, tree_version) as (
  values
    ('pregnancy','81.2'),('sporting-equipment','81.2'),('check-in-olci','81.2'),
    ('flight-disruption','81.2'),('extra-seat-cbbg','81.2'),('minimum-connection-time','81.2'),
    ('wheelchair','81.2'),('name-correction','81.2'),('falcon-handling','81.2'),
    ('duplicate-booking','81.2'),('government-deals','81.2'),('auto-split-od','81.2'),
    ('travel-requirements','81.2'),('ok-to-board','81.2'),('visa-change','81.2'),
    ('meet-assist','81.2'),('business-lounge','81.2'),('blue-ribbon-bags','81.2'),
    ('worldtracer','81.2'),('meda','81.2'),('oxygen','81.2'),('service-animal','81.2'),
    ('plaster-cast-leg-brace','81.2'),('dpna','81.2'),('human-remains','81.2'),('death-case','81.2')
)
select
  reg.slug,
  (pc.id is not null)        as card_exists,
  pc.review_status,
  pc.is_published,
  pc.source_confidence,
  pc.source_version          as card_source_version,
  ch.slug                    as chapter_slug,
  ch.source_version          as chapter_source_version,
  reg.tree_version
from reg
left join public.procedure_cards pc on pc.slug = reg.slug
left join public.chapters ch on ch.id = pc.chapter_id
order by reg.slug;

-- ------------------------------------------------------------
-- REPORT 2 — Verified chapter-link report (read-only)
-- Confirms the exact live chapter IDs used for the missing-card inserts.
-- ------------------------------------------------------------
select 'duplicate-booking'  as target_slug, ch.id, ch.slug, ch.title, ch.source_version
  from public.chapters ch where ch.id = '2d90e3bf-3a73-485e-bead-94a09cbb573f'
union all select 'travel-requirements', ch.id, ch.slug, ch.title, ch.source_version
  from public.chapters ch where ch.id = '6db5d081-3f2c-4684-872e-7ca957ba700d'
union all select 'visa-change', ch.id, ch.slug, ch.title, ch.source_version
  from public.chapters ch where ch.id = 'acbcfd30-1bf4-460f-95a7-97d5ee7a6491'
union all select 'oxygen', ch.id, ch.slug, ch.title, ch.source_version
  from public.chapters ch where ch.id = 'ff24ad83-7003-46b5-a689-731d7f6bac53'
union all select 'service-animal', ch.id, ch.slug, ch.title, ch.source_version
  from public.chapters ch where ch.id = '9c9337a8-2c42-4b2d-bed3-383a54b221c7'
union all select 'human-remains', ch.id, ch.slug, ch.title, ch.source_version
  from public.chapters ch where ch.id = 'bc430cc5-5bdd-41c8-8e5e-26c17862520d'
union all select 'death-case', ch.id, ch.slug, ch.title, ch.source_version
  from public.chapters ch where ch.id = '9fe727bd-74db-429d-8f35-18f9569b0863'
union all select 'business-lounge', ch.id, ch.slug, ch.title, ch.source_version
  from public.chapters ch where ch.id = 'd78ec279-74ae-4a09-9f68-ad006214174c'
union all select 'blue-ribbon-bags', ch.id, ch.slug, ch.title, ch.source_version
  from public.chapters ch where ch.id = 'bce742a3-c221-4f0f-988b-b0e504db4638'
union all select 'worldtracer', ch.id, ch.slug, ch.title, ch.source_version
  from public.chapters ch where ch.id = 'bce742a3-c221-4f0f-988b-b0e504db4638'
order by target_slug;

-- ============================================================
-- WRITES (transactional)
-- ============================================================
begin;

-- ------------------------------------------------------------
-- STEP 3 — Guarded missing-card INSERTs
-- Insert only when the chapter row exists AND the slug is absent.
-- source_version / source_updated_at are left NULL (admin publish snapshots
-- the chapter version); last_reviewed_at / last_reviewed_by stay NULL.
-- ------------------------------------------------------------

-- 3.1 duplicate-booking (ch.47) — escalation/approval based; no self-service refund
insert into public.procedure_cards (
  chapter_id, title, slug, category, service_code, service_type, summary, when_to_use,
  channels, cut_off_time, who_can_action, required_information, system_steps, passenger_advice,
  allowed, not_allowed, escalation_points, fees_charges, keywords, aliases, priority,
  review_status, is_published, show_on_homepage, homepage_order, source_confidence,
  last_reviewed_at, last_reviewed_by, updated_at
)
select
  ch.id, 'Duplicate Booking', 'duplicate-booking', 'Booking', null, 'Booking / Duplicate handling',
  'Handling of identical or semi-identical duplicate bookings; every resolvable case is approval-gated.',
  'Use when a passenger holds two matching bookings and asks to cancel one.',
  jsonb_build_array('Contact Centre', 'Let''s Talk'),
  null,
  jsonb_build_array('Contact Centre agent (verification only)', 'Team Leader / Supervisor for approval'),
  jsonb_build_array('Both PNRs and whether every detail matches (passenger, sector, cabin, dates, flight, fare, status)', 'Whether both bookings are fully active (no no-show or used segment)', 'Whether either booking was made through a travel agent or GDS'),
  jsonb_build_array('Confirm the two bookings match the documented duplicate criteria.', 'Escalate to Team Leader / Supervisor for approval before any cancellation.', 'For a partial or cross-channel duplicate, advise the passenger to use Let''s Talk and identify which booking to cancel.'),
  jsonb_build_array('Non-refundable charges are not refunded when a duplicate booking is cancelled.'),
  jsonb_build_array('A refund is assisted only for fully active duplicate bookings, subject to approval.'),
  jsonb_build_array('Do not self-service a duplicate cancellation or refund.', 'Do not refund non-refundable charges.'),
  jsonb_build_array('Escalate to Team Leader / Supervisor for approval and capture why the additional booking was created.'),
  null,
  array['duplicate booking','duplicate','dupe','duplicate pnr']::text[],
  array['Duplicate booking','dupe']::text[],
  60,
  'needs_review', false, false, 0, 'source_backed', null, null, now()
from public.chapters ch
where ch.id = '2d90e3bf-3a73-485e-bead-94a09cbb573f'
  and not exists (select 1 from public.procedure_cards pc where pc.slug = 'duplicate-booking');

-- 3.2 travel-requirements (ch.49) — UAE residency / original Emirates ID only
insert into public.procedure_cards (
  chapter_id, title, slug, category, service_code, service_type, summary, when_to_use,
  channels, cut_off_time, who_can_action, required_information, system_steps, passenger_advice,
  allowed, not_allowed, escalation_points, fees_charges, keywords, aliases, priority,
  review_status, is_published, show_on_homepage, homepage_order, source_confidence,
  last_reviewed_at, last_reviewed_by, updated_at
)
select
  ch.id, 'Travel Requirements (UAE Residency)', 'travel-requirements', 'Travel Documents', null, 'Travel Document / UAE Residency Reference',
  'UAE residency travel-document guidance: the original Emirates ID must be carried when departing Dubai and used as proof of UAE residency on return.',
  'Use when a UAE resident is departing Dubai and returning to the UAE.',
  jsonb_build_array('Contact Centre'),
  null,
  jsonb_build_array('Contact Centre agent'),
  jsonb_build_array('Whether the passenger is a UAE resident departing Dubai and returning to the UAE', 'Whether the passenger has their original Emirates ID'),
  jsonb_build_array('Confirm the passenger carries the original Emirates ID for the return journey.', 'Advise the passenger to check the relevant authorities for the latest entry and exit requirements before travel.'),
  jsonb_build_array('Carry the original Emirates ID as proof of UAE residency on return.', 'Confirm the latest entry and exit requirements with the relevant authorities before travel.'),
  jsonb_build_array('The original Emirates ID is accepted as proof of UAE residency for this return-travel scenario.'),
  jsonb_build_array('Do not determine immigration admissibility to any country.', 'Do not rely on a resident-visa sticker as proof of UAE residency.'),
  jsonb_build_array(),
  null,
  array['travel requirements','UAE residency','Emirates ID','proof of residency']::text[],
  array['Travel requirements','Emirates ID']::text[],
  55,
  'needs_review', false, false, 0, 'source_backed', null, null, now()
from public.chapters ch
where ch.id = '6db5d081-3f2c-4684-872e-7ca957ba700d'
  and not exists (select 1 from public.procedure_cards pc where pc.slug = 'travel-requirements');

-- 3.3 visa-change (ch.48 Visa) — narrow MCT/KWI/BAH process; no general visa advice
insert into public.procedure_cards (
  chapter_id, title, slug, category, service_code, service_type, summary, when_to_use,
  channels, cut_off_time, who_can_action, required_information, system_steps, passenger_advice,
  allowed, not_allowed, escalation_points, fees_charges, keywords, aliases, priority,
  review_status, is_published, show_on_homepage, homepage_order, source_confidence,
  last_reviewed_at, last_reviewed_by, updated_at
)
select
  ch.id, 'Visa Change', 'visa-change', 'Travel Documents', null, 'Visa Change Travel Handling',
  'Visa-change travel handling for re-entry to the UAE via MCT, KWI or BAH through authorised travel agents.',
  'Use for a visa-change travel request; general and transit visa enquiries are redirected.',
  jsonb_build_array('Authorised travel agents (approved list)', 'visa.dxb@flydubai.com or a flydubai Travel Shop for visa enquiries'),
  null,
  jsonb_build_array('Contact Centre agent (routing only)', 'Supervisor for an outbound no-show'),
  jsonb_build_array('Whether the request is visa-change travel or a general/transit visa enquiry', 'Route (MCT, KWI or BAH)', 'Whether a valid UAE visa is held in hand before departure', 'Whether both flights are under the same PNR'),
  jsonb_build_array('For visa-change travel, refer the passenger to an authorised travel agent from the approved list; only those bookings are accepted at the airport.', 'Confirm the route is MCT, KWI or BAH and both flights are under the same PNR.', 'If the passenger is a no-show on the outbound flight, refer to the supervisor in charge.'),
  jsonb_build_array('Hold a valid UAE visa in hand before departure for re-entry.', 'Keep both outbound and inbound flights under the same PNR.'),
  jsonb_build_array('Visa-change travel applies to MCT, KWI and BAH via authorised travel agents, with through check-in from DXB and API clearance.'),
  jsonb_build_array('Do not provide general visa advice over the call.', 'Do not offer visa-change travel on routes other than MCT, KWI or BAH.'),
  jsonb_build_array('Refer an outbound no-show to the supervisor in charge.'),
  null,
  array['visa change','re-entry','MCT','KWI','BAH']::text[],
  array['Visa change']::text[],
  55,
  'needs_review', false, false, 0, 'source_backed', null, null, now()
from public.chapters ch
where ch.id = 'acbcfd30-1bf4-460f-95a7-97d5ee7a6491'
  and not exists (select 1 from public.procedure_cards pc where pc.slug = 'visa-change');

-- 3.4 oxygen (ch.30 Oxygen Carry) — portable battery POC; no diagnosis / fitness call
insert into public.procedure_cards (
  chapter_id, title, slug, category, service_code, service_type, summary, when_to_use,
  channels, cut_off_time, who_can_action, required_information, system_steps, passenger_advice,
  allowed, not_allowed, escalation_points, fees_charges, keywords, aliases, priority,
  review_status, is_published, show_on_homepage, homepage_order, source_confidence,
  last_reviewed_at, last_reviewed_by, updated_at
)
select
  ch.id, 'Oxygen Carry', 'oxygen', 'Medical', 'PPOC', 'Medical / Oxygen Carriage',
  'Carriage of a passenger''s own portable, battery-powered oxygen concentrator (SSR PPOC).',
  'Use when a passenger intends to travel with their own oxygen concentrator.',
  jsonb_build_array('Contact Centre', 'letstalk@flydubai.com for non-listed device or OAL approval'),
  'Approval for a non-listed but FAA-approved device must be sought at least 72 hours before departure.',
  jsonb_build_array('Contact Centre agent', 'Supervisor for a non-approved device or OAL approval follow-up'),
  jsonb_build_array('Device type and whether it is an approved, battery-powered portable oxygen concentrator', 'First operating carrier (flydubai or another airline)', 'Whether the original medical (fit-to-fly) certificate is available'),
  jsonb_build_array('Confirm the device is an approved, battery-powered portable oxygen concentrator.', 'Advise the passenger to carry the original medical (fit-to-fly) certificate with the required statements for check-in.', 'For an approved device on a flydubai-first journey, add SSR PPOC (free) and assign a window seat (seat charge per fare type); comment the PNR.', 'For a non-listed FAA-approved device, or where the first operating carrier is another airline, refer to letstalk@flydubai.com and escalate to a supervisor.'),
  jsonb_build_array('Only portable, battery-powered oxygen concentrators are accepted; additional oxygen is not provided on board.', 'Carry the original medical certificate at check-in.'),
  jsonb_build_array('An approved battery-powered concentrator may be carried with SSR PPOC and a window seat under the documented process.'),
  jsonb_build_array('Non-portable or non-battery cylinders are not accepted.', 'Do not provide a diagnosis or an independent fitness-to-fly decision.'),
  jsonb_build_array('Escalate a non-listed device or an OAL-first journey to a supervisor via letstalk.'),
  'SSR PPOC is free of cost; a window seat is charged per fare type.',
  array['oxygen','oxygen concentrator','PPOC','POC']::text[],
  array['Oxygen','oxygen concentrator']::text[],
  60,
  'needs_review', false, false, 0, 'source_backed', null, null, now()
from public.chapters ch
where ch.id = 'ff24ad83-7003-46b5-a689-731d7f6bac53'
  and not exists (select 1 from public.procedure_cards pc where pc.slug = 'oxygen');

-- 3.5 service-animal (ch.36) — service dog only; ESA not accepted
insert into public.procedure_cards (
  chapter_id, title, slug, category, service_code, service_type, summary, when_to_use,
  channels, cut_off_time, who_can_action, required_information, system_steps, passenger_advice,
  allowed, not_allowed, escalation_points, fees_charges, keywords, aliases, priority,
  review_status, is_published, show_on_homepage, homepage_order, source_confidence,
  last_reviewed_at, last_reviewed_by, updated_at
)
select
  ch.id, 'Service Animal', 'service-animal', 'Special Assistance', 'SVAN', 'Special Assistance / Service Animal',
  'Carriage of a service dog assisting with a vision, hearing or physical impairment (SSR SVAN); emotional support animals are not accepted.',
  'Use when a passenger intends to travel with a service dog.',
  jsonb_build_array('Contact Centre', 'letstalk@flydubai.com for approval'),
  'Pre-approval must be obtained at least 72 hours before departure.',
  jsonb_build_array('Contact Centre agent', 'Customer Service / Let''s Talk for approval'),
  jsonb_build_array('Whether the animal is a service dog or an emotional support animal', 'Whether pre-approval and the required documents are in place'),
  jsonb_build_array('Confirm the animal is a service dog assisting with a vision, hearing or physical impairment.', 'Refer the passenger to letstalk@flydubai.com with the passenger''s medical condition, the animal''s training certificate, and the vaccination record, at least 72 hours before departure.', 'Once Customer Service approves, add SSR SVAN (free of charge) and follow any further instructions.'),
  jsonb_build_array('Emotional support animals are not accepted for carriage.', 'Submit the required documents to Let''s Talk at least 72 hours before departure.'),
  jsonb_build_array('An approved service dog is carried free of charge (SSR SVAN).'),
  jsonb_build_array('Emotional support animals are not accepted under this workflow.', 'The agent does not grant carriage approval; Customer Service does.'),
  jsonb_build_array('Approval is handled by Customer Service / Let''s Talk.'),
  'A service dog is accepted free of charge.',
  array['service animal','service dog','SVAN']::text[],
  array['Service animal','service dog']::text[],
  58,
  'needs_review', false, false, 0, 'source_backed', null, null, now()
from public.chapters ch
where ch.id = '9c9337a8-2c42-4b2d-bed3-383a54b221c7'
  and not exists (select 1 from public.procedure_cards pc where pc.slug = 'service-animal');

-- 3.6 human-remains (ch.32 Cargo) — Cargo/dnata handled; CC does not grant acceptance
insert into public.procedure_cards (
  chapter_id, title, slug, category, service_code, service_type, summary, when_to_use,
  channels, cut_off_time, who_can_action, required_information, system_steps, passenger_advice,
  allowed, not_allowed, escalation_points, fees_charges, keywords, aliases, priority,
  review_status, is_published, show_on_homepage, homepage_order, source_confidence,
  last_reviewed_at, last_reviewed_by, updated_at
)
select
  ch.id, 'Human Remains', 'human-remains', 'Special Assistance', null, 'Cargo / Deceased Persons and Human Remains',
  'Human remains transport is handled by Cargo/dnata; the Contact Centre informs the customer and refers them to Cargo. Ashes may be carried in the cabin under conditions.',
  'Use for an enquiry about transporting human remains or carrying ashes.',
  jsonb_build_array('flydubai Cargo office / dnata Cargo Export'),
  null,
  jsonb_build_array('Contact Centre agent (information and referral only)', 'flydubai Cargo / dnata for acceptance'),
  jsonb_build_array('Whether the request is to transport human remains as cargo or to carry ashes in the cabin', 'Whether a passenger will accompany the remains'),
  jsonb_build_array('For transport, advise the required documents (cancelled passport copy, death certificate, police clearance, embassy/consulate certificate, embalming certificate — 7 copies in English, and Arabic for Islamic countries; two ticket copies if a passenger accompanies).', 'Refer the customer to the flydubai Cargo office / dnata Cargo Export; acceptance is subject to destination approval.', 'For ashes carried in the cabin, advise a sealed urn that fits under the seat or in the overhead bin, with a death certificate or crematorium letter for security.'),
  jsonb_build_array('Human remains transport is arranged and priced by Cargo/dnata.', 'Ashes may be carried in the cabin in a sealed urn with a death certificate or crematorium letter.'),
  jsonb_build_array('Ashes may be carried in the cabin under the documented conditions.'),
  jsonb_build_array('The Contact Centre does not grant acceptance authority for human remains transport.'),
  jsonb_build_array('Refer to the flydubai Cargo office / dnata Cargo Export.'),
  null,
  array['human remains','deceased','cargo','ashes','repatriation']::text[],
  array['Human remains','deceased']::text[],
  50,
  'needs_review', false, false, 0, 'source_backed', null, null, now()
from public.chapters ch
where ch.id = 'bc430cc5-5bdd-41c8-8e5e-26c17862520d'
  and not exists (select 1 from public.procedure_cards pc where pc.slug = 'human-remains');

-- 3.7 death-case (ch.43) — no automatic approval/refund
insert into public.procedure_cards (
  chapter_id, title, slug, category, service_code, service_type, summary, when_to_use,
  channels, cut_off_time, who_can_action, required_information, system_steps, passenger_advice,
  allowed, not_allowed, escalation_points, fees_charges, keywords, aliases, priority,
  review_status, is_published, show_on_homepage, homepage_order, source_confidence,
  last_reviewed_at, last_reviewed_by, updated_at
)
select
  ch.id, 'Death Case', 'death-case', 'Medical', null, 'Medical & Death / Bereavement Exception',
  'Death-case travel exception, handled through Let''s Talk with Customer Service validation; there is no automatic refund.',
  'Use when a passenger requests a fee-free change or refund due to a death.',
  jsonb_build_array('Contact Centre', 'Let''s Talk'),
  null,
  jsonb_build_array('Contact Centre agent', 'Supervisor / Floor Support to action', 'Customer Service to validate'),
  jsonb_build_array('Relationship to the deceased (passenger, immediate family, or second-degree relative)', 'Whether the death certificate, deceased passport copy, and proof of relationship are available', 'Whether Customer Service has validated the documents'),
  jsonb_build_array('Advise the passenger to email Let''s Talk with the death certificate, deceased passport copy, and proof of relationship.', 'Once Customer Service validates the documents and shares options, coordinate with Floor Support / a Supervisor to action the customer''s choice.'),
  jsonb_build_array('The request is subject to document validation and approval; there is no automatic refund.'),
  jsonb_build_array('A death exception may be considered after Customer Service validates the documents.'),
  jsonb_build_array('Do not auto-approve or auto-refund a death case.'),
  jsonb_build_array('Escalate unvalidated documents to a Supervisor for Customer Service follow-up.'),
  null,
  array['death case','bereavement','death certificate','medical exception']::text[],
  array['Death case','bereavement']::text[],
  60,
  'needs_review', false, false, 0, 'source_backed', null, null, now()
from public.chapters ch
where ch.id = '9fe727bd-74db-429d-8f35-18f9569b0863'
  and not exists (select 1 from public.procedure_cards pc where pc.slug = 'death-case');

-- 3.8 business-lounge (ch.64 DXB T2 ONLY) — card payment, airport only
insert into public.procedure_cards (
  chapter_id, title, slug, category, service_code, service_type, summary, when_to_use,
  channels, cut_off_time, who_can_action, required_information, system_steps, passenger_advice,
  allowed, not_allowed, escalation_points, fees_charges, keywords, aliases, priority,
  review_status, is_published, show_on_homepage, homepage_order, source_confidence,
  last_reviewed_at, last_reviewed_by, updated_at
)
select
  ch.id, 'Business Lounge – DXB T2', 'business-lounge', 'Airport', null, 'Airport / Business Lounge Access',
  'Purchase of DXB Terminal 2 Business Lounge access at the airport for eligible flydubai-operated flights.',
  'Use for a DXB T2 lounge-access purchase enquiry.',
  jsonb_build_array('Airport (DXB Terminal 2)'),
  null,
  jsonb_build_array('Airport team at DXB Terminal 2'),
  jsonb_build_array('Whether the flight is operated by flydubai', 'Payment method'),
  jsonb_build_array('Confirm the flight is operated by flydubai.', 'Take card payment via EZEtap at the airport (LNGS 4-hour or LNGL 8-hour).'),
  jsonb_build_array('Lounge access is purchased at the airport with a credit or debit card.', 'Adult and child (2-12) are charged; an infant is free with a paying adult.'),
  jsonb_build_array('Eligible flydubai passengers may purchase DXB T2 lounge access at the airport.'),
  jsonb_build_array('Cash, miles, or other forms of payment are not accepted.', 'Lounge purchasers do not board from the Business Class gate.'),
  jsonb_build_array(),
  'LNGS (4 hours) and LNGL (8 hours), card payment via EZEtap.',
  array['business lounge','lounge','DXB T2','LNGS','LNGL']::text[],
  array['Business lounge','lounge T2']::text[],
  45,
  'needs_review', false, false, 0, 'source_backed', null, null, now()
from public.chapters ch
where ch.id = 'd78ec279-74ae-4a09-9f68-ad006214174c'
  and not exists (select 1 from public.procedure_cards pc where pc.slug = 'business-lounge');

-- 3.9 blue-ribbon-bags (ch.26 Baggage) — FZ-operated only; no compensation guarantee
insert into public.procedure_cards (
  chapter_id, title, slug, category, service_code, service_type, summary, when_to_use,
  channels, cut_off_time, who_can_action, required_information, system_steps, passenger_advice,
  allowed, not_allowed, escalation_points, fees_charges, keywords, aliases, priority,
  review_status, is_published, show_on_homepage, homepage_order, source_confidence,
  last_reviewed_at, last_reviewed_by, updated_at
)
select
  ch.id, 'Blue Ribbon Bags', 'blue-ribbon-bags', 'Airport', 'IBAG', 'Airport / Baggage Protection',
  'Blue Ribbon Bags baggage protection (SSR IBAG) for journeys operated entirely by flydubai.',
  'Use for a Blue Ribbon Bags purchase or claim-follow-up enquiry.',
  jsonb_build_array('Check-in', 'DXB T2 self-service kiosk'),
  null,
  jsonb_build_array('Airport / check-in team', 'Shift-in-charge for a claim follow-up'),
  jsonb_build_array('Whether all journey sectors are operated by flydubai', 'Whether the request is a purchase or a claim follow-up'),
  jsonb_build_array('Confirm all sectors are operated by flydubai.', 'Add SSR IBAG (AED 10 for up to two bags per passenger per leg) at check-in or the T2 kiosk; each extra bag needs a separate purchase.', 'For a claim, confirm a PIR exists, advise submitting the claim to Blue Ribbon Bags within 24 hours of arrival, and consult the shift-in-charge.'),
  jsonb_build_array('Protection applies only when all sectors are operated by flydubai.', 'File any claim with Blue Ribbon Bags within 24 hours of arrival with a PIR.'),
  jsonb_build_array('Protection may be purchased for journeys operated entirely by flydubai.'),
  jsonb_build_array('Not available for sectors operated by another airline.', 'flydubai does not directly guarantee compensation; it is paid by Blue Ribbon Bags under its own conditions.'),
  jsonb_build_array('Consult the shift-in-charge for a claim or compensation follow-up.'),
  'AED 10 for up to two bags per passenger per leg (SSR IBAG); extra bags priced separately.',
  array['blue ribbon bags','BRB','baggage protection','IBAG']::text[],
  array['Blue Ribbon Bags','BRB']::text[],
  45,
  'needs_review', false, false, 0, 'source_backed', null, null, now()
from public.chapters ch
where ch.id = 'bce742a3-c221-4f0f-988b-b0e504db4638'
  and not exists (select 1 from public.procedure_cards pc where pc.slug = 'blue-ribbon-bags');

-- 3.10 worldtracer (ch.26 Baggage 26.6-26.9) — guided escalation; no promises
insert into public.procedure_cards (
  chapter_id, title, slug, category, service_code, service_type, summary, when_to_use,
  channels, cut_off_time, who_can_action, required_information, system_steps, passenger_advice,
  allowed, not_allowed, escalation_points, fees_charges, keywords, aliases, priority,
  review_status, is_published, show_on_homepage, homepage_order, source_confidence,
  last_reviewed_at, last_reviewed_by, updated_at
)
select
  ch.id, 'WorldTracer Baggage Handling', 'worldtracer', 'Airport', null, 'Baggage Services / WorldTracer',
  'Guided escalation for delayed, damaged, or lost baggage via WorldTracer and Baggage Services.',
  'Use for a delayed, damaged, or lost baggage follow-up.',
  jsonb_build_array('Contact Centre', 'Baggage Services', 'baggageservices@flydubai.com'),
  null,
  jsonb_build_array('Contact Centre agent', 'Supervisor / Baggage Services'),
  jsonb_build_array('Issue type (delayed, damaged/pilfered, or lost over 21 days)', 'Whether the passenger already has a PIR reference'),
  jsonb_build_array('Confirm the issue type and whether a PIR reference exists.', 'For a delayed or lost case with a PIR, check the WorldTracer status, update the passenger, and escalate/transfer to Baggage Services via SPRINT.', 'For a damaged or pilfered case, advise the passenger to send photos, the PIR, the bag tag and any receipts to baggageservices@flydubai.com.', 'Without a PIR, guide the passenger to the Baggage Services / airport reporting path and escalate.'),
  jsonb_build_array('A PIR reference from the arrival airport is needed for follow-up.'),
  jsonb_build_array(),
  jsonb_build_array('Do not promise recovery, reimbursement, compensation, or claim approval.'),
  jsonb_build_array('Transfer to Baggage Services; send damaged/pilfered evidence to baggageservices@flydubai.com.'),
  null,
  array['worldtracer','delayed baggage','damaged baggage','lost baggage','PIR']::text[],
  array['WorldTracer','delayed bag','lost baggage']::text[],
  50,
  'needs_review', false, false, 0, 'source_backed', null, null, now()
from public.chapters ch
where ch.id = 'bce742a3-c221-4f0f-988b-b0e504db4638'
  and not exists (select 1 from public.procedure_cards pc where pc.slug = 'worldtracer');

-- ------------------------------------------------------------
-- STEP 4 — Guarded content-alignment UPDATEs (existing cards)
-- Also returns them to manual review. Never touches source_version,
-- source_updated_at, last_reviewed_at, last_reviewed_by, or chapter_id.
-- ------------------------------------------------------------

-- 4.1 auto-split-od — thin draft -> verified FZ-FZ Auto Split OD scope
update public.procedure_cards
set
  title = 'Auto Split OD',
  service_type = 'Fare Types / Auto Split OD (FZ-FZ)',
  summary = 'Auto Split OD handling for FZ-FZ connection bookings when the two legs have different documented statuses.',
  when_to_use = 'Use for an FZ-FZ connection booking where one leg was boarded and the other was a no-show.',
  channels = jsonb_build_array('Contact Centre'),
  cut_off_time = null,
  who_can_action = jsonb_build_array('Contact Centre agent', 'Supervisor / Floor Support for a cancellation'),
  required_information = jsonb_build_array('Whether it is an eligible FZ-FZ connection (not interline, codeshare or circular)', 'Which leg was boarded and which was a no-show', 'Whether the request is to modify or cancel the affected leg'),
  system_steps = jsonb_build_array('Confirm the booking is an eligible FZ-FZ connection.', 'Confirm the leg status pattern; an OD split occurs only when the two legs have different statuses.', 'For Leg 1 boarded and Leg 2 no-show, modify the no-show leg per fare rules, or have Supervisor/Floor Support complete a cancellation.'),
  passenger_advice = jsonb_build_array('The unused sector is not refundable.'),
  allowed = jsonb_build_array('The no-show leg may be modified under the documented fare rules for a Leg 1 boarded / Leg 2 no-show pattern.'),
  not_allowed = jsonb_build_array('Auto Split OD does not apply to interline, codeshare, or circular itineraries.', 'Modification or cancellation is not permitted for a Leg 1 no-show / Leg 2 boarded pattern.'),
  escalation_points = jsonb_build_array('Cancellation of the no-show segment must be completed by the Supervisor / Floor Support in charge.'),
  fees_charges = null,
  keywords = array['auto split od','FZ-FZ','OD split','connection booking']::text[],
  aliases = array['Auto Split OD','OD split']::text[],
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  homepage_order = 0,
  source_confidence = 'source_backed',
  updated_at = now()
where slug = 'auto-split-od';

-- 4.2 government-deals — narrow to the implemented tree scope; CC cannot create/issue new deals
update public.procedure_cards
set
  title = 'Government Deals',
  service_type = 'Booking / Government Deals',
  summary = 'Handling of Government Deal bookings; new discounted bookings are Travel Shop handled and cannot be created or issued by the Contact Centre.',
  when_to_use = 'Use for a Government Deal enquiry (create, add a passenger, or modify/cancel).',
  channels = jsonb_build_array('Contact Centre (modification/cancellation only)', 'flydubai retail offices in the UAE (new deal bookings)'),
  cut_off_time = null,
  who_can_action = jsonb_build_array('Contact Centre agent (limited)', 'flydubai Travel Shop for new deal bookings', 'Floor Support / Supervisor for adding an adult or child'),
  required_information = jsonb_build_array('Request type (create, add an adult or child, add an infant, or modify/cancel)', 'Whether the itinerary is interline or codeshare'),
  system_steps = jsonb_build_array('For a new discounted booking, refer the passenger to an eligible flydubai Travel Shop; the Contact Centre and the DXB Airport office cannot create or issue a new deal.', 'To add an adult or child, refer to the Travel Shop for the discount, or after consulting Floor Support / a Supervisor create a separate non-discounted booking.', 'The agent may assist with adding an infant to an existing deal booking.', 'Modification or cancellation may be handled through the Contact Centre or eligible retail shops per the deal fare rules; multi-city modifications go through the ticket issuer.'),
  passenger_advice = jsonb_build_array('New Government Deal bookings are issued only at eligible flydubai retail offices in the UAE.', 'A standalone child booking created without the deal is not entitled to OLCI or online modification.'),
  allowed = jsonb_build_array('The Contact Centre may assist with adding an infant and with modification or cancellation subject to the deal fare rules.'),
  not_allowed = jsonb_build_array('The Contact Centre cannot create or issue a new Government Deal booking.', 'Government Deals are not applicable to interline or codeshare bookings.'),
  escalation_points = jsonb_build_array('Consult Floor Support / a Supervisor before creating a separate non-discounted booking for an added adult or child.'),
  fees_charges = null,
  keywords = array['government deals','esaad','al saada','fazaa','GDRFA']::text[],
  aliases = array['Government deals','Govt deals']::text[],
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  homepage_order = 0,
  source_confidence = 'source_backed',
  updated_at = now()
where slug = 'government-deals';

-- ------------------------------------------------------------
-- STEP 5 — Metadata-only review reset (source-correct stale cards)
-- No content change. Never touches source_version, source_updated_at,
-- last_reviewed_at, last_reviewed_by, or chapter_id.
-- (auto-split-od and government-deals already reset in STEP 4.)
-- ------------------------------------------------------------
update public.procedure_cards
set
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  homepage_order = 0,
  source_confidence = 'source_backed',
  updated_at = now()
where slug in (
  'wheelchair',
  'name-correction',
  'falcon-handling',
  'ok-to-board',
  'meda',
  'dpna',
  'plaster-cast-leg-brace'
);

commit;

-- ============================================================
-- POST-RUN REPORTS (read-only)
-- ============================================================

-- ------------------------------------------------------------
-- REPORT 6 — Generic-filler check across the K.1 cards.
-- Expected: zero rows.
-- ------------------------------------------------------------
select pc.slug, 'generic filler detected' as issue
from public.procedure_cards pc
where pc.slug in (
  'duplicate-booking','travel-requirements','visa-change','oxygen','service-animal',
  'human-remains','death-case','business-lounge','blue-ribbon-bags','worldtracer',
  'auto-split-od','government-deals'
)
and (
  coalesce(pc.summary,'') || ' ' || coalesce(pc.when_to_use,'') || ' ' ||
  coalesce(pc.cut_off_time,'') || ' ' || coalesce(pc.fees_charges,'') || ' ' ||
  coalesce(pc.channels::text,'') || ' ' || coalesce(pc.who_can_action::text,'') || ' ' ||
  coalesce(pc.required_information::text,'') || ' ' || coalesce(pc.system_steps::text,'') || ' ' ||
  coalesce(pc.passenger_advice::text,'') || ' ' || coalesce(pc.allowed::text,'') || ' ' ||
  coalesce(pc.not_allowed::text,'') || ' ' || coalesce(pc.escalation_points::text,'')
) ~* '(check source|refer to chapter|according to source|where source allows|pending review|escalate if unclear|source-backed guidance)';

-- ------------------------------------------------------------
-- REPORT 7 — Missing-card report (registered workflows still without a card).
-- Expected: meet-assist only (BLOCKED — no uniquely verified chapter row).
-- ------------------------------------------------------------
with reg(slug) as (
  values ('pregnancy'),('sporting-equipment'),('check-in-olci'),('flight-disruption'),
    ('extra-seat-cbbg'),('minimum-connection-time'),('wheelchair'),('name-correction'),
    ('falcon-handling'),('duplicate-booking'),('government-deals'),('auto-split-od'),
    ('travel-requirements'),('ok-to-board'),('visa-change'),('meet-assist'),('business-lounge'),
    ('blue-ribbon-bags'),('worldtracer'),('meda'),('oxygen'),('service-animal'),
    ('plaster-cast-leg-brace'),('dpna'),('human-remains'),('death-case')
)
select reg.slug as workflow_without_card
from reg
left join public.procedure_cards pc on pc.slug = reg.slug
where pc.id is null
order by reg.slug;

-- ------------------------------------------------------------
-- REPORT 8 — Broken chapter-link report (K.1 cards whose chapter_id is missing).
-- Expected: zero rows.
-- ------------------------------------------------------------
select pc.slug, pc.chapter_id
from public.procedure_cards pc
left join public.chapters ch on ch.id = pc.chapter_id
where pc.slug in (
  'duplicate-booking','travel-requirements','visa-change','oxygen','service-animal',
  'human-remains','death-case','business-lounge','blue-ribbon-bags','worldtracer'
)
and (pc.chapter_id is null or ch.id is null);

-- ------------------------------------------------------------
-- REPORT 9 — Duplicate-slug report. Expected: zero rows.
-- ------------------------------------------------------------
select slug, count(*) as card_count
from public.procedure_cards
group by slug
having count(*) > 1
order by slug;

-- ------------------------------------------------------------
-- REPORT 10 — Post-run readiness for all 26 registered workflows.
-- Pregnancy tree version = 81.2 (already available; untouched here).
-- ------------------------------------------------------------
with reg(slug, tree_version) as (
  values
    ('pregnancy','81.2'),('sporting-equipment','81.2'),('check-in-olci','81.2'),
    ('flight-disruption','81.2'),('extra-seat-cbbg','81.2'),('minimum-connection-time','81.2'),
    ('wheelchair','81.2'),('name-correction','81.2'),('falcon-handling','81.2'),
    ('duplicate-booking','81.2'),('government-deals','81.2'),('auto-split-od','81.2'),
    ('travel-requirements','81.2'),('ok-to-board','81.2'),('visa-change','81.2'),
    ('meet-assist','81.2'),('business-lounge','81.2'),('blue-ribbon-bags','81.2'),
    ('worldtracer','81.2'),('meda','81.2'),('oxygen','81.2'),('service-animal','81.2'),
    ('plaster-cast-leg-brace','81.2'),('dpna','81.2'),('human-remains','81.2'),('death-case','81.2')
)
select
  reg.slug,
  (pc.id is not null)        as card_exists,
  pc.review_status,
  pc.is_published,
  pc.source_confidence,
  pc.source_version          as card_source_version,
  ch.slug                    as chapter_slug,
  ch.source_version          as chapter_source_version,
  reg.tree_version,
  case
    when pc.id is null                                              then 'NO CARD (blocked/unlinked)'
    when ch.id is null                                             then 'NO CHAPTER LINK'
    when pc.is_published is not true or pc.review_status <> 'approved' then 'NEEDS REVIEW / UNPUBLISHED'
    when substring(pc.source_version from '[0-9]+\.[0-9]+')
         is distinct from substring(reg.tree_version from '[0-9]+\.[0-9]+') then 'CARD/TREE VERSION MISMATCH'
    when substring(pc.source_version from '[0-9]+\.[0-9]+')
         is distinct from substring(ch.source_version from '[0-9]+\.[0-9]+') then 'CARD BEHIND CHAPTER'
    else 'AVAILABLE'
  end as status
from reg
left join public.procedure_cards pc on pc.slug = reg.slug
left join public.chapters ch on ch.id = pc.chapter_id
order by reg.slug;
