// Wheelchair decision tree (Phase H).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 34 "Wheelchair", pages 165-170. Verified rules:
//   - Request at least 24h prior; within the last 24h the SSR can still be
//     added: WCHR up to 12h, WCHS/WCHC up to 24h prior (p.165).
//   - WCHC must travel with a companion in the same cabin on an adjoining seat
//     and carry a fit-to-fly medical certificate (pp.165-166).
//   - Battery-powered wheelchair: notify 48h ahead + mobility-aid form (p.167);
//     SSR WCBD/WCLB/WCBW; dimensions <= 89x122 cm, weight <= 100 kg; NO battery
//     accepted if damaged or leaking (pp.167-168); lithium <= 300 Wh / 2x160 Wh
//     (pp.168-169); interline needs onward-carrier acceptance proof (pp.168,170).

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const WHEELCHAIR_DEFINITION: DecisionDefinition = {
  procedureSlug: "wheelchair",
  procedureTitle: "Wheelchair",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "34. Wheelchair",
  sourcePages: [165, 166, 167, 168, 169, 170],
  questions: QUESTION_SETS["wheelchair"],
  rules: [
    {
      id: "wchr-battery-damaged",
      conditions: [
        { questionId: "battery_powered", equals: true },
        { questionId: "battery_damaged", equals: true },
      ],
      outcome: "Not permitted",
      explanation:
        "No battery can be accepted when there are any signs of damage or leaking. The battery-powered wheelchair cannot be carried as presented.",
      sourcePages: [167, 168],
      sourceField: "not_allowed",
    },
    {
      id: "wchr-battery-late",
      conditions: [
        { questionId: "battery_powered", equals: true },
        { questionId: "hours_before_departure", max: 47 },
      ],
      outcome: "Not permitted",
      explanation:
        "Battery-powered wheelchairs must be notified at least 48 hours before departure; there is insufficient notice for this flight.",
      nextAction: "Advise the passenger to request assistance at the airport; the mobility aid may not be accepted without the 48-hour notification.",
      sourcePages: [167],
      sourceField: "cut_off_time",
    },
    {
      id: "wchc-no-companion",
      conditions: [
        { questionId: "assistance_type", equals: "WCHC" },
        { questionId: "companion_available", equals: false },
      ],
      outcome: "Not permitted",
      explanation:
        "A WCHC passenger must travel with a companion/helper in the same cabin on an adjoining seat; without one the request cannot proceed.",
      sourcePages: [165, 166],
      sourceField: "not_allowed",
    },
    {
      id: "wchc-no-certificate",
      conditions: [
        { questionId: "assistance_type", equals: "WCHC" },
        { questionId: "companion_available", equals: true },
        { questionId: "medical_certificate_available", equals: false },
      ],
      outcome: "Requires document",
      explanation:
        "A WCHC passenger must carry a fit-to-fly medical certificate in English (or a language the ground staff/crew can read) signed by a licensed medical practitioner.",
      nextAction: "Advise the passenger to obtain the fit-to-fly certificate before travel.",
      sourcePages: [165, 166],
      sourceField: "required_information",
    },
    {
      id: "wchr-battery-ok",
      conditions: [
        { questionId: "battery_powered", equals: true },
        { questionId: "hours_before_departure", min: 48 },
        { questionId: "battery_damaged", equals: false },
      ],
      outcome: "Requires document",
      explanation:
        "Battery-powered wheelchair accepted with conditions: notify 48h ahead and submit the Wheelchair and Mobility Aid form.",
      nextAction:
        "Collect the mobility-aid form and battery details (type WCBD/WCLB/WCBW, watt-hours, count). Lithium (WCLB) travels in the cabin, max 300 Wh or 2x160 Wh; wet/dry cells go in the hold. Dimensions must not exceed 89x122 cm and weight 100 kg. For an interline/OAL onward leg, obtain proof the other carrier accepts the battery wheelchair. Passenger reports 3 hours before departure.",
      sourcePages: [167, 168, 170],
      sourceField: "required_information",
    },
    {
      id: "wchr-late",
      conditions: [
        { questionId: "assistance_type", equals: "WCHR" },
        { questionId: "hours_before_departure", max: 11 },
      ],
      outcome: "Requires supervisor",
      explanation:
        "WCHR can be added through the system up to 12 hours before departure; inside that window the SSR cannot be added normally.",
      nextAction: "Refer to SUP/FS in charge and advise the passenger that airport staff can arrange assistance.",
      sourcePages: [165],
      sourceField: "escalation_points",
    },
    {
      id: "wchs-late",
      conditions: [
        { questionId: "assistance_type", equals: "WCHS" },
        { questionId: "hours_before_departure", max: 23 },
      ],
      outcome: "Requires supervisor",
      explanation:
        "WCHS requires 24 hours' notice to add the SSR; inside that window the SSR cannot be added normally.",
      nextAction: "Refer to SUP/FS in charge and advise the passenger that airport staff can arrange assistance.",
      sourcePages: [165],
      sourceField: "escalation_points",
    },
    {
      id: "wchc-late",
      conditions: [
        { questionId: "assistance_type", equals: "WCHC" },
        { questionId: "hours_before_departure", max: 23 },
      ],
      outcome: "Requires supervisor",
      explanation:
        "WCHC requires 24 hours' notice to add the SSR; inside that window the SSR cannot be added normally.",
      nextAction: "Refer to SUP/FS in charge and advise the passenger that airport staff can arrange assistance.",
      sourcePages: [165],
      sourceField: "escalation_points",
    },
    {
      id: "wchr-ok",
      conditions: [
        { questionId: "assistance_type", equals: "WCHR" },
        { questionId: "hours_before_departure", min: 12 },
        { questionId: "battery_powered", equals: false },
      ],
      outcome: "Can proceed",
      explanation:
        "WCHR (ramp assistance): passenger walks the stairs and moves around the cabin unassisted. Add the SSR and assign a seat.",
      nextAction:
        "Offer a complimentary seat in rows 29-31 (one companion only), avoiding emergency-exit rows; advise the passenger to arrive 3 hours before departure. Escalate seat assignment to SUP/FS.",
      sourcePages: [165, 166],
      sourceField: "system_steps",
    },
    {
      id: "wchs-ok",
      conditions: [
        { questionId: "assistance_type", equals: "WCHS" },
        { questionId: "hours_before_departure", min: 24 },
        { questionId: "battery_powered", equals: false },
      ],
      outcome: "Can proceed",
      explanation:
        "WCHS (steps assistance): passenger cannot manage stairs but moves around the cabin and self-cares unassisted. Add the SSR and assign a seat.",
      nextAction:
        "Offer a complimentary seat in rows 29-31 (one companion only), avoiding emergency-exit rows; advise the passenger to arrive 3 hours before departure. Escalate seat assignment to SUP/FS.",
      sourcePages: [165, 166],
      sourceField: "system_steps",
    },
    {
      id: "wchc-ok",
      conditions: [
        { questionId: "assistance_type", equals: "WCHC" },
        { questionId: "hours_before_departure", min: 24 },
        { questionId: "companion_available", equals: true },
        { questionId: "medical_certificate_available", equals: true },
        { questionId: "battery_powered", equals: false },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "WCHC (cabin-seat assistance) accepted: companion in the same cabin on an adjoining seat and a fit-to-fly medical certificate are present.",
      nextAction:
        "Assign adjoining seats for the passenger and companion in rows 29-31 (aisle for the WCHC passenger), avoiding emergency-exit rows; advise arrival 3 hours before departure. Escalate seat assignment to SUP/FS.",
      sourcePages: [165, 166],
      sourceField: "system_steps",
    },
  ],
  notes: [
    "Wheelchair assistance can be requested through all FZ contact points; booking at least 48 hours prior is recommended as airport availability is not guaranteed.",
    "Passengers with reduced mobility cannot be seated in an emergency-exit row and must use an upright seat for taxi, take-off and landing.",
    "Hoverboards and similar lithium-powered rideable items are banned from FZ aircraft.",
    "Damaged, defective or recalled batteries are not accepted; lithium spares over 300 Wh are forbidden.",
    "May also need: airport special-assistance reference for battery wheelchairs on interline/OAL connections.",
  ],
};
