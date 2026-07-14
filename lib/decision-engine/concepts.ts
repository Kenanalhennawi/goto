// Structured intent dictionary: operational phrases -> target procedure
// slugs. Phrases are routing hints only; they never create policy.
// Slugs must correspond to real procedure cards; the router only ever
// surfaces cards that pass the approved+published visibility filter.

export type IntentDefinition = {
  intent: string;
  slugs: string[];
  phrases: string[];
};

export const INTENTS: IntentDefinition[] = [
  {
    intent: "wheelchair",
    slugs: ["wheelchair"],
    phrases: [
      "wheelchair", "cannot walk", "can't walk", "cant walk", "reduced mobility",
      "mobility assistance", "wchr", "wchs", "wchc", "electric wheelchair",
      "battery wheelchair", "wheelchair with battery",
    ],
  },
  {
    intent: "pregnancy",
    slugs: ["pregnancy"],
    phrases: ["pregnant", "pregnancy", "expecting baby", "fit to fly", "pregnancy certificate", "weeks pregnant"],
  },
  {
    intent: "name-correction",
    slugs: ["name-correction"],
    phrases: [
      "wrong name", "wrong passenger name", "spelling mistake", "misspelled",
      "change passenger name", "name swap", "title correction", "name correction",
      "ncfe", "ncfb", "name change",
    ],
  },
  {
    intent: "sporting-equipment",
    slugs: ["sporting-equipment"],
    phrases: ["sporting equipment", "sports equipment", "speq", "spex", "sporting weapon", "weapon", "firearm", "ammunition"],
  },
  {
    intent: "flight-disruption",
    slugs: ["flight-disruption"],
    phrases: [
      "missed flight", "missed the flight", "missed departure", "flight cancelled",
      "flight canceled", "flight delayed", "disruption", "fdis", "schedule change", "no show", "noshow",
    ],
  },
  {
    intent: "check-in-olci",
    slugs: ["check-in-olci"],
    phrases: ["check in", "checked in", "check-in", "checkin", "olci", "online check-in", "online checkin", "boarding pass"],
  },
  {
    intent: "extra-seat-cbbg",
    slugs: ["extra-seat-cbbg"],
    phrases: ["extra seat", "exst", "cbbg", "cabin baggage seat", "musical instrument", "valuable item in cabin"],
  },
  {
    intent: "falcon-handling",
    slugs: ["falcon-handling"],
    phrases: ["falcon", "falcons", "bird of prey", "carrying falcon", "needs falcon"],
  },
  {
    intent: "minimum-connection-time",
    slugs: ["minimum-connection-time"],
    phrases: ["connection time", "mct", "minimum connection", "transfer time", "connecting flight", "tight connection"],
  },
  {
    intent: "ok-to-board",
    slugs: ["ok-to-board"],
    phrases: ["oktb", "ok to board", "okay to board", "visa verification", "ek oktb"],
  },
];
