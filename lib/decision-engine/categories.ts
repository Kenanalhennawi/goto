// Workflow category grouping for the Decision Assistant directory (Phase J).
// Pure data + helpers over the code-defined registry — no behaviour change to
// the decision engine itself.

import { DECISION_DEFINITIONS } from "./definitions/index.ts";

export type WorkflowCategory =
  | "Booking"
  | "Airport"
  | "Medical"
  | "Travel Requirements"
  | "Disruption"
  | "Ancillaries"
  | "Special Services";

export const WORKFLOW_CATEGORY_ORDER: WorkflowCategory[] = [
  "Booking",
  "Airport",
  "Travel Requirements",
  "Disruption",
  "Ancillaries",
  "Medical",
  "Special Services",
];

// Slug -> category. New workflows add an entry here; unmapped slugs fall back to
// "Special Services" so nothing is ever hidden from the directory.
export const WORKFLOW_CATEGORIES: Record<string, WorkflowCategory> = {
  "name-correction": "Booking",
  "duplicate-booking": "Booking",
  "government-deals": "Booking",
  "auto-split-od": "Booking",
  "travel-requirements": "Travel Requirements",
  "ok-to-board": "Travel Requirements",
  "visa-change": "Travel Requirements",
  "check-in-olci": "Airport",
  "minimum-connection-time": "Airport",
  "flight-disruption": "Disruption",
  "sporting-equipment": "Ancillaries",
  "extra-seat-cbbg": "Ancillaries",
  pregnancy: "Medical",
  wheelchair: "Special Services",
  "falcon-handling": "Special Services",
};

export function categoryForWorkflow(slug: string): WorkflowCategory {
  return WORKFLOW_CATEGORIES[slug] ?? "Special Services";
}

export type WorkflowSummary = {
  slug: string;
  title: string;
  category: WorkflowCategory;
  questionCount: number;
  sourceVersion: string;
  sourceChapter: string;
  sourcePages: number[];
  /** Rough estimate: ~8 seconds per question. */
  estimatedSeconds: number;
};

/** All registered workflows as directory summaries (deterministic, no I/O). */
export function listWorkflowSummaries(): WorkflowSummary[] {
  return Object.values(DECISION_DEFINITIONS)
    .map((definition) => ({
      slug: definition.procedureSlug,
      title: definition.procedureTitle,
      category: categoryForWorkflow(definition.procedureSlug),
      questionCount: definition.questions.length,
      sourceVersion: definition.sourceVersion,
      sourceChapter: definition.sourceChapter,
      sourcePages: definition.sourcePages,
      estimatedSeconds: definition.questions.length * 8,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** Case-insensitive filter over title / slug / category / source chapter. */
export function filterWorkflows(list: WorkflowSummary[], query: string): WorkflowSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((w) =>
    `${w.title} ${w.slug} ${w.category} ${w.sourceChapter}`.toLowerCase().includes(q)
  );
}

export function estimatedMinutesLabel(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`;
  const mins = Math.round(seconds / 60);
  return `~${mins} min`;
}
