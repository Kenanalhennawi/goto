// Sporting Equipment decision tree (rewritten in UPD-1 for the new process
// effective 01-Aug-2026).
// Source of truth: The GO TO document v81.7 (30-Jul-2026),
// chapter 28 "Sporting Equipment", pages 126-129. Rules verified verbatim:
//   - Equipment is accepted as part of the checked baggage allowance; excess
//     weight follows the standard excess baggage policy. "No additional
//     sporting equipment charges apply." (p.126 §1-5).
//   - SSRs: SPEQ (equipment) and BIKE (bicycles). Flight inventory 20 pieces:
//     max 10 SPEQ + 10 BIKE; >10 bikes needs prior confirmation, subject to
//     space and payload (p.126 §7).
//   - <24h: check with SUP in charge; only SUP/FS may add the SSR, up to 12h
//     prior, subject to inventory (p.126 §6-7). GOSHOW accepted subject to
//     space and payload (§8).
//   - Dimensions: max 300 cm total (L+W+H), width ≤115 cm, height ≤80 cm;
//     oversized equipment is NOT permitted and must travel as cargo/freight
//     (p.126 §9-10). Max 32 kg per item — never accepted above (§11-13).
//   - Check-in at least 2 hours before departure (§15).
//   - SSR SPEX is no longer used effective 01-Aug-2026 (p.127 §22).
//   - Sporting weapons/firearms/ammunition: pre-book 96h; AED 300 per
//     passenger per sector for Dubai Police approval; documents to
//     Security@flydubai.com at least 4 working days prior (pp.127, 129, 131).
//   - FZ connections: agent escalates, Supervisor adds BIKE/SPEQ per sector
//     (p.128). Interline/codeshare: the passenger must confirm acceptance with
//     the onward carrier(s) and provide confirmation where required (p.126 §21).

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const SPORTING_EQUIPMENT_DEFINITION: DecisionDefinition = {
  procedureSlug: "sporting-equipment",
  procedureTitle: "Sporting Equipment",
  version: 2,
  sourceVersion: "81.7 (30-Jul-2026)",
  sourceChapter: "28. Sporting Equipment",
  sourcePages: [126, 127, 128, 129],
  questions: QUESTION_SETS["sporting-equipment"],
  rules: [
    {
      id: "weapon-under-96h",
      conditions: [
        { questionId: "equipment_kind", equals: "Sporting weapon, firearm or ammunition" },
        { questionId: "hours_before_departure", max: 95 },
      ],
      outcome: "Not permitted",
      explanation:
        "Sporting weapons, firearms and ammunition must be pre-booked at least 96 hours before departure; there is insufficient notice for this flight.",
      sourcePages: [126, 127],
      sourceField: "96-hour weapon pre-booking",
    },
    {
      id: "weapon-96h-plus",
      conditions: [
        { questionId: "equipment_kind", equals: "Sporting weapon, firearm or ammunition" },
        { questionId: "hours_before_departure", min: 96 },
      ],
      outcome: "Requires supervisor",
      explanation:
        "Weapons, firearms and ammunition are carried as checked baggage only, subject to Dubai Police approval at AED 300 per passenger per sector (SSR WEAP).",
      nextAction:
        "Direct the passenger to email the required documents (passport, license, weapon details, serial number, quantity, purpose) to Security@flydubai.com at least 4 working days before travel, or letstalk@flydubai.com if starting from scratch. Unloaded weapons declared at check-in; ammunition max 5 kg gross in a sturdy box. Escalate the case to a Supervisor.",
      sourcePages: [127, 129],
      sourceField: "Weapon approval and AED 300 per-sector charge",
    },
    {
      id: "over-32kg",
      conditions: [{ questionId: "item_weight_kg", min: 33 }],
      outcome: "Not permitted",
      explanation:
        "No sporting equipment exceeding 32 kg per individual item is accepted, due to health and safety regulations.",
      sourcePages: [126],
      sourceField: "32 kg per-item maximum",
    },
    {
      id: "over-300cm",
      conditions: [{ questionId: "total_dimension_cm", min: 301 }],
      outcome: "Not permitted",
      explanation:
        "Maximum permitted dimensions are 300 cm total (L+W+H), width ≤115 cm and height ≤80 cm. Oversized sporting equipment is not permitted for carriage.",
      nextAction: "Advise the passenger that items exceeding the maximum dimensions must be transported as cargo or freight.",
      sourcePages: [126],
      sourceField: "300 cm maximum; oversized to cargo",
    },
    {
      id: "over-10-pieces",
      conditions: [{ questionId: "equipment_count", min: 11 }],
      outcome: "Requires supervisor",
      explanation:
        "The per-flight inventory is 20 pieces (max 10 SPEQ and max 10 BIKE). Requests beyond the 10-piece limit need prior confirmation and are subject to space and payload availability.",
      nextAction: "Escalate to a Supervisor for prior confirmation before accepting the request.",
      sourcePages: [126],
      sourceField: "Per-flight SSR inventory limits",
    },
    {
      id: "under-12h-goshow",
      conditions: [{ questionId: "hours_before_departure", max: 11 }],
      outcome: "Can proceed with conditions",
      explanation:
        "Inside the 12-hour SSR window, GOSHOW sporting equipment is accepted subject to space and payload availability at the airport.",
      nextAction: "Advise the passenger to report at check-in at least 2 hours before departure; acceptance is decided at the airport.",
      sourcePages: [126],
      sourceField: "GOSHOW acceptance",
    },
    {
      id: "within-24h-supervisor",
      conditions: [{ questionId: "hours_before_departure", min: 12, max: 23 }],
      outcome: "Requires supervisor",
      explanation:
        "Within 24 hours of departure, only Supervisors/FS are authorized to add SSR SPEQ/BIKE, up to 12 hours prior, subject to inventory availability.",
      nextAction: "Check with the SUP in charge whether the SSR can still be added.",
      sourcePages: [126],
      sourceField: "SUP/FS 12-24h window",
    },
    {
      id: "fz-connection",
      conditions: [{ questionId: "journey_type", equals: "FZ connecting" }],
      outcome: "Requires supervisor",
      explanation:
        "For connecting flights, the agent advises dimensions and conditions and escalates to a Supervisor, who adds the SSR (BIKE/SPEQ) per sector.",
      nextAction: "Escalate to a Supervisor to add the SSR per leg, then update Sprint comments.",
      sourcePages: [128],
      sourceField: "Connecting-flight Supervisor handling",
    },
    {
      id: "interline-confirm",
      conditions: [{ questionId: "journey_type", equals: "Interline or codeshare" }],
      outcome: "Can proceed with conditions",
      explanation:
        "Passengers with onward connections on other airlines must confirm acceptance of the sporting equipment directly with the respective airline(s) and provide confirmation to flydubai where required.",
      nextAction: "Advise the passenger to obtain the onward carrier's acceptance confirmation before travel; add the applicable SSR for the FZ sector.",
      sourcePages: [126],
      sourceField: "Onward-carrier confirmation",
    },
    {
      id: "bike-24h-plus",
      conditions: [
        { questionId: "equipment_kind", equals: "Bicycle" },
        { questionId: "hours_before_departure", min: 24 },
      ],
      outcome: "Can proceed",
      explanation:
        "Bicycles are accepted within the checked baggage allowance with SSR BIKE (no additional sporting equipment charge). Excess weight beyond the allowance follows the standard excess baggage policy.",
      nextAction:
        "Add SSR BIKE per passenger per flight, advise maximum dimensions (300 cm total, W≤115, H≤80), packing requirements and 2-hour check-in reporting, then update Sprint comments.",
      sourcePages: [126, 128],
      sourceField: "BIKE SSR within baggage allowance",
    },
    {
      id: "standard-24h-plus",
      conditions: [
        { questionId: "equipment_kind", equals: "Standard sporting equipment" },
        { questionId: "hours_before_departure", min: 24 },
      ],
      outcome: "Can proceed",
      explanation:
        "Sporting equipment is accepted as part of the checked baggage allowance with SSR SPEQ — no additional sporting equipment charges apply. Weight beyond the allowance follows the standard excess baggage policy.",
      nextAction:
        "Add SSR SPEQ per passenger per flight, advise maximum dimensions (300 cm total, W≤115, H≤80), packing requirements and 2-hour check-in reporting, then update Sprint comments.",
      sourcePages: [126, 128],
      sourceField: "SPEQ within baggage allowance",
    },
  ],
  notes: [
    "SSR SPEX is no longer used effective 01-Aug-2026; all requests use SPEQ or BIKE.",
    "Items such as snooker cues and rackets may be treated as part of the normal baggage allowance.",
    "No dangerous goods may be packed inside sporting equipment except those permitted under IATA DGR Table 2.3.A.",
    "Local airport size restrictions may apply; the passenger verifies with the relevant airport authorities.",
    "The 32 kg per-item limit applies uniformly to all checked baggage.",
  ],
};
