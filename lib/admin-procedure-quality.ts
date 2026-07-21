import type { JsonValue } from "@/lib/types";

export type AdminQualityBaseProcedure = {
  service_code: string | null;
  service_type: string | null;
  category: string;
  summary: string | null;
  when_to_use: string | null;
  cut_off_time: string | null;
  required_information: JsonValue[] | null | undefined;
  system_steps: JsonValue[] | null | undefined;
  passenger_advice: JsonValue[] | null | undefined;
  allowed: JsonValue[] | null | undefined;
  not_allowed: JsonValue[] | null | undefined;
  escalation_points: JsonValue[] | null | undefined;
  fees_charges: string | null;
  source_confidence: string | null;
  review_status?: string;
  is_published?: boolean;
  source_version?: string | null;
  last_reviewed_at?: string | null;
  chapters?: SourceReviewChapter | SourceReviewChapter[] | null;
};

export type SourceReviewChapter = {
  source_version?: string | null;
  updated_at?: string | null;
};

// Minimal structural input for the source-review helpers. Any fuller procedure
// object (AdminQualityBaseProcedure) satisfies it, so existing callers are
// unaffected; it also lets lightweight callers (e.g. the guided-decision
// availability layer) reuse the exact freshness logic.
export type SourceReviewInput = {
  source_version?: string | null;
  last_reviewed_at?: string | null;
  chapters?: SourceReviewChapter | SourceReviewChapter[] | null;
};

export type SourceReviewWarning =
  | "Source updated"
  | "Never reviewed against source"
  | "Version mismatch";

export const GENERIC_FILLER_PHRASES = [
  "source chapter",
  "source-supported",
  "linked source",
  "quality review",
  "check the source",
  "according to source",
  "source rules",
  "source process",
  "pending source review",
  "draft operational card",
  "use this card after",
  "where source allows",
  "escalate unclear",
];

export function genericFillerFields(procedure: AdminQualityBaseProcedure) {
  const fields: Array<[string, string]> = [
    ["summary", procedure.summary ?? ""],
    ["when_to_use", procedure.when_to_use ?? ""],
    ["required_information", jsonItemsToSearchText(procedure.required_information)],
    ["system_steps", jsonItemsToSearchText(procedure.system_steps)],
    ["passenger_advice", jsonItemsToSearchText(procedure.passenger_advice)],
    ["allowed", jsonItemsToSearchText(procedure.allowed)],
    ["not_allowed", jsonItemsToSearchText(procedure.not_allowed)],
    ["escalation_points", jsonItemsToSearchText(procedure.escalation_points)],
    ["fees_charges", procedure.fees_charges ?? ""],
  ];

  return fields
    .filter(([, value]) => {
      const normalized = value.toLowerCase();
      return GENERIC_FILLER_PHRASES.some((phrase) => normalized.includes(phrase));
    })
    .map(([field]) => field);
}

export function hasGenericFiller(procedure: AdminQualityBaseProcedure) {
  return genericFillerFields(procedure).length > 0;
}

export function isReferenceCard(
  card: Pick<AdminQualityBaseProcedure, "service_code" | "service_type" | "category">
) {
  const type = `${card.service_type ?? ""} ${card.category ?? ""}`.toLowerCase();
  return (
    card.service_code?.toUpperCase() === "MCT" ||
    type.includes("reference") ||
    type.includes("rule") ||
    type.includes("timing") ||
    type.includes("connection reference")
  );
}

export function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function hasItems(items: JsonValue[] | null | undefined) {
  return Array.isArray(items) && items.some((item) => Boolean(readableJsonItem(item)));
}

export function readableJsonItem(item: JsonValue, options: { fallbackJson?: boolean } = {}) {
  if (typeof item === "string") return item.trim();
  if (typeof item === "number" || typeof item === "boolean") return String(item);
  if (!item || Array.isArray(item) || typeof item !== "object") return "";

  const record = item as Record<string, JsonValue>;
  for (const key of ["label", "text", "value", "title", "description"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return options.fallbackJson ? JSON.stringify(item) : "";
}

export function jsonItemsToSearchText(items: JsonValue[] | null | undefined) {
  if (!Array.isArray(items)) return "";
  return items.map((item) => readableJsonItem(item)).filter(Boolean).join(" ");
}

export function sourceReviewWarnings(procedure: SourceReviewInput): SourceReviewWarning[] {
  const chapter = firstSourceReviewChapter(procedure.chapters);
  if (!chapter) return [];

  const warnings: SourceReviewWarning[] = [];
  const reviewedAt = validDate(procedure.last_reviewed_at);
  const chapterUpdatedAt = validDate(chapter.updated_at);

  if (!reviewedAt) {
    warnings.push("Never reviewed against source");
  } else if (chapterUpdatedAt && chapterUpdatedAt > reviewedAt) {
    warnings.push("Source updated");
  }

  if (
    procedure.source_version?.trim() &&
    chapter.source_version?.trim() &&
    procedure.source_version.trim() !== chapter.source_version.trim()
  ) {
    warnings.push("Version mismatch");
  }

  return warnings;
}

export function sourceReviewStatus(procedure: SourceReviewInput) {
  const warnings = sourceReviewWarnings(procedure);
  if (warnings.length > 0) return warnings.join("; ");
  return firstSourceReviewChapter(procedure.chapters) ? "Current" : "No linked source chapter";
}

export function listQualityBadges(procedure: AdminQualityBaseProcedure) {
  const badges: string[] = [];
  const isReference = isReferenceCard(procedure);
  if (!procedure.is_published || procedure.review_status === "needs_review" || procedure.review_status === "draft") {
    badges.push("Draft");
  } else {
    badges.push("Published");
  }
  if (isReference && !hasText(procedure.cut_off_time)) badges.push("Missing timing rule");
  if (!isReference && !hasText(procedure.cut_off_time)) badges.push("Missing deadline");
  if (!hasItems(procedure.passenger_advice)) badges.push("Missing passenger advice");
  if (!hasItems(procedure.not_allowed)) badges.push("Missing restrictions");
  if (!hasItems(procedure.escalation_points)) badges.push("Missing escalation");
  if (!hasText(procedure.source_confidence)) badges.push("Missing source confidence");
  if (hasGenericFiller(procedure)) badges.push("Generic filler");
  badges.push(...sourceReviewWarnings(procedure));
  if (badges.length === 1) badges.push("Ready-looking");
  return badges;
}

export function detailQualityBadges(procedure: AdminQualityBaseProcedure, isReference = isReferenceCard(procedure)) {
  const badges: string[] = [];
  if (!isReference && !hasText(procedure.cut_off_time)) badges.push("Missing deadline");
  if (!hasItems(procedure.passenger_advice)) badges.push("Missing passenger advice");
  if (!hasItems(procedure.not_allowed)) badges.push("Missing restrictions");
  if (isReference && !hasText(procedure.cut_off_time)) badges.push("Missing timing rule");
  if (genericFillerFields(procedure).length > 0) badges.push("Generic filler");
  badges.push(...sourceReviewWarnings(procedure));
  if (badges.length === 0) badges.push("Ready-looking");
  return badges;
}

function firstSourceReviewChapter(
  chapters: SourceReviewChapter | SourceReviewChapter[] | null | undefined
) {
  return Array.isArray(chapters) ? chapters[0] ?? null : chapters ?? null;
}

function validDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
