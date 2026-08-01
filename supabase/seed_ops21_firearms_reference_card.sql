-- ============================================================
-- OPS-2.1: Firearms and Carry of Ammunition — reviewed REFERENCE card.
--
-- Source: The GO TO document v81.7 (30-Jul-2026), chapter 29
--         "Firearms and Carry of Ammunition", pages 130-132.
--
-- This is a CONTENT card only. It introduces no workflow, no decision tree,
-- no questions and no outcomes: the slug has no entry in DECISION_DEFINITIONS,
-- so getWorkflowAvailability() reports "unavailable_no_tree" and the guided
-- entry point is never offered for it.
--
-- Every field below is transcribed from the chapter body. Nothing is inferred.
-- Idempotent: safe to re-run (insert ... on conflict (slug) do update).
-- ============================================================

insert into procedure_cards (
  title, slug, category, service_code, service_type,
  summary, when_to_use, cut_off_time,
  channels, who_can_action, required_information, system_steps,
  passenger_advice, allowed, not_allowed, escalation_points,
  fees_charges, required_approval,
  keywords, aliases,
  source_pages, source_version, priority,
  review_status, is_published
) values (
  'Firearms and Carry of Ammunition',
  'firearms-ammunition',
  'Baggage',
  'WEAP',
  'Reference',
  'flydubai accepts firearms and ammunition at a charge of AED 300 per passenger. Firearms or ammunition can be carried as checked-in baggage only, and require documents 4 working days before the date of travel plus security approval.',
  'Passenger asks about travelling with a firearm, weapon or ammunition.',
  'Documents must reach Security@flydubai.com at least 4 working days prior to the intended date of travel.',
  jsonb_build_array(
    'Contact Centre',
    'letstalk@flydubai.com (customer submission)',
    'Security@flydubai.com (approval)',
    'Customer Service Group via chatter'
  ),
  jsonb_build_array(
    'Contact Centre agent (collect details, advise process)',
    'Contact Centre Supervisor (raise follow-up request to Customer Service Group)',
    'FZ security (obtains Dubai Police approval)'
  ),
  jsonb_build_array(
    'Name of the passenger',
    'Nationality',
    'Passport details/copy',
    'Passenger PNR',
    'Flight details',
    'Details of the weapon',
    'Make, caliber and model',
    'Serial Number',
    'License copy',
    'Number of firearms',
    'Quantity of ammunition/weight',
    'Purpose of carriage (Invitation Letter if it is for a sports/hunting event)'
  ),
  jsonb_build_array(
    'If the passenger has not written to flydubai (or wrote with incomplete information): inform the customer to email letstalk@flydubai.com with the required details.',
    'Inform the customer of the approval turnaround time (4 days prior to journey) and the cost per passenger, SSR: WEAP AED 300.',
    'Advise that unloaded weapons must be declared during the check-in process, with the maximum gross weight of the ammunition not exceeding 5kg, packed in a sturdy box.',
    'Inform the customer that carriage is subject to approval.',
    'Update SPRINT comments.',
    'If the passenger already wrote to flydubai: retrieve the case number and verify all 12 required details, then create and escalate the case in Salesforce to a supervisor.',
    'Supervisor: create a follow-up request to Customer Service Group via chatter, entitled "firearms/ammunition", so that the CS Group picks it up on priority.'
  ),
  jsonb_build_array(
    'Firearms or ammunition can be carried as checked-in baggage only.',
    'Documents must be provided in writing at least 4 working days before travel; carriage is subject to security approval.',
    'The charge is AED 300 per passenger (SSR WEAP).',
    'Approval is valid only for that flight/date/sector. A new approval is required if the date of travel changes, and new charges will apply.'
  ),
  jsonb_build_array(
    'Firearms and ammunition accepted as checked-in baggage at a charge of AED 300 per passenger, once documents are checked and security approval is obtained.',
    'Unloaded weapons declared at check-in, ammunition maximum gross weight 5kg, packed in a sturdy box.'
  ),
  jsonb_build_array(
    'Firearms or ammunition cannot be carried in the cabin — checked-in baggage only.',
    'Ammunition exceeding 5kg maximum gross weight is not accepted.',
    'An existing approval is not valid after a change of travel date; a new approval and new charges apply.'
  ),
  jsonb_build_array(
    'Forward the request with all relevant documents to FZ security to obtain the necessary approval from the Dubai Police authority.',
    'Supervisor raises a follow-up request to the Customer Service Group via chatter, entitled "firearms/ammunition".',
    'Once approval is received, Res Support keeps a reminder to send an advisory to the Airports regarding weapons on the flight.',
    'Security informs NCC, AIRPORT and the originator of the request of the approval.'
  ),
  'AED 300 (SSR WEAP) per passenger. If three passengers travel with weapons on the same PNR, three SSR WEAP are added at AED 300 each. This charge is for permissions arranged with Dubai Police. For Interline / Codeshare with EK bookings, if the origin is on OAL the OAL carrier ideally handles the request; if the request comes to flydubai to obtain approval, the charge applies.',
  'Security approval from the Dubai Police authority, obtained via FZ security.',
  array['firearms', 'firearm', 'ammunition', 'ammo', 'weapon', 'weapons', 'rifle', 'pistol', 'gun', 'WEAP', 'arms'],
  array['WEAP', 'firearms and ammunition', 'carry of ammunition', 'weapon carriage', 'firearm declaration'],
  array[130, 131, 132],
  '81.7 (30-Jul-2026)',
  0,
  'approved',
  true
)
on conflict (slug) do update set
  title = excluded.title,
  category = excluded.category,
  service_code = excluded.service_code,
  service_type = excluded.service_type,
  summary = excluded.summary,
  when_to_use = excluded.when_to_use,
  cut_off_time = excluded.cut_off_time,
  channels = excluded.channels,
  who_can_action = excluded.who_can_action,
  required_information = excluded.required_information,
  system_steps = excluded.system_steps,
  passenger_advice = excluded.passenger_advice,
  allowed = excluded.allowed,
  not_allowed = excluded.not_allowed,
  escalation_points = excluded.escalation_points,
  fees_charges = excluded.fees_charges,
  required_approval = excluded.required_approval,
  keywords = excluded.keywords,
  aliases = excluded.aliases,
  source_pages = excluded.source_pages,
  source_version = excluded.source_version,
  updated_at = now();

-- Link the card to the v81.7 Firearms chapter when that chapter row exists.
update procedure_cards pc set
  chapter_id = c.id,
  updated_at = now()
from chapters c
where pc.slug = 'firearms-ammunition'
  and c.chapter_number = 29
  and c.source_version like '81.7%'
  and (pc.chapter_id is distinct from c.id);

-- ---------- Verification ----------
-- select slug, title, service_code, source_version, review_status, is_published
--   from procedure_cards where slug = 'firearms-ammunition';
-- The slug must NOT appear in any decision-tree registry: guided questions are
-- never offered for a reference card.
