// Sporting Equipment decision tree (Phase D).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 28 "Sporting Equipment", pages 126-131. Rules verified verbatim:
//   - Pre-booking: equipment 24h / sporting weapons 96h before departure (p.126).
//   - <24h: SUP/FS only may add SPEQ/SPEX up to 12h prior, max 10 equipment
//     per flight; beyond 10 needs Special Handling approval (p.126 §1-3).
//   - Dimension bands: hand/checked dims free; 160-189 cm SPEQ AED150/flight;
//     190-350 cm SPEX AED270/flight (p.126 table).
//   - >350 cm, pole vaults/javelins/hang gliders: pre-authorization 48h,
//     additional charges (p.127). Weapons: pre-auth 96h + AED300 Dubai Police
//     fee per passenger per sector (p.127); docs 4 working days (p.131).
//   - Refund: handling fee refundable up to 24h prior; within 24h
//     non-refundable/non-transferable (p.126 §12); cancellation refund in
//     voucher form via Sup/FS -> RES (p.129 notes 1-2).
//   - Go-show accepted subject to space and payload (p.126 §14); arrive 2h
//     prior (p.126 §13). Connecting/interline/codeshare: Supervisor adds the
//     SSR per sector (pp.128-130).

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const SPORTING_EQUIPMENT_DEFINITION: DecisionDefinition = {
  procedureSlug: "sporting-equipment",
  procedureTitle: "Sporting Equipment",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "28. Sporting Equipment",
  sourcePages: [126, 127, 128, 129, 130, 131],
  questions: QUESTION_SETS["sporting-equipment"],
  rules: [
    {
      id: "refund-outside-24h",
      conditions: [
        { questionId: "speq_request", equals: "Cancel or refund an existing equipment fee" },
        { questionId: "hours_before_departure", min: 24 },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "Cancelling SPEX/SPEQ is permitted up to 24 hours prior to departure; the handling fee is refundable and the refund is issued in voucher form.",
      nextAction:
        "Escalate the cancellation request to Sup/FS in charge; SUP/FS sends the request to RES and the voucher is issued.",
      sourcePages: [126, 129],
      sourceField: "fees_charges / escalation_points",
    },
    {
      id: "refund-inside-24h",
      conditions: [
        { questionId: "speq_request", equals: "Cancel or refund an existing equipment fee" },
        { questionId: "hours_before_departure", max: 23 },
      ],
      outcome: "Not permitted",
      explanation:
        "Within 24 hours of departure the handling fee is non-refundable and non-transferable; it can only be used by the passenger for the specific flight and sector for which it is paid.",
      sourcePages: [126],
      sourceField: "not_allowed",
    },
    {
      id: "weapon-under-96h",
      conditions: [
        { questionId: "speq_request", equals: "New equipment booking" },
        { questionId: "equipment_kind", equals: "Sporting weapon, firearm or ammunition" },
        { questionId: "hours_before_departure", max: 95 },
      ],
      outcome: "Not permitted",
      explanation:
        "Sporting weapons must be pre-booked at least 96 hours prior to departure and approval documents are required 4 working days before travel; there is insufficient notice for this flight.",
      sourcePages: [126, 127, 131],
      sourceField: "cut_off_time",
    },
    {
      id: "weapon-96h-plus",
      conditions: [
        { questionId: "speq_request", equals: "New equipment booking" },
        { questionId: "equipment_kind", equals: "Sporting weapon, firearm or ammunition" },
        { questionId: "hours_before_departure", min: 96 },
      ],
      outcome: "Requires supervisor",
      explanation:
        "Sporting weapons, firearms and ammunition are carried as checked-in baggage only, subject to security approval. AED 300 per passenger per sector applies for Dubai Police approval, in addition to SPEX charges per item per passenger per sector.",
      nextAction:
        "Collect the weapon details (passenger name, nationality, passport, PNR, flight, weapon make/caliber/model, serial number, license copy, number of firearms, ammunition quantity/weight, purpose) and escalate through Supervisor to the Customer Service Group / Security approval flow. Ammunition gross weight must not exceed 5 kg, packed in a sturdy box.",
      sourcePages: [127, 130, 131],
      sourceField: "escalation_points / required_information",
    },
    {
      id: "restricted-item-under-48h",
      conditions: [
        { questionId: "speq_request", equals: "New equipment booking" },
        { questionId: "equipment_kind", equals: "Pole vault, javelin or hang glider" },
        { questionId: "hours_before_departure", max: 47 },
      ],
      outcome: "Not permitted",
      explanation:
        "Pole vaults, javelins and hang gliders are subject to pre-authorization 48 hours before departure; there is insufficient notice for this flight.",
      sourcePages: [127],
      sourceField: "cut_off_time",
    },
    {
      id: "restricted-item-48h-plus",
      conditions: [
        { questionId: "speq_request", equals: "New equipment booking" },
        { questionId: "equipment_kind", equals: "Pole vault, javelin or hang glider" },
        { questionId: "hours_before_departure", min: 48 },
      ],
      outcome: "Requires supervisor",
      explanation:
        "Pole vaults, javelins and hang gliders require pre-authorization 48 hours before departure and additional charges apply.",
      nextAction: "Obtain pre-authorization before confirming carriage; do not commit charges to the passenger without it.",
      sourcePages: [127],
      sourceField: "system_steps",
    },
    {
      id: "over-350cm-under-48h",
      conditions: [
        { questionId: "speq_request", equals: "New equipment booking" },
        { questionId: "total_dimension_cm", min: 351 },
        { questionId: "hours_before_departure", max: 47 },
      ],
      outcome: "Not permitted",
      explanation:
        "Sporting equipment beyond 350 cm (L+W+H) is subject to pre-authorization 48 hours before departure; there is insufficient notice for this flight.",
      sourcePages: [127],
      sourceField: "cut_off_time",
    },
    {
      id: "over-350cm-48h-plus",
      conditions: [
        { questionId: "speq_request", equals: "New equipment booking" },
        { questionId: "total_dimension_cm", min: 351 },
        { questionId: "hours_before_departure", min: 48 },
      ],
      outcome: "Requires supervisor",
      explanation:
        "Sporting equipment beyond 350 cm (L+W+H) requires pre-authorization 48 hours before departure and additional charges apply.",
      nextAction: "Obtain pre-authorization before confirming carriage.",
      sourcePages: [127],
      sourceField: "system_steps",
    },
    {
      id: "over-10-pieces",
      conditions: [
        { questionId: "speq_request", equals: "New equipment booking" },
        { questionId: "equipment_count", min: 11 },
      ],
      outcome: "Requires supervisor",
      explanation:
        "The maximum limit is 10 equipment per flight; any request beyond 10 needs approval from the Special Handling team.",
      nextAction: "Escalate to the Special Handling team for approval before confirming.",
      sourcePages: [126],
      sourceField: "escalation_points",
    },
    {
      id: "interline-codeshare",
      conditions: [
        { questionId: "speq_request", equals: "New equipment booking" },
        { questionId: "journey_type", equals: "Interline or codeshare" },
      ],
      outcome: "Requires supervisor",
      explanation:
        "For interline/codeshare itineraries the Supervisor adds the SSR per sector. Handling fees apply only on flydubai-operated flights; onward acceptance is subject to the other carrier's approval and charges, and partners cannot be charged if they do not charge currently.",
      nextAction:
        "Escalate to Supervisor to add the SSR and advise the customer to call back for payment completion, if any.",
      sourcePages: [128, 129, 130],
      sourceField: "escalation_points",
    },
    {
      id: "standard-24h-plus-free-size",
      conditions: [
        { questionId: "speq_request", equals: "New equipment booking" },
        { questionId: "equipment_kind", equals: "Standard sporting equipment" },
        { questionId: "hours_before_departure", min: 24 },
        { questionId: "total_dimension_cm", max: 159 },
      ],
      outcome: "Can proceed",
      explanation:
        "Equipment within checked baggage dimensions (L+W+H up to 159 cm) carries no handling fee and is accepted as part of the passenger's checked baggage allowance.",
      nextAction:
        "Advise the passenger to arrive at least 2 hours prior to departure; excess baggage rates apply only if the weight exceeds the allowance.",
      sourcePages: [126],
      sourceField: "allowed",
    },
    {
      id: "standard-24h-plus-speq",
      conditions: [
        { questionId: "speq_request", equals: "New equipment booking" },
        { questionId: "equipment_kind", equals: "Standard sporting equipment" },
        { questionId: "hours_before_departure", min: 24 },
        { questionId: "total_dimension_cm", min: 160, max: 189 },
      ],
      outcome: "Can proceed",
      explanation:
        "Equipment of 160-189 cm (L+W+H): add SSR SPEQ per leg. The handling fee is AED 150 per item per flight (per sector on connections).",
      nextAction:
        "Add SPEQ per leg, collect payment, update SPRINT comments, and advise arrival at least 2 hours prior to departure.",
      sourcePages: [126, 129, 130],
      sourceField: "system_steps / fees_charges",
    },
    {
      id: "standard-24h-plus-spex",
      conditions: [
        { questionId: "speq_request", equals: "New equipment booking" },
        { questionId: "equipment_kind", equals: "Standard sporting equipment" },
        { questionId: "hours_before_departure", min: 24 },
        { questionId: "total_dimension_cm", min: 190, max: 350 },
      ],
      outcome: "Can proceed",
      explanation:
        "Equipment of 190-350 cm (L+W+H): add SSR SPEX per leg. The handling fee is AED 270 per item per flight (per sector on connections).",
      nextAction:
        "Add SPEX per leg, collect payment, update SPRINT comments, and advise arrival at least 2 hours prior to departure.",
      sourcePages: [126, 129, 130],
      sourceField: "system_steps / fees_charges",
    },
    {
      id: "standard-12-to-24h",
      conditions: [
        { questionId: "speq_request", equals: "New equipment booking" },
        { questionId: "equipment_kind", equals: "Standard sporting equipment" },
        { questionId: "hours_before_departure", min: 12, max: 23 },
      ],
      outcome: "Requires supervisor",
      explanation:
        "Inside 24 hours, check with the SUP in charge: SUP/FS only may add SPEQ/SPEX up to 12 hours prior to departure, within the maximum limit of 10 equipment per flight.",
      nextAction: "Refer the request to Supervisor / Floor Support in charge.",
      sourcePages: [126],
      sourceField: "cut_off_time / escalation_points",
    },
    {
      id: "standard-under-12h-goshow",
      conditions: [
        { questionId: "speq_request", equals: "New equipment booking" },
        { questionId: "equipment_kind", equals: "Standard sporting equipment" },
        { questionId: "hours_before_departure", max: 11 },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "Under 12 hours the SSR can no longer be added (SUP/FS window closed). Go-show sporting equipment is accepted at the airport only, subject to space and payload availability.",
      nextAction: "Advise airport go-show handling only; acceptance is not guaranteed.",
      sourcePages: [126],
      sourceField: "passenger_advice",
    },
  ],
  notes: [
    "Passengers travelling with sporting equipment must arrive at least 2 hours prior to flight departure.",
    "No sports equipment is accepted over 32 kg per item for health and safety reasons.",
    "No dangerous goods can be carried in sports equipment except as permitted under IATA DGR Table 2.3.A.",
    "Weapon/firearms approval is valid only for the approved flight, date and sector; a new approval is required if the travel date changes.",
    "May also need: Airport / Special Handling reference for weapons and out-of-limit requests.",
  ],
};
