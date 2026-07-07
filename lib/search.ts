export const MIN_SEARCH_QUERY_LENGTH = 2;
export const MAX_SEARCH_QUERY_LENGTH = 120;
const MAX_SEARCH_TERMS = 12;
const NORMAL_SHORT_WORDS = new Set(["in", "to", "on", "of", "as", "is", "no", "if", "or", "an", "at", "by"]);
export type FieldQueryKind = "passenger_advice" | "restrictions" | "cut_off" | "who_can_action" | "approval" | "channel";

export type RankableSearchResult = {
  title: string;
  snippet?: string | null;
  rank?: number | null;
  chapter_number?: number | null;
  search_keywords?: string[] | null;
  body_text?: string | null;
};

export type RankableOperationalCard = {
  title: string;
  slug: string;
  service_code?: string | null;
  service_type?: string | null;
  category?: string | null;
  cut_off_time?: string | null;
  channels?: unknown[] | null;
  who_can_action?: unknown[] | null;
  required_information?: unknown[] | null;
  system_steps?: unknown[] | null;
  passenger_advice?: unknown[] | null;
  allowed?: unknown[] | null;
  not_allowed?: unknown[] | null;
  escalation_points?: unknown[] | null;
  fees_charges?: string | null;
  keywords?: string[] | null;
  aliases?: string[] | null;
  summary?: string | null;
  when_to_use?: string | null;
  priority?: number | null;
};

const CODE_ALIASES: Record<string, string[]> = {
  WCHR: ["wheelchair"],
  WCHS: ["wheelchair"],
  WCHC: ["wheelchair"],
  WCBD: ["wheelchair battery dry"],
  WCBW: ["wheelchair battery wet"],
  WCLB: ["wheelchair lithium battery"],
  DPNA: ["disabled passenger"],
  BLND: ["visual impairment"],
  DEAF: ["hearing impairment"],
  MAAS: ["meet and assist"],
  MASD: ["meet and assist"],
  MEDA: ["medical"],
  OXYG: ["oxygen"],
  OXYGEN: ["oxygen"],
  O2: ["oxygen"],
  CPAP: ["medical respiratory device", "oxygen"],
  EXST: ["extra seat"],
  CBBG: ["cabin baggage seat"],
  SEAT: ["seat"],
  SPEQ: ["sporting equipment", "sports equipment", "weapon"],
  XBAG: ["excess baggage"],
  BAGG: ["baggage"],
  BRB: ["blue ribbon bags", "baggage"],
  WT: ["worldtracer"],
  SPML: ["special meal"],
  AVML: ["asian vegetarian meal"],
  CHML: ["child meal"],
  VGML: ["vegetarian meal"],
  BBML: ["baby meal"],
  KSML: ["kosher meal"],
  MOML: ["muslim meal"],
  HNML: ["hindu meal"],
  DBML: ["diabetic meal"],
  GFML: ["gluten free meal"],
  LCML: ["low calorie meal"],
  LFML: ["low fat meal"],
  LSML: ["low salt meal"],
  NLML: ["non lactose meal"],
  VJML: ["vegetarian jain meal"],
  VLML: ["vegetarian lacto ovo meal"],
  SVAN: ["service animal"],
  PETC: ["pet in cabin"],
  AVIH: ["animal in hold"],
  CCHK: ["card verification"],
  VIOK: ["visa ok"],
  OKTB: ["ok to board"],
  FDIS: ["flight disruption", "schedule change", "cancellation"],
  OLCI: ["online check-in", "online checkin"],
  DCS: ["check-in system"],
  DSO: ["dubai stopover"],
  LNGL: ["lounge"],
  MCT: ["minimum connection time", "connection transfers", "connection", "transfer", "connection time", "transfer time"],
};

