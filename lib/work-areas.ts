// Shared work-area grouping for published operational cards.
// Used by the Service Directory and the homepage guided decision flow.

export const WORK_AREAS = [
  "Booking Changes",
  "Baggage",
  "Special Assistance",
  "Airport / Check-in",
  "Disruption",
  "Payment / Refund",
  "Interline / Connections",
  "Visa / OKTB",
  "Other References",
] as const;

export type WorkArea = (typeof WORK_AREAS)[number];

export type GroupableCard = {
  title: string;
  category: string;
  service_code: string | null;
  service_type: string | null;
};

export function groupForCard(card: GroupableCard): WorkArea {
  const text = normalizeArea(
    `${card.service_type ?? ""} ${card.category} ${card.service_code ?? ""} ${card.title}`
  );

  if (matchesArea(text, ["payment", "refund", "voucher", "insurance"])) return "Payment / Refund";
  if (matchesArea(text, ["fdis", "disruption", "delay", "schedule"])) return "Disruption";
  if (matchesArea(text, ["mct", "connection", "transfer", "interline", "codeshare"])) return "Interline / Connections";
  if (matchesArea(text, ["visa", "oktb", "ok to board"])) return "Visa / OKTB";
  if (matchesArea(text, ["wheelchair", "wchr", "wchs", "wchc", "meda", "dpna", "pregnancy"])) return "Special Assistance";
  if (matchesArea(text, ["check in", "check-in", "olci", "lounge", "boarding", "airport"])) return "Airport / Check-in";
  if (matchesArea(text, ["baggage", "speq", "spex", "falcon", "petc"])) return "Baggage";
  if (matchesArea(text, ["booking", "name", "seat", "cbbg", "exst", "stopover", "government"])) return "Booking Changes";
  return "Other References";
}

export function matchesArea(value: string, terms: string[]) {
  return terms.some((term) => value.includes(normalizeArea(term)));
}

export function normalizeArea(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
