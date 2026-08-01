// Deterministic Operational Intelligence — reviewed concept registry (OI-1).
// SINGLE SOURCE OF TRUTH for how agents describe customer scenarios. Consumed by
// the decision router (safe single-slug concepts → guided routing) and the
// resolver (search safe-messages, ambiguity, additive expansion). It never
// models operational rules and never changes card visibility.
//
// Rules:
//  - single generic tokens (wife, dog, cash, cancel, visa, medical, bag,
//    airport, broken, name, flight, customer, passenger) are NEVER safe
//    auto-route phrases; they appear only as broad/ambiguous concepts.
//  - "safe" concepts map to exactly one workflow slug.
//  - "ambiguous" concepts map to several; the UI shows options, never forces one.
//  - "broad" concepts are search-only categories.
//  - "unsafe_*" concepts never route and carry a safe guidance message.

import type { OperationalConcept } from "./types.ts";

const IMMIGRATION_MSG =
  "Travel eligibility depends on official requirements. Review the relevant travel-document guidance.";
const MEDICAL_MSG =
  "Medical fitness cannot be determined from the search description. Review the relevant medical procedure.";

export const OPERATIONAL_CONCEPTS: OperationalConcept[] = [
  // ---------------- Booking ----------------
  {
    id: "name-correction",
    targetSlugs: ["name-correction"],
    category: "Booking changes",
    safety: "safe",
    phrases: [
      "name correction", "name change", "wrong name", "wrong passenger name",
      "passenger name incorrect", "incorrect passenger name", "spelling mistake in name",
      "name spelling mistake", "change passenger name", "typo in name", "misspelled name",
    ],
    abbreviations: ["ncfe", "ncfb"],
  },
  {
    id: "duplicate-booking",
    targetSlugs: ["duplicate-booking"],
    category: "Booking changes",
    safety: "safe",
    phrases: [
      "duplicate booking", "duplicate ticket", "booked twice", "booking made twice",
      "same ticket twice", "two identical bookings", "booked the same flight twice",
    ],
  },
  {
    id: "auto-split-od",
    targetSlugs: ["auto-split-od"],
    category: "Booking changes",
    safety: "safe",
    phrases: [
      "auto split od", "auto split", "split od", "od split",
      "first leg boarded second no show", "boarded one sector missed the next sector",
      "fz-fz connection booking",
    ],
  },
  {
    id: "government-deals",
    targetSlugs: ["government-deals"],
    category: "Booking changes",
    safety: "safe",
    phrases: [
      "government deal", "government deals", "government discount", "governmental booking",
      "government fare", "esaad", "al saada", "alsaada", "fazaa", "gdrfa",
      "government ticket", "government booking",
    ],
  },
  {
    id: "flight-disruption",
    targetSlugs: ["flight-disruption"],
    category: "Disruption",
    safety: "safe",
    phrases: [
      "flight disruption", "missed flight", "missed the flight", "missed departure",
      "no show after check in", "no show after online check in", "delayed flight",
      "flight delayed", "cancelled flight", "flight cancelled", "flight canceled",
      "schedule change", "no show", "noshow", "disruption",
    ],
    abbreviations: ["fdis"],
  },

  // ---------------- Medical & assistance ----------------
  {
    id: "wheelchair",
    targetSlugs: ["wheelchair"],
    category: "Medical & assistance",
    safety: "safe",
    phrases: [
      "wheelchair", "wheel chair", "cannot walk", "can't walk", "unable to walk",
      "reduced mobility", "mobility assistance", "electric wheelchair", "battery wheelchair",
    ],
    abbreviations: ["wchr", "wchs", "wchc"],
    synonyms: ["wheel chair assistance", "wheelchair assistance", "mobility aid", "mobility aids"],
    misspellings: ["wheelchiar", "wheelchari"],
  },
  {
    id: "plaster-cast-leg-brace",
    targetSlugs: ["plaster-cast-leg-brace"],
    category: "Medical & assistance",
    safety: "safe",
    phrases: [
      "broken leg", "fractured leg", "leg fracture", "cast on leg", "plaster cast",
      "leg brace", "fresh cast", "plaster less than 48 hours", "leg in a cast", "leg in plaster",
    ],
    synonyms: ["plaster", "cast", "broken arm", "fractured arm"],
  },
  {
    id: "oxygen",
    targetSlugs: ["oxygen"],
    category: "Medical & assistance",
    safety: "safe",
    phrases: [
      "oxygen", "oxygen machine", "oxygen concentrator", "portable oxygen concentrator",
      "oxygen carry", "cpap",
    ],
    synonyms: ["oxygen cylinder", "breathing apparatus"],
    abbreviations: ["poc", "o2", "oxyg"],
    misspellings: ["oxigen", "oxygyn"],
  },
  {
    id: "pregnancy",
    targetSlugs: ["pregnancy"],
    category: "Medical & assistance",
    safety: "safe",
    phrases: [
      "pregnant", "pregnancy", "pregnant passenger", "wife is pregnant", "wife pregnant",
      "travelling while pregnant", "twins pregnancy", "expecting baby", "pregnancy certificate",
      "weeks pregnant",
    ],
    synonyms: ["expecting", "expectant mother", "expectant", "with child"],
  },
  {
    id: "meda",
    targetSlugs: ["meda"],
    category: "Medical & assistance",
    safety: "safe",
    phrases: [
      "meda", "medical exception", "unfit to travel certificate", "medical refund request",
      "medical change request", "medical travel exception",
    ],
  },
  {
    id: "service-animal",
    targetSlugs: ["service-animal"],
    category: "Special services",
    safety: "safe",
    phrases: [
      "service dog", "guide dog", "assistance dog", "service animal", "seeing eye dog",
      // Maps here for review only — the workflow states ESAs are NOT accepted.
      "emotional support animal", "emotional support dog",
    ],
    synonyms: ["assistance animal", "seeing eye animal"],
    abbreviations: ["svan"],
  },
  {
    id: "dpna",
    targetSlugs: ["dpna"],
    category: "Special services",
    safety: "safe",
    phrases: [
      "intellectual disability", "developmental disability", "passenger needs continuous companion",
      "hidden disability", "autism", "down syndrome", "dementia",
    ],
    synonyms: ["needs continuous assistance", "non visible disability"],
    abbreviations: ["dpna"],
  },
  {
    id: "death-case",
    targetSlugs: ["death-case"],
    category: "Medical & assistance",
    safety: "safe",
    phrases: [
      "death case", "bereavement", "death certificate", "family member died",
      "passenger passed away", "passenger died",
    ],
  },
  {
    id: "human-remains",
    targetSlugs: ["human-remains"],
    category: "Special services",
    safety: "safe",
    phrases: [
      "human remains", "coffin transport", "deceased passenger transport", "repatriation of remains",
      "carry ashes", "ashes in cabin", "hum cargo",
    ],
  },
  {
    id: "falcon-handling",
    targetSlugs: ["falcon-handling"],
    category: "Special services",
    safety: "safe",
    phrases: [
      "falcon", "falcons", "travelling with falcon", "carrying falcon", "needs falcon",
      "bird of prey", "falcon baggage", "carry falcon",
    ],
  },

  // ---------------- Baggage ----------------
  {
    id: "worldtracer",
    targetSlugs: ["worldtracer"],
    category: "Baggage",
    safety: "safe",
    phrases: [
      "worldtracer", "world tracer", "lost baggage", "lost bag", "delayed baggage",
      "delayed luggage", "damaged baggage", "damaged suitcase", "baggage claim", "missing bag",
    ],
    synonyms: ["missing luggage", "baggage not arrived", "bag did not arrive"],
    abbreviations: ["wt", "pir"],
  },
  {
    id: "blue-ribbon-bags",
    targetSlugs: ["blue-ribbon-bags"],
    category: "Baggage",
    safety: "safe",
    phrases: [
      "blue ribbon bags", "blue ribbon", "baggage protection", "baggage protection claim",
    ],
    synonyms: ["baggage protection cover"],
    abbreviations: ["brb"],
  },
  {
    // OPS-2: sporting equipment ONLY. Firearms/ammunition now have their own
    // concept — v81.7 ch.29 is a separate chapter with a separate process.
    id: "sporting-equipment",
    targetSlugs: ["sporting-equipment"],
    category: "Special services",
    safety: "safe",
    phrases: [
      "sporting equipment", "sports equipment", "sports bag", "bicycle", "bike",
      "golf bag", "golf clubs", "golf equipment", "surfboard", "ski equipment", "skis",
      "snowboard", "diving equipment", "fishing equipment",
    ],
    synonyms: ["cycle", "push bike", "pushbike"],
    // SPEX retired effective 01-Aug-2026 (v81.7 ch.28 §22) — never route it as
    // live. "bike"/"bicycle" are already phrases of this concept (SSR BIKE).
    abbreviations: ["speq"],
  },
  {
    // OPS-2 firearms / ammunition (GO TO v81.7 ch.29 "Firearms and Carry of
    // Ammunition", pp.130-132). No dedicated procedure card exists, so this
    // concept targets the reviewed sporting-equipment card, whose guided
    // workflow carries the source-backed weapon rules (96h pre-booking, SSR
    // WEAP AED 300 per passenger per sector, documents to Security@flydubai.com
    // 4 working days ahead — v81.7 pp.127, 129). No new workflow is created.
    id: "firearms-ammunition",
    targetSlugs: ["sporting-equipment"],
    category: "Special services",
    chapterHint: "29. Firearms and Carry of Ammunition",
    safety: "safe",
    phrases: [
      "firearm", "firearms", "ammunition", "firearm declaration", "carrying ammunition",
      "travelling with firearm", "traveling with firearm", "travelling with a firearm",
      "carrying a firearm", "weapon carriage", "hunting rifle",
    ],
    synonyms: ["ammo", "rifle", "pistol", "travelling with gun", "carrying a gun"],
    abbreviations: ["weap"],
  },
  {
    // Deliberately ambiguous: a "sporting weapon" sits across the Sporting
    // Equipment process (ch.28) and the Firearms process (ch.29). Both are
    // documented on the same reviewed card, so the agent is never forced to
    // guess which process applies.
    id: "sporting-weapon",
    targetSlugs: ["sporting-equipment"],
    category: "Special services",
    chapterHint: "28. Sporting Equipment / 29. Firearms and Carry of Ammunition",
    safety: "ambiguous",
    phrases: ["sporting weapon", "sporting weapons", "weapon"],
  },

  // ---------------- Travel documents ----------------
  {
    id: "travel-requirements",
    targetSlugs: ["travel-requirements"],
    category: "Travel documents",
    safety: "safe",
    phrases: [
      "emirates id", "original emirates id", "residence card", "uae resident documents",
      "travel requirements", "proof of uae residency", "resident returning to uae",
    ],
  },
  {
    id: "visa-change",
    targetSlugs: ["visa-change"],
    category: "Travel documents",
    safety: "safe",
    phrases: [
      "visa change", "change visa", "visa change flight", "mct visa change", "kwi visa change",
      "bah visa change",
    ],
  },
  {
    id: "ok-to-board",
    targetSlugs: ["ok-to-board"],
    category: "Travel documents",
    safety: "safe",
    phrases: [
      "ok to board", "okay to board", "ek manual ok to board", "ek star ok to board",
      "ek oktb", "visa verification",
    ],
    abbreviations: ["oktb"],
  },

  // ---------------- Airport / check-in ----------------
  {
    id: "check-in-olci",
    targetSlugs: ["check-in-olci"],
    category: "Check-in & airport",
    safety: "safe",
    phrases: [
      "online check in", "online check-in", "online checkin", "cannot check in online",
      "airport check in", "check in problem", "boarding pass", "check in", "checked in",
    ],
    synonyms: ["web check in", "mobile check in", "cannot check in", "unable to check in"],
    abbreviations: ["olci"],
  },
  {
    id: "business-lounge",
    targetSlugs: ["business-lounge"],
    category: "Check-in & airport",
    safety: "safe",
    phrases: ["business lounge", "dxb t2 lounge", "t2 lounge", "business class lounge"],
  },
  {
    id: "meet-assist",
    targetSlugs: ["meet-assist"],
    category: "Check-in & airport",
    safety: "safe",
    phrases: ["meet and assist", "meet & assist", "airport meet service"],
    synonyms: ["airport assistance service", "vip meet service"],
    abbreviations: ["masd", "maas"],
  },

  // ---------------- Connections ----------------
  {
    id: "minimum-connection-time",
    targetSlugs: ["minimum-connection-time"],
    category: "Check-in & airport",
    safety: "safe",
    phrases: [
      "connection time", "minimum connection time", "minimum connection", "transfer time",
      "connecting flight", "tight connection",
    ],
    synonyms: ["connection time between flights", "transfer window"],
    abbreviations: ["mct"],
  },

  // ---------------- Special / other ----------------
  {
    id: "extra-seat-cbbg",
    targetSlugs: ["extra-seat-cbbg"],
    category: "Special services",
    safety: "safe",
    phrases: [
      "extra seat", "cabin baggage seat", "cello seat", "musical instrument seat",
      "musical instrument", "valuable item in cabin",
    ],
    abbreviations: ["exst", "cbbg"],
  },

  // ---------------- Ambiguous (show multiple; never force one) ----------------
  {
    id: "visa",
    targetSlugs: ["travel-requirements", "visa-change", "ok-to-board"],
    category: "Travel documents",
    safety: "ambiguous",
    phrases: ["visa"],
  },
  {
    id: "medical-certificate",
    targetSlugs: ["pregnancy", "meda", "plaster-cast-leg-brace"],
    category: "Medical & assistance",
    safety: "ambiguous",
    phrases: ["medical certificate", "doctor certificate", "doctors note", "fitness certificate"],
  },
  {
    id: "missed-connection",
    targetSlugs: ["minimum-connection-time", "flight-disruption"],
    category: "Disruption",
    safety: "ambiguous",
    phrases: ["missed connection", "missed my connection", "missed the connection"],
  },

  // ---------------- Broad categories (search only; never auto-route) ----------------
  { id: "broad-medical", targetSlugs: [], category: "Medical & assistance", safety: "broad", phrases: ["medical assistance", "medical"] },
  {
    id: "broad-baggage",
    targetSlugs: [],
    category: "Baggage",
    safety: "broad",
    // OPS-2: out-of-gauge and television vocabulary moved to their own
    // reference concepts so the same phrase is never owned by two concepts.
    phrases: ["baggage", "bag", "bags", "extra baggage", "add bag", "luggage", "heavy baggage"],
  },
  { id: "broad-airport", targetSlugs: [], category: "Check-in & airport", safety: "broad", phrases: ["airport", "lounge", "airport lounge", "lounge access"] },
  // v81.7 new reference topics (chapter/manual guidance only — no workflow).
  { id: "al-majlis", targetSlugs: [], category: "Check-in & airport", safety: "broad", phrases: ["al majlis", "al majlis vip", "majlis vip service", "lmaj"] },
  { id: "champagne", targetSlugs: [], category: "Special services", safety: "broad", phrases: ["champagne", "champagne on board"] },

  // ---------------- OPS-2 reference concepts (no reviewed card exists) -------
  // Television carriage lives inside the Baggage chapter (v81.7 p.107); there
  // is no TV procedure card, so this stays reference/search-only.
  {
    id: "television-carriage",
    targetSlugs: [],
    category: "Baggage",
    chapterHint: "26. Baggage — TV Charge at the Airport",
    safety: "broad",
    phrases: ["television", "television baggage", "tv baggage", "carrying a television", "tv charge", "tvch"],
    synonyms: ["lcd tv", "led tv", "flat screen", "flat screen tv", "plasma tv"],
  },
  // Out-of-gauge / oversized checked baggage (v81.7 p.103): airport-handled,
  // reference-only — no Contact Centre decision tree.
  {
    id: "out-of-gauge-baggage",
    targetSlugs: [],
    category: "Baggage",
    chapterHint: "26. Baggage — Out of Gauge / Oversize",
    safety: "broad",
    phrases: [
      "out of gauge", "out of gauge baggage", "oversize bag", "oversized baggage",
      "oversized checked baggage", "oversize baggage",
    ],
    abbreviations: ["oogs", "oogl", "obag", "hbag"],
  },

  // ---------------- OPS-2 conservative generics (never auto-route) ----------
  // These exist so the layer RECOGNISES the vocabulary (category hints, search
  // expansion, multi-topic visibility) while guaranteeing that a bare generic
  // word can never select an operational workflow.
  { id: "broad-animal", targetSlugs: [], category: "Special services", safety: "broad", phrases: ["dog", "dogs", "pet", "pets", "animal", "cat"] },
  { id: "broad-boarding", targetSlugs: [], category: "Check-in & airport", safety: "broad", phrases: ["gate", "boarding", "boarding gate", "gate closed"] },
  { id: "broad-travel-document", targetSlugs: [], category: "Travel documents", safety: "broad", phrases: ["passport", "travel document", "travel documents", "emirates id card"] },
  { id: "broad-connection", targetSlugs: [], category: "Check-in & airport", safety: "broad", phrases: ["connection", "connecting", "transit", "transfer", "stopover", "layover"] },
  { id: "broad-interline", targetSlugs: [], category: "Booking changes", safety: "broad", phrases: ["interline", "codeshare", "other airline", "oal"] },
  { id: "broad-ssr", targetSlugs: [], category: "Special services", safety: "broad", phrases: ["ssr", "special request", "special service request"] },
  // v81.4 Accessibility seating guidelines: relevant to both wheelchair and DPNA.
  {
    id: "accessibility-seating",
    targetSlugs: ["wheelchair", "dpna"],
    category: "Medical & assistance",
    safety: "ambiguous",
    phrases: ["accessibility", "accessibility seating", "seat allocation assistance", "seat allocation for additional assistance"],
  },
  { id: "broad-refund", targetSlugs: [], category: "Payment & refunds", safety: "broad", phrases: ["refund", "refund ticket", "money back", "voucher", "credit voucher", "cash refund"] },
  { id: "broad-flight-change", targetSlugs: [], category: "Booking changes", safety: "broad", phrases: ["cancel flight", "cancel ticket", "change flight", "change booking"] },

  // ---------------- Unsafe (never route; guidance message only) ----------------
  {
    id: "unsafe-immigration",
    targetSlugs: [],
    safety: "unsafe_immigration",
    safeMessage: IMMIGRATION_MSG,
    phrases: [
      "can passenger enter uae", "can passenger enter dubai", "passenger eligible to enter uae",
      "is passenger allowed to enter", "visa advice", "immigration advice", "will passenger be allowed in",
    ],
  },
  {
    id: "unsafe-medical-fitness",
    targetSlugs: [],
    safety: "unsafe_medical",
    safeMessage: MEDICAL_MSG,
    phrases: ["is passenger fit to fly", "fit to fly", "medically fit to travel", "is the passenger healthy enough"],
  },
];

// Router intents. SAFE single-slug concepts drive confident guided routing.
// AMBIGUOUS concepts are also surfaced (multiple candidate slugs → the router
// reports needsClarification and never forces one). BROAD and UNSAFE concepts
// are excluded — they never auto-start a workflow.
export function conceptsForRouter(): { intent: string; slugs: string[]; phrases: string[] }[] {
  return OPERATIONAL_CONCEPTS.filter(
    (c) =>
      (c.safety === "safe" && c.targetSlugs.length === 1) ||
      (c.safety === "ambiguous" && c.targetSlugs.length > 0)
  ).map((c) => ({
    intent: c.id,
    slugs: c.targetSlugs,
    phrases: [
      ...c.phrases,
      ...(c.aliases ?? []),
      ...(c.synonyms ?? []),
      ...(c.abbreviations ?? []),
      ...(c.misspellings ?? []),
    ],
  }));
}

/** Every workflow slug that a single-slug SAFE concept can route to. */
export function safeRoutableSlugs(): string[] {
  const slugs = new Set<string>();
  for (const c of OPERATIONAL_CONCEPTS) {
    if (c.safety === "safe" && c.targetSlugs.length === 1) slugs.add(c.targetSlugs[0]);
  }
  return [...slugs];
}