const SEARCH_ALIASES: Record<string, string[]> = {
  "auto split od": ["auto split od", "fz-fz connection booking", "od split", "connection booking"],
  "auto split": ["auto split", "auto split od", "connection booking"],
  "minimum connection time": ["minimum connection time", "connection time", "transfer time"],
  "dubai stopover": ["dubai stopover", "dso", "stopover"],
  "lounge access during olci": ["lounge access", "olci lounge", "online check-in lounge"],
  "lounge access": ["lounge access", "olci lounge"],
  "olci lounge": ["olci lounge", "online check-in lounge", "lounge access"],
  "sporting equipment": ["sporting equipment", "speq", "sports equipment", "weapon"],
  "sports equipment": ["sports equipment", "sporting equipment", "speq"],
  "falcon handling": ["falcon handling", "falcon", "birds", "animal carriage"],
  falcon: ["falcon", "falcon handling", "birds"],
  birds: ["birds", "falcon", "animal carriage"],
  "extra seat": ["extra seat", "exst", "cbbg"],
  "baggage upgrade": ["baggage upgrade", "excess baggage"],
  "flight disruption": ["flight disruption", "schedule change", "cancellation"],
  "online checkin": ["online checkin", "online check-in", "olci"],
  interline: ["interline", "connection", "transfer", "ek", "oal"],
  wheelchair: ["wheelchair", "wchr", "wchs", "wchc"],
  "name correction": ["name correction", "name change", "ncfb", "ncfe"],
  "name change": ["name change", "name correction"],
  "government deals": ["government deals", "esaad", "alsaada", "gdrfa", "immigration deal"],
  esaad: ["esaad", "government deals"],
  alsaada: ["alsaada", "government deals"],
  gdrfa: ["gdrfa", "immigration deal", "government deals"],
  payment: ["payment", "payment failure", "cchk", "card verification"],
  visa: ["visa", "visa change", "tourist visa"],
  oxygen: ["oxygen", "o2", "cpap"],
  "service animal": ["service animal", "svan", "guide dog"],
  bag: ["baggage"],
  bags: ["baggage"],
  worldtracer: ["worldtracer", "delayed baggage", "damaged baggage", "lost baggage"],
  "world-tracer": ["worldtracer"],
  world: ["worldtracer"],
  tracer: ["worldtracer"],
  "business lounge": ["business lounge", "t2 lounge", "lngl"],
  "meet and assist": ["meet and assist", "masd"],
  "staff tickets": ["staff tickets", "id50", "id90", "staff travel"],
  "special meals": ["special meals", "spml", "avml", "chml", "vgml"],
  ssr: ["ssr", "special request", "cake", "flower", "fruit basket"],
  sprint: ["sprint", "booking system"],
  skywards: ["skywards", "miles", "frequent flyer"],
  salesforce: ["salesforce", "case classification"],
  ticket: ["e-ticketing"],
  tickets: ["e-ticketing"],
};

const WORK_AREA_RELEVANCE: Record<
  string,
  {
    preferred: string[];
    avoid?: string[];
  }
> = {
  MCT: {
    preferred: [
      "connection and transfers",
      "connection transfers",
      "terminal 3 operation",
      "terminal 3",
      "interline",
      "codeshare",
      "connection",
      "transfer",
      "terminal",
    ],
    avoid: ["baggage", "payment", "ok to board", "oktb", "visa"],
  },
  EXST: { preferred: ["seat", "extra seat"] },
  CBBG: { preferred: ["seat", "extra seat", "cabin baggage seat"] },
  SPEQ: { preferred: ["sporting equipment", "sports equipment"] },
  WCHR: { preferred: ["wheelchair"] },
  WCHS: { preferred: ["wheelchair"] },
  WCHC: { preferred: ["wheelchair"] },
  WCBD: { preferred: ["wheelchair"] },
  WCBW: { preferred: ["wheelchair"] },
  WCLB: { preferred: ["wheelchair"] },
  FDIS: { preferred: ["flight disruption", "disruption", "schedule change"] },
  DSO: { preferred: ["dubai stopover", "stopover"] },
  LNGL: { preferred: ["lounge"] },
  WT: { preferred: ["baggage", "worldtracer"] },
};

