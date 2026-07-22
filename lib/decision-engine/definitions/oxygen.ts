// Oxygen Carry decision tree (Phase J-D Batch 4).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 30 "Oxygen Carry", pages 135-138.
//
// Additional oxygen is not provided on board. Only portable, battery-powered
// oxygen concentrators are accepted. This tree never confirms fitness to fly or
// medical suitability; it routes the documented handling and requires the
// medical/fit-to-fly certificate. Conservative outcomes.

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const OXYGEN_DEFINITION: DecisionDefinition = {
  procedureSlug: "oxygen",
  procedureTitle: "Oxygen Carry",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "30. Oxygen Carry",
  sourcePages: [135, 136, 137, 138],
  questions: QUESTION_SETS["oxygen"],
  rules: [
    {
      id: "ox-not-portable",
      conditions: [{ questionId: "device_type", equals: "Non-portable or non-battery cylinder" }],
      outcome: "Not permitted",
      explanation:
        "Only portable, battery-powered oxygen devices are accepted on flydubai; additional oxygen is not provided on board.",
      nextAction: "Do not add the oxygen SSR. A non-portable or non-battery cylinder cannot be carried for onboard use.",
      sourcePages: [135],
      sourceField: "Portable battery-powered device requirement",
    },
    {
      id: "ox-faa-newly",
      conditions: [{ questionId: "device_type", equals: "Battery POC newly FAA-approved (not on flydubai list)" }],
      outcome: "Requires supervisor",
      explanation:
        "A device not on the flydubai approved list but newly FAA-approved needs approval via Let's Talk at least 72 hours before departure.",
      nextAction:
        "Refer the passenger to letstalk@flydubai.com with model specifications and pictures for approval. Do not confirm or promise acceptance.",
      sourcePages: [135, 137],
      sourceField: "FAA-newly-approved device approval route",
    },
    {
      id: "ox-approved-no-cert",
      conditions: [
        { questionId: "device_type", equals: "Approved portable oxygen concentrator (battery-powered)" },
        { questionId: "has_medical_cert", equals: false },
      ],
      outcome: "Requires document",
      explanation:
        "An original medical (fit-to-fly) certificate with the documented statements must be presented at check-in for a passenger travelling with their own oxygen concentrator.",
      nextAction:
        "Advise the passenger to carry the original medical certificate stating the required oxygen-flow and self-management conditions, to be presented at check-in.",
      sourcePages: [135],
      sourceField: "Medical (fit-to-fly) certificate requirement",
    },
    {
      id: "ox-approved-oal",
      conditions: [
        { questionId: "device_type", equals: "Approved portable oxygen concentrator (battery-powered)" },
        { questionId: "first_carrier", equals: "Other airline (OAL) – interline/codeshare" },
        { questionId: "has_medical_cert", equals: true },
      ],
      outcome: "Requires supervisor",
      explanation:
        "When the first operating carrier is another airline, written approval from that carrier is required before the SSR can be added.",
      nextAction:
        "Advise the passenger to obtain written approval from the operating carrier and forward it to letstalk@flydubai.com; escalate the case to a Supervisor for follow-up.",
      sourcePages: [138],
      sourceField: "OAL first-carrier written-approval requirement",
    },
    {
      id: "ox-approved-fz",
      conditions: [
        { questionId: "device_type", equals: "Approved portable oxygen concentrator (battery-powered)" },
        { questionId: "first_carrier", equals: "flydubai (FZ)" },
        { questionId: "has_medical_cert", equals: true },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "An approved battery-powered concentrator on a flydubai-first journey with the required medical certificate may be handled under the documented process.",
      nextAction:
        "Add SSR PPOC (free of cost), assign a window seat (seat charge per fare type), and comment the PNR with the device type. The device must be battery-powered with sufficient/ spare batteries.",
      sourcePages: [135, 137],
      sourceField: "Approved-device handling (SSR PPOC, window seat)",
    },
  ],
  notes: [
    "Only portable, battery-powered oxygen concentrators are accepted; additional oxygen is not provided on board.",
    "An original medical/fit-to-fly certificate with the documented statements must be presented at check-in.",
    "Devices not on the flydubai list but newly FAA-approved, and OAL-first journeys, require Let's Talk / carrier approval; no confirmation is promised.",
  ],
};
