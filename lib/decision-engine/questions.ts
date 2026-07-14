// Clarifying questions per procedure (Phase B).
// These gather non-sensitive operational context only; they assert no
// policy. Outcomes are produced by Phase C decision trees, which must
// be grounded in verified card content.

import type { DecisionQuestion } from "./types.ts";

export const QUESTION_SETS: Record<string, DecisionQuestion[]> = {
  pregnancy: [
    {
      id: "pregnancy_type",
      label: "Single or multiple pregnancy?",
      answerType: "single_choice",
      options: ["Single", "Multiple"],
      required: true,
      reason: "Verified pregnancy rules differ by pregnancy type.",
    },
    {
      id: "pregnancy_week",
      label: "Pregnancy week on the travel date?",
      answerType: "number",
      min: 1,
      max: 45,
      required: true,
      reason: "Eligibility windows are defined by week of pregnancy.",
    },
    {
      id: "certificate_available",
      label: "Is a medical certificate available?",
      answerType: "yes_no",
      required: false,
      reason: "Some weeks require a medical certificate.",
    },
  ],
  wheelchair: [
    {
      id: "assistance_level",
      label: "Which assistance level is required?",
      answerType: "single_choice",
      options: ["WCHR (ramp)", "WCHS (steps)", "WCHC (cabin seat)"],
      required: true,
      reason: "The SSR and handling requirements differ by level.",
    },
    {
      id: "battery_powered",
      label: "Is the wheelchair battery-powered?",
      answerType: "yes_no",
      required: true,
      reason: "Battery wheelchairs carry extra requirements.",
    },
    {
      id: "hours_before_departure",
      label: "How many hours remain before departure?",
      answerType: "number",
      min: 0,
      max: 1000,
      required: true,
      reason: "Notification windows depend on remaining time.",
    },
  ],
  "name-correction": [
    {
      id: "checked_in",
      label: "Is the passenger already checked in?",
      answerType: "yes_no",
      required: true,
      reason: "Check-in status changes who can action the correction.",
    },
    {
      id: "no_show",
      label: "Is the booking in no-show status?",
      answerType: "yes_no",
      required: true,
      reason: "No-show bookings follow a different path.",
    },
    {
      id: "correction_kind",
      label: "What kind of change is needed?",
      answerType: "single_choice",
      options: ["Character correction", "Title or spacing only", "Name swap", "Full name change"],
      required: true,
      reason: "Fees and permissions differ by correction type.",
    },
    {
      id: "booking_channel",
      label: "What is the booking channel?",
      answerType: "single_choice",
      options: ["Direct (FZ)", "GDS", "Interline", "Codeshare"],
      required: true,
      reason: "Channel restrictions apply to name changes.",
    },
  ],
};