export function buildSearchTerms(query: string) {
  const trimmed = query.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
  if (trimmed.length < MIN_SEARCH_QUERY_LENGTH) return "";

  const code = operationalCodeFromQuery(trimmed);
  if (code) {
    return phrasesForCode(code)
      .map((phrase) => phraseToTsQuery(phrase))
      .filter(Boolean)
      .join(" | ");
  }

  const aliasPhrases = findSearchAlias(trimmed);
  if (aliasPhrases) {
    return aliasPhrases
      .slice(0, 5)
      .map((phrase) => phraseToTsQuery(phrase))
      .filter(Boolean)
      .join(" | ");
  }

  return phraseToTsQuery(trimmed);
}

export function isOperationalCodeQuery(query: string) {
  return Boolean(operationalCodeFromQuery(query));
}

export function rankSearchResults<T extends RankableSearchResult>(results: T[], query: string) {
  const code = operationalCodeFromQuery(query);
  const topic = searchTopicFromQuery(query, code);
  const normalizedQuery = normalize(query);
  const aliasPhrases = code ? phrasesForCode(code).slice(1) : findSearchAlias(query) ?? [];

  return [...results].sort((a, b) => {
    const scoreA = scoreResult(a, normalizedQuery, code, topic, aliasPhrases);
    const scoreB = scoreResult(b, normalizedQuery, code, topic, aliasPhrases);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return (b.rank ?? 0) - (a.rank ?? 0);
  });
}

export function containsArabic(value: string) {
  return /[\u0600-\u06FF]/.test(value);
}

export function detectFieldQuery(query: string): FieldQueryKind | null {
  const normalized = normalize(query);
  if (/\b(passenger advice|tell passenger|customer advice|what should i tell)\b/.test(normalized)) {
    return "passenger_advice";
  }
  if (/\b(not allowed|restriction|restrictions|cannot)\b/.test(normalized)) return "restrictions";
  if (/\b(cut off|cutoff|deadline)\b/.test(normalized)) return "cut_off";
  if (/\b(who can action|who handles|contact centre add|add service|can contact centre)\b/.test(normalized)) {
    return "who_can_action";
  }
  if (/\b(approval required|required approval|supervisor approval)\b/.test(normalized)) return "approval";
  if (/\b(channel|channels|where can|who handles it)\b/.test(normalized)) return "channel";
  return null;
}

export function fieldQueryMessage(kind: FieldQueryKind | null) {
  switch (kind) {
    case "passenger_advice":
      return "Showing cards with passenger advice.";
    case "restrictions":
      return "Showing cards with restrictions / not allowed rules.";
    case "cut_off":
      return "Showing cards with cut-off or timing information.";
    case "who_can_action":
      return "Showing cards by who can action the service.";
    case "approval":
      return "Showing cards with approval guidance.";
    case "channel":
      return "Showing cards by allowed service channels.";
    default:
      return "";
  }
}

