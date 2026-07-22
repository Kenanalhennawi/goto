// Meet & Assist (MASD) decision tree (Phase J-D Batch 3).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// "Meet and Assist Service (MASD) - DXB T2 Departures", page 304. Verified:
//   - MASD is available for eligible commercial Business Class passengers
//     departing DXB Terminal 2. The MASD SSR is auto-added for eligible
//     passengers/flights (p.304).
//   - Exclusions: staff/discounted/rebate bookings; passengers upgraded via bid,
//     online check-in, or airport UPGJ; bookings with SSR LNGN (No Lounge
//     Access); transit passengers at DXB T2; departures from DXB T3 or any
//     outstation (p.304).

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const MEET_ASSIST_DEFINITION: DecisionDefinition = {
  procedureSlug: "meet-assist",
  procedureTitle: "Meet & Assist",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "Meet and Assist Service (MASD) – DXB T2 Departures",
  sourcePages: [304],
  questions: QUESTION_SETS["meet-assist"],
  rules: [
    {
      id: "ma-economy",
      conditions: [{ questionId: "booking_type", equals: "Economy" }],
      outcome: "Not permitted",
      explanation: "Meet & Assist under this procedure is not available for Economy Class passengers.",
      nextAction: "Do not offer MASD under this workflow.",
      sourcePages: [304],
      sourceField: "MASD eligibility exclusions",
    },
    {
      id: "ma-staff-discount",
      conditions: [{ questionId: "booking_type", equals: "Staff, discounted or rebate" }],
      outcome: "Not permitted",
      explanation: "Staff, discounted, or rebate bookings are not eligible under this MASD procedure.",
      nextAction: "Do not offer MASD.",
      sourcePages: [304],
      sourceField: "MASD fare/booking exclusions",
    },
    {
      id: "ma-upgraded",
      conditions: [{ questionId: "booking_type", equals: "Upgraded (bid, OLCI or airport UPGJ)" }],
      outcome: "Not permitted",
      explanation:
        "Passengers upgraded through bid, online check-in, or airport UPGJ are not eligible under this MASD procedure.",
      nextAction: "Do not offer MASD.",
      sourcePages: [304],
      sourceField: "MASD upgrade exclusions",
    },
    {
      id: "ma-terminal-3",
      conditions: [{ questionId: "departure", equals: "DXB Terminal 3" }],
      outcome: "Not permitted",
      explanation: "This MASD service applies only to DXB Terminal 2 departures.",
      nextAction: "Do not apply this workflow to Terminal 3.",
      sourcePages: [304],
      sourceField: "MASD station/terminal eligibility",
    },
    {
      id: "ma-outstation",
      conditions: [{ questionId: "departure", equals: "Outstation" }],
      outcome: "Not permitted",
      explanation: "This MASD workflow applies only to DXB Terminal 2 departures.",
      nextAction: "Do not apply this workflow to an outstation departure.",
      sourcePages: [304],
      sourceField: "MASD station eligibility",
    },
    {
      id: "ma-transit",
      conditions: [{ questionId: "transit_dxb_t2", equals: true }],
      outcome: "Not permitted",
      explanation: "Transit passengers through DXB T2 are not eligible under this departure MASD procedure.",
      nextAction: "Do not offer the departure MASD service.",
      sourcePages: [304],
      sourceField: "MASD transit exclusion",
    },
    {
      id: "ma-no-lounge-ssr",
      conditions: [{ questionId: "no_lounge_ssr", equals: true }],
      outcome: "Not permitted",
      explanation: "A booking carrying SSR LNGN – No Lounge Access is not eligible under this MASD procedure.",
      nextAction: "Do not offer MASD.",
      sourcePages: [304],
      sourceField: "MASD SSR exclusion",
    },
    {
      id: "ma-eligible",
      conditions: [
        { questionId: "booking_type", equals: "Commercial Business Class" },
        { questionId: "departure", equals: "DXB Terminal 2" },
        { questionId: "transit_dxb_t2", equals: false },
        { questionId: "no_lounge_ssr", equals: false },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "An eligible commercial Business Class passenger departing DXB Terminal 2 may use the MASD process.",
      nextAction:
        "Confirm the MASD SSR is present/auto-added. The passenger may opt in during OLCI and select an arrival time, with the default at D-3 hours, or use the Business Class check-in area at T2 Entrance 3.",
      sourcePages: [304],
      sourceField: "MASD eligible process",
    },
  ],
  notes: [
    "MASD is available for eligible commercial Business Class passengers departing DXB Terminal 2; the MASD SSR is auto-added for eligible passengers and flights.",
    "Exclusions: staff/discounted/rebate bookings, bid/OLCI/airport UPGJ upgrades, SSR LNGN (No Lounge Access), transit at DXB T2, and departures from DXB T3 or any outstation.",
  ],
};
