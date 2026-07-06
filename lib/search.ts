export const MIN_SEARCH_QUERY_LENGTH = 2;
export const MAX_SEARCH_QUERY_LENGTH = 120;
const MAX_SEARCH_TERMS = 12;

const SEARCH_ALIASES: Record<string, string[]> = {
  "auto split od": ["auto split od", "fz-fz connection booking", "od split", "connection booking"],
  "auto split": ["auto split", "auto split od", "connection booking"],
  mct: ["mct", "minimum connection time", "connection time", "transfer time"],
  "minimum connection time": ["minimum connection time", "connection time", "transfer time"],
  "dubai stopover": ["dubai stopover", "dso", "stopover"],
  dso: ["dso", "dubai stopover", "stopover"],
  "lounge access during olci": ["lounge access", "olci lounge", "online check-in lounge"],
  "lounge access": ["lounge access", "olci lounge"],
  "olci lounge": ["olci lounge", "online check-in lounge", "lounge access"],
  speq: ["speq", "sporting equipment", "sports equipment", "weapon"],
  "sporting equipment": ["sporting equipment", "speq", "sports equipment", "weapon"],
  "sports equipment": ["sports equipment", "sporting equipment", "speq"],
  "falcon handling": ["falcon handling", "falcon", "birds", "animal carriage"],
  falcon: ["falcon", "falcon handling", "birds"],
  birds: ["birds", "falcon", "animal carriage"],
  exst: ["exst", "extra seat"],
  cbbg: ["cbbg", "cabin baggage", "cabin baggage seat"],
  "extra seat": ["extra seat", "exst", "cbbg"],
  "baggage upgrade": ["baggage upgrade", "excess baggage"],
  fdis: ["fdis", "flight disruption", "schedule change", "cancellation"],
  "flight disruption": ["flight disruption", "schedule change", "cancellation"],
  olci: ["olci", "online check-in", "online checkin"],
  "online checkin": ["online checkin", "online check-in", "olci"],
  interline: ["interline", "connection", "transfer", "ek", "oal"],
  wheelchair: ["wheelchair", "wchr", "wchs", "wchc"],
  wchr: ["wchr", "wheelchair"],
  wchs: ["wchs", "wheelchair"],
  wchc: ["wchc", "wheelchair"],
  "name correction": ["name correction", "name change", "ncfb", "ncfe"],
  "name change": ["name change", "name correction"],
  ncfb: ["ncfb", "name correction"],
  ncfe: ["ncfe", "name correction"],
  "government deals": ["government deals", "esaad", "alsaada", "gdrfa", "immigration deal"],
  esaad: ["esaad", "government deals"],
  alsaada: ["alsaada", "government deals"],
  gdrfa: ["gdrfa", "immigration deal", "government deals"],
  payment: ["payment", "payment failure", "cchk", "card verification"],
  cchk: ["cchk", "card verification"],
  viok: ["viok", "visa ok"],
  oktb: ["oktb", "ok to board"],
  visa: ["visa", "visa change", "tourist visa"],
  meda: ["meda", "medical"],
  dpna: ["dpna", "disabled passenger"],
  oxygen: ["oxygen", "o2", "cpap"],
  o2: ["o2", "oxygen"],
  cpap: ["cpap", "oxygen"],
  "service animal": ["service animal", "svan", "guide dog"],
  svan: ["svan", "service animal"],
  bag: ["baggage"],
  bags: ["baggage"],
  brb: ["brb", "blue ribbon bags", "baggage"],
  wt: ["wt", "worldtracer"],
  worldtracer: ["worldtracer", "delayed baggage", "damaged baggage", "lost baggage"],
  "world-tracer": ["worldtracer"],
  world: ["worldtracer"],
  tracer: ["worldtracer"],
  "business lounge": ["business lounge", "t2 lounge", "lngl"],
  lngl: ["lngl", "business lounge"],
  "meet and assist": ["meet and assist", "masd"],
  masd: ["masd", "meet and assist"],
  "staff tickets": ["staff tickets", "id50", "id90", "staff travel"],
  id50: ["id50", "staff tickets"],
  id90: ["id90", "staff tickets"],
  "special meals": ["special meals", "spml", "avml", "chml", "vgml"],
  spml: ["spml", "special meals"],
  avml: ["avml", "special meals"],
  chml: ["chml", "special meals"],
  vgml: ["vgml", "special meals"],
  ssr: ["ssr", "special request", "cake", "flower", "fruit basket"],
  dcs: ["dcs", "check-in"],
  sprint: ["sprint", "booking system"],
  skywards: ["skywards", "miles", "frequent flyer"],
  salesforce: ["salesforce", "case classification"],
  ticket: ["e-ticketing"],
  tickets: ["e-ticketing"],
};

export function buildSearchTerms(query: string) {
  const trimmed = query.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
  if (trimmed.length < MIN_SEARCH_QUERY_LENGTH) return "";

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

function findSearchAlias(query: string) {
  const normalized = query.toLowerCase().replace(/\s+/g, " ").trim();
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

export function plainSnippet(value?: string | null) {
  return (value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
