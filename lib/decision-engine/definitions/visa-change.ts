// Visa Change decision tree (Phase J-D Batch 2).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 48 "Visa" - section 48.1 "Visa Change", page 271. Verified:
//   - General/transit visa enquiries: agents must NOT provide visa details over
//     the call; direct the passenger to visa.dxb@flydubai.com or a flydubai
//     Travel Shop (transit: Deira only) (p.271).
//   - Visa-change travel: bookings must be created through one of the listed
//     authorized travel agents; only those bookings are accepted at the airport.
//   - Applicable only to MCT, KWI and BAH.
//   - The passenger must hold a valid UAE visa in hand before departure for
//     re-entry; both outbound and inbound flights must be under the same PNR;
//     the passenger is through-checked from DXB with a printed boarding pass for
//     API clearance. If the passenger is a NOSHOW on the outbound flight, refer
//     to the supervisor in charge (p.271).
// This tree never confirms visa validity or admissibility; it routes handling.

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const VISA_CHANGE_DEFINITION: DecisionDefinition = {
  procedureSlug: "visa-change",
  procedureTitle: "Visa Change",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "48.1 Visa Change",
  sourcePages: [271],
  questions: QUESTION_SETS["visa-change"],
  rules: [
    {
      id: "vc-general-enquiry",
      conditions: [{ questionId: "request_type", equals: "General or transit visa enquiry" }],
      outcome: "Not permitted",
      explanation:
        "Agents must not provide visa-related details over the call.",
      nextAction:
        "Direct the passenger to visa.dxb@flydubai.com or a flydubai Travel Shop (transit visa: Deira only). Do not advise on visa details or admissibility.",
      sourcePages: [271],
      sourceField: "Visa enquiry handling restriction",
    },
    {
      id: "vc-outbound-noshow",
      conditions: [
        { questionId: "request_type", equals: "Visa-change travel (re-entry to UAE)" },
        { questionId: "outbound_noshow", equals: true },
      ],
      outcome: "Requires supervisor",
      explanation:
        "If the passenger is a NOSHOW on the outbound flight, the case must be referred to the supervisor in charge.",
      nextAction: "Refer to the supervisor in charge for advice and assistance.",
      sourcePages: [271],
      sourceField: "Visa-change outbound NOSHOW handling",
    },
    {
      id: "vc-route-unsupported",
      conditions: [
        { questionId: "request_type", equals: "Visa-change travel (re-entry to UAE)" },
        { questionId: "route", equals: "Other route" },
      ],
      outcome: "Not permitted",
      explanation: "Visa-change flights are applicable only to MCT, KWI and BAH.",
      nextAction: "Advise the passenger that visa-change travel is not offered on this route.",
      sourcePages: [271],
      sourceField: "Visa-change eligible routes (MCT, KWI, BAH)",
    },
    {
      id: "vc-no-valid-visa",
      conditions: [
        { questionId: "request_type", equals: "Visa-change travel (re-entry to UAE)" },
        { questionId: "valid_uae_visa_in_hand", equals: false },
      ],
      outcome: "Requires document",
      explanation:
        "The passenger must hold a valid UAE visa in hand before departure to be able to re-enter the UAE.",
      nextAction:
        "Advise the passenger that a valid UAE visa must be in hand before departure. Do not confirm visa validity; the passenger must arrange this with the relevant authority.",
      sourcePages: [271],
      sourceField: "Valid UAE visa required before departure",
    },
    {
      id: "vc-not-same-pnr",
      conditions: [
        { questionId: "request_type", equals: "Visa-change travel (re-entry to UAE)" },
        { questionId: "same_pnr_both_flights", equals: false },
      ],
      outcome: "Requires supervisor",
      explanation:
        "Both the outbound and inbound flights must be under the same PNR for visa-change handling.",
      nextAction:
        "Escalate to arrange both flights under a single PNR through an authorized travel agent before travel.",
      sourcePages: [271],
      sourceField: "Both flights under the same PNR",
    },
    // Eligible cases are enumerated per route so an unanswered or ineligible
    // route can never fall through to a "Can proceed" outcome.
    {
      id: "vc-eligible-mct",
      conditions: [
        { questionId: "request_type", equals: "Visa-change travel (re-entry to UAE)" },
        { questionId: "route", equals: "MCT" },
        { questionId: "valid_uae_visa_in_hand", equals: true },
        { questionId: "same_pnr_both_flights", equals: true },
        { questionId: "outbound_noshow", equals: false },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "Visa-change travel to MCT is supported when a valid UAE visa is held, both flights are on the same PNR and the outbound is not a NOSHOW.",
      nextAction:
        "The booking must be created through one of the authorized travel agents on the approved list (only those bookings are accepted at the airport). The passenger is through-checked from DXB with a printed boarding pass for API clearance.",
      sourcePages: [271],
      sourceField: "Visa-change authorized-agent booking and API clearance",
    },
    {
      id: "vc-eligible-kwi",
      conditions: [
        { questionId: "request_type", equals: "Visa-change travel (re-entry to UAE)" },
        { questionId: "route", equals: "KWI" },
        { questionId: "valid_uae_visa_in_hand", equals: true },
        { questionId: "same_pnr_both_flights", equals: true },
        { questionId: "outbound_noshow", equals: false },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "Visa-change travel to KWI is supported when a valid UAE visa is held, both flights are on the same PNR and the outbound is not a NOSHOW.",
      nextAction:
        "The booking must be created through one of the authorized travel agents on the approved list (only those bookings are accepted at the airport). The passenger is through-checked from DXB with a printed boarding pass for API clearance.",
      sourcePages: [271],
      sourceField: "Visa-change authorized-agent booking and API clearance",
    },
    {
      id: "vc-eligible-bah",
      conditions: [
        { questionId: "request_type", equals: "Visa-change travel (re-entry to UAE)" },
        { questionId: "route", equals: "BAH" },
        { questionId: "valid_uae_visa_in_hand", equals: true },
        { questionId: "same_pnr_both_flights", equals: true },
        { questionId: "outbound_noshow", equals: false },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "Visa-change travel to BAH is supported when a valid UAE visa is held, both flights are on the same PNR and the outbound is not a NOSHOW.",
      nextAction:
        "The booking must be created through one of the authorized travel agents on the approved list (only those bookings are accepted at the airport). The passenger is through-checked from DXB with a printed boarding pass for API clearance.",
      sourcePages: [271],
      sourceField: "Visa-change authorized-agent booking and API clearance",
    },
  ],
  notes: [
    "Agents must not provide visa-related details over the call; general and transit visa enquiries go to visa.dxb@flydubai.com or a flydubai Travel Shop.",
    "Only bookings created through the listed authorized travel agents are accepted at the airport for visa-change travel.",
    "Visa-change travel is applicable to MCT, KWI and BAH; both flights must be on the same PNR and the passenger must hold a valid UAE visa in hand before departure.",
  ],
};
