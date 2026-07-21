// Check-in / OLCI decision tree (Phase D).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 55 "Ways to Check-in", pages 282-285. Rules verified verbatim:
//   - OLCI window: 48 hours up to 75 minutes prior to departure (p.283 §1).
//   - Non-eligible for OLCI: card verification at airport desk; special
//     request for cabin baggage; extra seat requests (p.283 §5).
//   - Airport reporting: at least 60 minutes prior; boarding gates close
//     25 minutes before departure (p.282).
//   - Post-OLCI modify/cancel: honor the request and escalate to Supervisor
//     to offload; offload applicable up to 60 minutes before departure;
//     offload requests to add SSRs are not honored; Contact Centre must
//     reject offload for passengers checked in at the airport (p.285).
//   - OLCI issues: refer to check-in counter at least 3 hours prior (p.285).
// Distinct timings kept separate: 60-min airport reporting, 25-min gate
// closure, 75-min OLCI close, 60-min offload deadline.

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const CHECK_IN_OLCI_DEFINITION: DecisionDefinition = {
  procedureSlug: "check-in-olci",
  procedureTitle: "Check-in / OLCI",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "55. Ways to Check-in",
  sourcePages: [282, 283, 284, 285],
  questions: QUESTION_SETS["check-in-olci"],
  rules: [
    {
      id: "olci-card-verification-block",
      conditions: [
        { questionId: "olci_goal", equals: "Complete online check-in" },
        { questionId: "card_verification", equals: true },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "Not eligible for online check-in: the booking requires debit/credit card verification at the airport check-in desk. Airport check-in only.",
      nextAction:
        "Advise airport check-in; passenger must be at the airport at least 60 minutes prior to departure and gates close 25 minutes before departure.",
      sourcePages: [282, 283],
      sourceField: "not_allowed",
    },
    {
      id: "olci-exst-cbbg-block",
      conditions: [
        { questionId: "olci_goal", equals: "Complete online check-in" },
        { questionId: "has_exst_cbbg", equals: true },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "Not eligible for online check-in: bookings with a special request for cabin baggage or an extra seat are excluded from OLCI. Airport check-in only.",
      nextAction:
        "Advise airport check-in; passenger must be at the airport at least 60 minutes prior to departure and gates close 25 minutes before departure.",
      sourcePages: [282, 283],
      sourceField: "not_allowed",
    },
    {
      id: "olci-not-open-yet",
      conditions: [
        { questionId: "olci_goal", equals: "Complete online check-in" },
        { questionId: "minutes_to_departure", min: 2881 },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "Online check-in is not open yet: it opens 48 hours (2880 minutes) before departure.",
      nextAction: "Advise the passenger to check in online once the 48-hour window opens.",
      sourcePages: [283],
      sourceField: "cut_off_time",
    },
    {
      id: "olci-eligible-window",
      conditions: [
        { questionId: "olci_goal", equals: "Complete online check-in" },
        { questionId: "minutes_to_departure", min: 75, max: 2880 },
      ],
      outcome: "Can proceed",
      explanation:
        "Eligible for online check-in: OLCI is open from 48 hours up to 75 minutes prior to departure, using the booking reference and departure airport or the primary passenger's last name.",
      sourcePages: [283],
      sourceField: "cut_off_time / system_steps",
    },
    {
      id: "olci-closed-under-75min",
      conditions: [
        { questionId: "olci_goal", equals: "Complete online check-in" },
        { questionId: "minutes_to_departure", max: 74 },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "Online check-in is closed (it closes 75 minutes before departure). Airport check-in only.",
      nextAction:
        "Advise the passenger to go directly to the airport check-in counter: reporting is at least 60 minutes prior to departure and boarding gates close 25 minutes before departure.",
      sourcePages: [282, 283],
      sourceField: "cut_off_time / passenger_advice",
    },
    {
      id: "offload-airport-checked-in",
      conditions: [
        { questionId: "olci_goal", equals: "Modify or cancel after online check-in" },
        { questionId: "checkin_state", equals: "Checked in at the airport" },
      ],
      outcome: "Not permitted",
      explanation:
        "Contact Centre must reject offload requests for passengers who performed check-in at the airport.",
      nextAction: "Refer the passenger to the airport team.",
      sourcePages: [285],
      sourceField: "not_allowed",
    },
    {
      id: "offload-before-deadline",
      conditions: [
        { questionId: "olci_goal", equals: "Modify or cancel after online check-in" },
        { questionId: "checkin_state", equals: "Checked in online" },
        { questionId: "minutes_to_departure", min: 60 },
      ],
      outcome: "Requires supervisor",
      explanation:
        "Honor the modify/cancel request and escalate the case to a Supervisor to offload the passenger. Offload requests are applicable up to 60 minutes before departure and apply to all booking types (including GDS, interline and codeshare).",
      nextAction:
        "Escalate to Supervisor for offload and inform the caller to perform online check-in again for the modified flight.",
      sourcePages: [285],
      sourceField: "system_steps / escalation_points",
    },
    {
      id: "offload-too-late",
      conditions: [
        { questionId: "olci_goal", equals: "Modify or cancel after online check-in" },
        { questionId: "checkin_state", equals: "Checked in online" },
        { questionId: "minutes_to_departure", max: 59 },
      ],
      outcome: "Not permitted",
      explanation:
        "Too late for offload: post-OLCI offload requests are applicable only up to 60 minutes before departure.",
      sourcePages: [285],
      sourceField: "cut_off_time",
    },
    {
      id: "modify-not-checked-in",
      conditions: [
        { questionId: "olci_goal", equals: "Modify or cancel after online check-in" },
        { questionId: "checkin_state", equals: "Not checked in" },
      ],
      outcome: "Can proceed",
      explanation:
        "The booking status is Active (no check-in completed), so modify or cancel as per fare rules — no offload is needed.",
      sourcePages: [285],
      sourceField: "system_steps",
    },
    {
      id: "ssr-after-checkin",
      conditions: [{ questionId: "olci_goal", equals: "Add an SSR after check-in" }],
      outcome: "Not permitted",
      explanation: "Offload requests to add SSRs will not be honored.",
      nextAction: "Advise that the SSR cannot be added through offload after check-in.",
      sourcePages: [285],
      sourceField: "not_allowed",
    },
    {
      id: "olci-error",
      conditions: [{ questionId: "olci_goal", equals: "Online check-in error or issue" }],
      outcome: "Can proceed with conditions",
      explanation:
        "In the event of issues completing online check-in, refer the customer to the check-in counter at least 3 hours prior to departure for normal airport check-in.",
      sourcePages: [285],
      sourceField: "passenger_advice",
    },
  ],
  notes: [
    "Keep the timings distinct: airport reporting at least 60 minutes prior; boarding gates close 25 minutes before departure; OLCI closes 75 minutes before departure; post-OLCI offload deadline is 60 minutes before departure.",
    "Umrah/Hajj flights (FZ 5XXX-7XXX) are excluded from online check-in.",
    "TA offload requests are directed to the relevant support channel (fzgds@/agencysupport@); Contact Centre handles them outside working hours on an exceptional basis only.",
    "May also need: Flight Disruption — only when an actual disruption exists on the flight.",
  ],
};
