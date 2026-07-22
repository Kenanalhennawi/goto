-- ============================================================
-- Phase J-D Batch 2: Travel Requirements card alignment
--
-- Source of truth: The GO TO document v81.2 (10-Jul-2026),
-- chapter 48 "Visa" (incl. 48.1 "Visa Change"), page 271.
--
-- Why this file exists:
--   The existing `visa` procedure card held UAE-residency / Emirates ID
--   content, which in v81.2 belongs to chapter 49 "Travel Requirements to
--   travel from UAE" (page 272), not to the Visa chapter. This is a verified
--   scope mismatch against v81.2. This file re-aligns the `visa` card to the
--   actual v81.2 Visa chapter text (enquiry-redirect + Visa Change handling).
--
-- Scope and safety (intentional, do not change):
--   - Updates exactly one slug: 'visa'. Nothing else is touched.
--   - The `ok-to-board` card already matches v81.2 chapter 50; it is NOT
--     modified here (its only difference is the source_version snapshot, which
--     must not be faked).
--   - Keeps review_status = 'needs_review'.
--   - Keeps is_published = false.
--   - Keeps show_on_homepage = false.
--   - Keeps source_confidence = 'source_backed'.
--   - Does NOT modify source_version (no faked snapshot).
--   - Does NOT modify last_reviewed_at or last_reviewed_by.
--   - Does NOT approve, publish, or feature anything.
--   - Fields that depend on unparsed tables/screenshots or are not stated in
--     the source text are left blank rather than invented.
--
-- Follow-up (NOT done here, requires the normal card-authoring process):
--   - A `travel-requirements` card (Emirates ID / UAE-residency return travel,
--     ch.49 p.272) does not exist and is not fabricated here.
--   - A `visa-change` card (ch.48.1 p.271) does not exist and is not fabricated.
--   - The `ok-to-board` card needs a v81.2 source refresh + review/publish before
--     its guided workflow can become available.
-- ============================================================

update public.procedure_cards
set
  title = 'Visa',
  service_type = 'Travel Document / Visa Reference',
  summary = 'How to route UAE and transit visa enquiries, and how visa-change travel is handled.',
  when_to_use = 'Use when a passenger asks about a UAE or transit visa, or about visa-change travel for re-entry to the UAE.',
  channels = jsonb_build_array(
    'visa.dxb@flydubai.com',
    'flydubai Travel Shop within the UAE (transit visa: Dubai - Deira shop only)'
  ),
  cut_off_time = null,
  who_can_action = jsonb_build_array('flydubai Travel Shop', 'Visa team (visa.dxb@flydubai.com)'),
  required_information = jsonb_build_array(
    'Whether the enquiry is a transit visa or another UAE visa (routing differs)',
    'For visa-change travel: route (MCT, KWI or BAH), a valid UAE visa held in hand before departure, and both flights under the same PNR'
  ),
  system_steps = jsonb_build_array(
    'For a transit visa enquiry or processing, direct the customer to visa.dxb@flydubai.com or the flydubai Travel Shop in Dubai (Deira) only.',
    'For any other UAE visa enquiry or processing, direct the customer to visa.dxb@flydubai.com or any flydubai Travel Shop within the UAE.',
    'Do not provide visa-related details over the call.',
    'For visa-change travel, refer the passenger to one of the authorized travel agents; only bookings created by those agents are accepted at the airport.'
  ),
  passenger_advice = jsonb_build_array(
    'Contact visa.dxb@flydubai.com or a flydubai Travel Shop for visa enquiries and processing.',
    'For visa-change travel, hold a valid UAE visa in hand before departure for re-entry, and keep both flights under the same PNR.'
  ),
  allowed = jsonb_build_array(
    'Visa-change travel is applicable to MCT, KWI and BAH, booked through an authorized travel agent, with the passenger through-checked from DXB with a printed boarding pass for API clearance.'
  ),
  not_allowed = jsonb_build_array(
    'Agents must not provide any visa-related details over the call.'
  ),
  escalation_points = jsonb_build_array(
    'If the passenger is a NOSHOW on the outbound visa-change flight, refer to the supervisor in charge.'
  ),
  fees_charges = null,
  keywords = array['visa', 'visa change', 'transit visa', 'UAE visa'],
  aliases = array['VISA', 'UAE visa', 'visa change'],
  review_status = 'needs_review',
  is_published = false,
  show_on_homepage = false,
  source_confidence = 'source_backed',
  updated_at = now()
where slug = 'visa'
  and source_confidence = 'source_backed';
