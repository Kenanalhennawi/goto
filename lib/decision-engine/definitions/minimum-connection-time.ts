// Minimum Connection Time decision tree (Phase D).
// This is a reference/timing tree, not a service: it compares the actual
// connection duration against the published MCT table. It never claims the
// connection is guaranteed.
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 25 "Connection and Transfers" — "Minimum connection time (MCT)",
// page 102. The MCT_TABLE below is a 1:1 transcription of the published
// table, including the OA exception carriers (SQ, KE, PR). SQ/KE rows are
// published as "Terminal (Vice versa)" (bidirectional); the PR rows are
// directional exactly as published. Terminal pairings not in the table
// (e.g. anything T1-T1, or FZ-FZ involving T1) intentionally have no rule
// and fall through to "Insufficient information" for manual review.

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionAnswers } from "../types.ts";
import type { DecisionDefinition, DecisionRule } from "../evaluator.ts";

type MctEntry = {
  from: string;
  to: string;
  carriers: string;
  mct: number;
  /** Published as "Terminal (Vice versa)" — applies in both directions. */
  bidirectional: boolean;
};

// Verbatim from GO TO v81.2 p.102 ("Minimum Connecting Time" table).
const MCT_TABLE: MctEntry[] = [
  { from: "T2", to: "T2", carriers: "FZ-FZ", mct: 60, bidirectional: false },
  { from: "T2", to: "T2", carriers: "FZ-OA", mct: 120, bidirectional: false },
  { from: "T3", to: "T3", carriers: "FZ-FZ", mct: 90, bidirectional: false },
  { from: "T3", to: "T3", carriers: "FZ-OA", mct: 90, bidirectional: false },
  { from: "T2", to: "T3", carriers: "FZ-FZ", mct: 120, bidirectional: true },
  { from: "T2", to: "T3", carriers: "FZ-OA", mct: 120, bidirectional: true },
  { from: "T2", to: "T1", carriers: "FZ-OA", mct: 180, bidirectional: true },
  { from: "T3", to: "T1", carriers: "FZ-OA", mct: 180, bidirectional: true },
  // OA exceptions ("Terminal (Vice versa)"):
  { from: "T2", to: "T1", carriers: "FZ-SQ", mct: 120, bidirectional: true },
  { from: "T3", to: "T1", carriers: "FZ-SQ", mct: 150, bidirectional: true },
  { from: "T2", to: "T1", carriers: "FZ-KE", mct: 120, bidirectional: true },
  { from: "T3", to: "T1", carriers: "FZ-KE", mct: 120, bidirectional: true },
  // OA exceptions (directional, as published):
  { from: "T2", to: "T1", carriers: "FZ-PR", mct: 180, bidirectional: false },
  { from: "T1", to: "T2", carriers: "PR-FZ", mct: 150, bidirectional: false },
  { from: "T3", to: "T1", carriers: "FZ-PR", mct: 150, bidirectional: false },
  { from: "T1", to: "T3", carriers: "PR-FZ", mct: 150, bidirectional: false },
];

function findEntry(answers: DecisionAnswers): MctEntry | null {
  const from = answers["arrival_terminal"];
  const to = answers["departure_terminal"];
  const carriers = answers["carrier_pair"];
  return (
    MCT_TABLE.find(
      (entry) =>
        entry.carriers === carriers &&
        ((entry.from === from && entry.to === to) ||
          (entry.bidirectional && entry.from === to && entry.to === from))
    ) ?? null
  );
}

// One "meets" and one "does not meet" rule per published table row/direction.
// Generated from the verbatim MCT_TABLE so each rule stays auditable against
// page 102; no rule exists that is not in the published table.
function buildRules(): DecisionRule[] {
  const rules: DecisionRule[] = [];
  const seen = new Set<string>();
  for (const entry of MCT_TABLE) {
    const directions: Array<[string, string]> = [[entry.from, entry.to]];
    if (entry.bidirectional && entry.from !== entry.to) directions.push([entry.to, entry.from]);
    for (const [from, to] of directions) {
      const key = `${from}-${to}-${entry.carriers}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const base = [
        { questionId: "arrival_terminal", equals: from },
        { questionId: "departure_terminal", equals: to },
        { questionId: "carrier_pair", equals: entry.carriers },
      ];
      rules.push({
        id: `${key}-meets`,
        conditions: [...base, { questionId: "connection_minutes", min: entry.mct }],
        outcome: "Can proceed with conditions",
        explanation: `Connection meets the published minimum timing rule (${from} to ${to}, ${entry.carriers}: minimum ${entry.mct} minutes). Operational acceptance may still depend on ticketing, baggage, immigration, and carrier conditions.`,
        sourcePages: [102],
        sourceField: "cut_off_time (MCT table)",
      });
      rules.push({
        id: `${key}-below`,
        conditions: [...base, { questionId: "connection_minutes", max: entry.mct - 1 }],
        outcome: "Not permitted",
        explanation: `Connection does not meet the published minimum timing rule (${from} to ${to}, ${entry.carriers}: minimum ${entry.mct} minutes). Operational acceptance may still depend on ticketing, baggage, immigration, and carrier conditions.`,
        nextAction:
          "Manual/exception review required: refer to the supervisor in charge or the airport transfer desk before committing anything to the passenger.",
        sourcePages: [102],
        sourceField: "cut_off_time (MCT table)",
      });
    }
  }
  return rules;
}

export const MINIMUM_CONNECTION_TIME_DEFINITION: DecisionDefinition = {
  procedureSlug: "minimum-connection-time",
  procedureTitle: "Minimum Connection Time",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "25. Connection and Transfers — Minimum connection time (MCT)",
  sourcePages: [100, 101, 102],
  questions: QUESTION_SETS["minimum-connection-time"],
  rules: buildRules(),
  derive: (answers) => {
    const entry = findEntry(answers);
    const actual = answers["connection_minutes"];
    if (!entry || typeof actual !== "number") return null;
    const diff = actual - entry.mct;
    return `Terminal pairing ${String(answers["arrival_terminal"])} to ${String(
      answers["departure_terminal"]
    )} · carriers ${entry.carriers} · minimum required ${entry.mct} min · actual ${actual} min · difference ${
      diff >= 0 ? "+" : ""
    }${diff} min.`;
  },
  notes: [
    "MCT is a published timing reference, not a service deadline, and meeting it does not guarantee the connection.",
    "Baggage: passengers connecting FZ-FZ in Dubai transfer without collecting baggage and without a UAE visa using flydubai connect services; without a UAE visa the passenger cannot leave the airport (pp.100-101).",
    "The baggage transfer service is not available for arrivals on British Airways, Flydeal, Pegasus Airlines, Pobeda Airlines, or Wizz Air — those passengers must clear immigration and re-check in at DXB/DWC (p.101).",
    "A Transfer Baggage Fee (SSR-TRBF) may apply for passengers holding two separate tickets or with baggage not tagged through; connections over 24 hours are excluded from the baggage transfer condition (p.101).",
    "Terminal/carrier pairings not present in the published table require manual/exception review.",
  ],
};
