// Shared operational-answer derivation (UX-R1B).
//
// Converts a source-backed procedure card into the compact operational answer an
// agent needs first: can we action, deadline, who handles it, one blocker, one
// primary action — plus the full detail arrays for progressive disclosure.
//
// It never invents content: every field is derived only from existing card
// fields and is omitted when the source has nothing to say. It is null-safe
// across strings, arrays, JSON values, nulls, and whitespace-only values.
// Reused by /search now and by the procedure page in UX-R1C.

import { readableJsonItems } from "./search.ts";
import type { JsonValue } from "./types.ts";

export type OperationalAnswerCard = {
  title: string;
  summary?: string | null;
  when_to_use?: string | null;
  cut_off_time?: string | null;
  who_can_action?: JsonValue[] | null;
  required_information?: JsonValue[] | null;
  system_steps?: JsonValue[] | null;
  passenger_advice?: JsonValue[] | null;
  allowed?: JsonValue[] | null;
  not_allowed?: JsonValue[] | null;
  escalation_points?: JsonValue[] | null;
  fees_charges?: string | null;
};

export type OperationalAnswer = {
  title: string;
  /** One-line purpose, or null when the source has none. */
  summary: string | null;
  /** Neutral, source-safe answer to "Can we action?". Always present. */
  canAction: string;
  /** First meaningful deadline line, or null. */
  deadline: string | null;
  /** First "who can action" entry, or null. */
  handler: string | null;
  /** First meaningful restriction ("do not proceed when"), or null. */
  criticalBlocker: string | null;
  /** First meaningful agent step (or a safe fallback), or null. */
  primaryAction: string | null;
  /** Full detail arrays for progressive disclosure. */
  requiredInformation: string[];
  agentSteps: string[];
  passengerAdvice: string[];
  allowed: string[];
  notAllowed: string[];
  escalation: string[];
  fees: string | null;
  /** True when any disclosure detail exists. */
  hasDetails: boolean;
};

function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// First meaningful line of a multi-line / semicolon-delimited field (e.g. a
// cut-off that lists several rules). Returns null when there is no real content.
function firstMeaningfulLine(value: string | null | undefined): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const parts = text.includes("\n")
    ? text.split(/\r?\n/)
    : text.includes(";")
      ? text.split(";")
      : [text];
  const first = parts.map((part) => part.trim()).find(Boolean);
  return first ?? null;
}

export function deriveOperationalAnswer(card: OperationalAnswerCard): OperationalAnswer {
  const allowed = readableJsonItems(card.allowed ?? null);
  const notAllowed = readableJsonItems(card.not_allowed ?? null);
  const agentSteps = readableJsonItems(card.system_steps ?? null);
  const requiredInformation = readableJsonItems(card.required_information ?? null);
  const passengerAdvice = readableJsonItems(card.passenger_advice ?? null);
  const escalation = readableJsonItems(card.escalation_points ?? null);
  const handlers = readableJsonItems(card.who_can_action ?? null);

  const summary = cleanText(card.summary) ?? cleanText(card.when_to_use);
  const deadline = firstMeaningfulLine(card.cut_off_time);
  const handler = handlers[0] ?? null;
  const criticalBlocker = notAllowed[0] ?? null;
  const fees = cleanText(card.fees_charges);

  // Can we action?: prefer source applicability; otherwise stay neutral. Never
  // asserts a definitive "yes" the source does not support.
  const canAction =
    allowed.length > 0
      ? "Yes, subject to the conditions below."
      : "Review the conditions below.";

  // Primary agent action: first documented step, else a suitable purpose line.
  const primaryAction = agentSteps[0] ?? cleanText(card.when_to_use) ?? summary ?? null;

  const hasDetails =
    requiredInformation.length > 0 ||
    agentSteps.length > 0 ||
    passengerAdvice.length > 0 ||
    allowed.length > 0 ||
    notAllowed.length > 0 ||
    escalation.length > 0 ||
    Boolean(fees);

  return {
    title: card.title,
    summary,
    canAction,
    deadline,
    handler,
    criticalBlocker,
    primaryAction,
    requiredInformation,
    agentSteps,
    passengerAdvice,
    allowed,
    notAllowed,
    escalation,
    fees,
    hasDetails,
  };
}