export function scoreOperationalCard(card: RankableOperationalCard, query: string) {
  const code = operationalCodeFromQuery(query);
  const normalizedQuery = normalize(query);
  const fieldKind = detectFieldQuery(query);
  const aliasPhrases = code ? phrasesForCode(code).slice(1) : findSearchAlias(query) ?? [];
  const serviceCode = (card.service_code ?? "").toUpperCase();
  const title = normalize(card.title);
  const slug = normalize(card.slug);
  const serviceType = normalize(card.service_type ?? "");
  const category = normalize(card.category ?? "");
  const keywords = (card.keywords ?? []).map((item) => normalize(item));
  const aliases = (card.aliases ?? []).map((item) => normalize(item));
  const cutOff = normalize(card.cut_off_time ?? "");
  const fields = operationalCardSearchText(card);
  let score = 1000 + (card.priority ?? 0);

  if (code) {
    if (serviceCode === code) score += 30000;
    if (keywords.some((item) => item === normalize(code))) score += 22000;
    if (aliases.some((item) => item === normalize(code))) score += 22000;
    if (hasStandaloneToken(card.title, code)) score += 12000;
    if (fields.includes(normalize(code))) score += 5000;
  }

  if (title === normalizedQuery || slug === normalizedQuery) score += 16000;
  if (title.includes(normalizedQuery)) score += 10000;
  if (keywords.some((item) => item === normalizedQuery || item.includes(normalizedQuery))) score += 10000;
  if (aliases.some((item) => item === normalizedQuery || item.includes(normalizedQuery))) score += 10000;
  if (fields.includes(normalizedQuery)) score += 2500;

  for (const phrase of aliasPhrases) {
    const normalizedPhrase = normalize(phrase);
    if (!normalizedPhrase) continue;
    if (title.includes(normalizedPhrase)) score += 6500;
    if (keywords.some((item) => item.includes(normalizedPhrase))) score += 6500;
    if (aliases.some((item) => item.includes(normalizedPhrase))) score += 6500;
    if (fields.includes(normalizedPhrase)) score += 1800;
  }

  const reference = isReferenceCard(card);
  const specificReferenceQuery = /\b(mct|timing rule|reference rule|connection|transfer|connection time|minimum connection)\b/.test(normalizedQuery);

  if (fieldKind === "cut_off" && cutOff) score += reference ? 2600 : 8500;
  if (!fieldKind && /\b(time)\b/.test(normalizedQuery) && cutOff) score += reference ? 1800 : 3500;
  if (specificReferenceQuery && reference) {
    score += 12000;
  }
  if (fieldKind === "passenger_advice" && hasItems(card.passenger_advice)) {
    score += reference ? 3000 : 9000;
  }
  if (fieldKind === "restrictions" && hasItems(card.not_allowed)) {
    score += reference ? 3000 : 9000;
  }
  if (fieldKind === "who_can_action" && hasItems(card.who_can_action)) {
    score += reference ? 3000 : 9000;
  }
  if (fieldKind === "approval" && (card.required_information || fields.includes("approval"))) score += reference ? 2000 : 6500;
  if (fieldKind === "channel" && hasItems(card.channels)) score += reference ? 2500 : 7500;
  if (reference && fieldKind && !specificReferenceQuery && serviceCode !== (code ?? "")) score -= 3500;
  if (serviceType.includes("reference") || category.includes("reference")) score += specificReferenceQuery ? 500 : 0;

  return score;
}

export function isReferenceCard(card: Pick<RankableOperationalCard, "service_code" | "service_type" | "category">) {
  const type = `${card.service_type ?? ""} ${card.category ?? ""}`.toLowerCase();
  return card.service_code?.toUpperCase() === "MCT" || type.includes("reference") || type.includes("rule");
}

export function timingLabelForCard(card: Pick<RankableOperationalCard, "service_code" | "service_type" | "category">) {
  if (card.service_code?.toUpperCase() === "MCT") return "MCT rule";
  const type = `${card.service_type ?? ""} ${card.category ?? ""}`.toLowerCase();
  if (type.includes("reference")) return "Reference rule";
  if (type.includes("rule")) return "Timing rule";
  return "Cut-off";
}

export function readableJsonItems(value: unknown[] | null | undefined) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (typeof item === "number" || typeof item === "boolean") return String(item);
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        const text = record.label ?? record.text ?? record.value ?? record.title ?? record.description;
        return typeof text === "string" ? text.trim() : "";
      }
      return "";
    })
    .filter(Boolean);
}

export function operationalCardPreview(card: RankableOperationalCard) {
  const candidates = [
    ...readableJsonItems(card.passenger_advice).slice(0, 1),
    ...readableJsonItems(card.system_steps).slice(0, 1),
    card.summary ?? "",
    card.when_to_use ?? "",
  ];
  return plainSnippet(candidates.find((item) => item.trim()) ?? "").slice(0, 220);
}

export function compactTimingPreview(value: string, card: Pick<RankableOperationalCard, "service_code" | "service_type" | "category">, maxLines = 2) {
  const text = value.trim();
  const lines = (text.includes("\n") ? text.split(/\r?\n/) : text.includes(";") ? text.split(";") : [text])
    .map((line) => line.trim())
    .filter(Boolean);

  if (card.service_code?.toUpperCase() === "MCT") {
    const preferred = [
      combineHeadingWithNext(lines, "T2 -> T2"),
      combineHeadingWithNext(lines, "T3 -> T3"),
      combineHeadingWithNext(lines, "T2/T3 -> T1"),
    ].filter(Boolean);
    if (preferred.length) return preferred.slice(0, maxLines);
  }

  return lines.slice(0, maxLines);
}

function scoreResult(
  result: RankableSearchResult,
  normalizedQuery: string,
  code: string | null,
  topic: string | null,
  aliasPhrases: string[]
) {
  let score = result.rank ?? 0;
  const title = result.title ?? "";
  const snippet = result.snippet ?? "";
  const body = result.body_text ?? "";
  const keywords = result.search_keywords ?? [];

  if (code) {
    if (keywords.some((keyword) => tokenEquals(keyword, code))) score += 10000;
    if (hasStandaloneToken(title, code)) score += 8000;
    if (hasStandaloneToken(snippet, code)) score += 6500;
    if (hasStandaloneToken(body, code)) score += 5000;
  }

  if (keywords.some((keyword) => normalize(keyword) === normalizedQuery)) score += 4200;
  if (normalize(title) === normalizedQuery || hasStandaloneToken(title, normalizedQuery)) score += 3600;
  score += workAreaScore(result, topic, code);
  if (hasStandaloneToken(snippet, normalizedQuery)) score += 1800;
  if (hasStandaloneToken(body, normalizedQuery)) score += 800;

  for (const phrase of aliasPhrases) {
    const normalizedPhrase = normalize(phrase);
    if (!normalizedPhrase) continue;
    if (keywords.some((keyword) => normalize(keyword).includes(normalizedPhrase))) score += 1800;
    if (normalize(title).includes(normalizedPhrase)) score += 1500;
    if (normalize(snippet).includes(normalizedPhrase)) score += 900;
    if (normalize(body).includes(normalizedPhrase)) score += 400;
  }

  return score;
}

function operationalCardSearchText(card: RankableOperationalCard) {
  return normalize(
    [
      card.title,
      card.slug,
      card.service_code,
      card.service_type,
      card.category,
      card.cut_off_time,
      card.fees_charges,
      card.summary,
      card.when_to_use,
      ...(card.keywords ?? []),
      ...(card.aliases ?? []),
      ...readableJsonItems(card.channels),
      ...readableJsonItems(card.who_can_action),
      ...readableJsonItems(card.required_information),
      ...readableJsonItems(card.system_steps),
      ...readableJsonItems(card.passenger_advice),
      ...readableJsonItems(card.allowed),
      ...readableJsonItems(card.not_allowed),
      ...readableJsonItems(card.escalation_points),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function hasItems(value: unknown[] | null | undefined) {
  return readableJsonItems(value).length > 0;
}

function combineHeadingWithNext(lines: string[], heading: string) {
  const index = lines.findIndex((line) => line.toLowerCase() === heading.toLowerCase());
  if (index === -1) return "";
  const next = lines[index + 1];
  return next ? `${lines[index]} ${next}` : lines[index];
}

function workAreaScore(result: RankableSearchResult, topic: string | null, code: string | null) {
  if (!topic) return 0;
  const rule = WORK_AREA_RELEVANCE[topic];
  if (!rule) return 0;

  const title = normalize(result.title ?? "");
  const keywords = (result.search_keywords ?? []).map((keyword) => normalize(keyword)).join(" ");
  const snippet = normalize(result.snippet ?? "");
  const body = normalize(result.body_text ?? "");
  const titleAndKeywords = `${title} ${keywords}`;
  const allText = `${titleAndKeywords} ${snippet} ${body}`;
  let score = 0;

  for (const preferred of rule.preferred) {
    const normalizedPreferred = normalize(preferred);
    if (!normalizedPreferred) continue;
    if (title.includes(normalizedPreferred)) score += 5200;
    if (keywords.includes(normalizedPreferred)) score += 4600;
    if (snippet.includes(normalizedPreferred)) score += 1600;
    if (body.includes(normalizedPreferred)) score += 900;
  }

  const hasExactTopicSignal =
    (code && (hasStandaloneToken(result.title, code) || (result.search_keywords ?? []).some((keyword) => tokenEquals(keyword, code)))) ||
    titleAndKeywords.includes("minimum connection time") ||
    titleAndKeywords.includes("mct");

  if (!hasExactTopicSignal) {
    for (const avoid of rule.avoid ?? []) {
      const normalizedAvoid = normalize(avoid);
      if (!normalizedAvoid) continue;
      if (title.includes(normalizedAvoid)) score -= 4200;
      if (keywords.includes(normalizedAvoid)) score -= 3000;
    }
  }

  if (topic === "MCT" && title.includes("terminal 3")) score += 4200;
  if (topic === "MCT" && title.includes("connection")) score += 4600;
  if (topic === "MCT" && title.includes("baggage") && allText.includes("minimum connection time")) {
    score += 500;
  }

  return score;
}

function operationalCodeFromQuery(query: string) {
  const trimmed = query.trim();
  const compact = trimmed.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9]{2,6}$/.test(compact)) return null;
  if (NORMAL_SHORT_WORDS.has(compact.toLowerCase())) return null;

  const upper = compact.toUpperCase();
  if (CODE_ALIASES[upper]) return upper;
  if (compact === trimmed && trimmed === upper) return upper;
  return null;
}

function phrasesForCode(code: string) {
  return [code.toLowerCase(), ...(CODE_ALIASES[code] ?? [])].slice(0, 6);
}

function searchTopicFromQuery(query: string, code: string | null) {
  if (code && WORK_AREA_RELEVANCE[code]) return code;
  const normalized = normalize(query);
  if (normalized === "minimum connection time" || normalized.includes("minimum connection time")) {
    return "MCT";
  }
  if (normalized === "worldtracer") return "WT";
  return null;
}

function findSearchAlias(query: string) {
  const normalized = normalize(query);
  const codeAlias = CODE_ALIASES[query.trim().toUpperCase()];
  if (codeAlias) return [query.trim().toLowerCase(), ...codeAlias];

  const phraseAlias = Object.keys(SEARCH_ALIASES)
    .sort((a, b) => b.length - a.length)
    .find((alias) => normalized.includes(alias));

  return phraseAlias ? SEARCH_ALIASES[phraseAlias] : null;
}

function phraseToTsQuery(phrase: string) {
  const terms = phrase
    .split(/\s+/)
    .slice(0, MAX_SEARCH_TERMS)
    .map((term) => term.replace(/[^\w-]/g, ""))
    .filter(Boolean)
    .map((term) => `${term}:*`);

  if (terms.length === 0) return "";
  if (terms.length === 1) return terms[0];
  return `(${terms.join(" & ")})`;
}

function hasStandaloneToken(value: string, token: string) {
  const normalizedToken = normalize(token);
  if (!normalizedToken) return false;
  return tokens(value).includes(normalizedToken);
}

function tokenEquals(value: string, token: string) {
  const normalizedToken = normalize(token);
  return tokens(value).some((candidate) => candidate === normalizedToken);
}

function tokens(value: string) {
  return normalize(value).split(" ").filter(Boolean);
}

function normalize(value: string) {
  return plainSnippet(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function plainSnippet(value?: string | null) {
  return (value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
