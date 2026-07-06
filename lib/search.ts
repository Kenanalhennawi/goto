export const MIN_SEARCH_QUERY_LENGTH = 2;
export const MAX_SEARCH_QUERY_LENGTH = 120;
const MAX_SEARCH_TERMS = 12;
const SEARCH_ALIASES: Record<string, string> = {
  "auto split od": "auto split od fz-fz connection booking",
  "auto split": "auto split od connection booking",
  mct: "minimum connection time",
  "minimum connection time": "minimum connection time transfer",
  "dubai stopover": "dubai stopover dso",
  dso: "dubai stopover",
  "lounge access during olci": "lounge access olci online check-in",
  "lounge access": "lounge access olci",
  "olci lounge": "lounge access online check-in",
  speq: "sporting equipment",
  "sporting equipment": "sporting equipment speq weapon",
  "sports equipment": "sporting equipment speq",
  "falcon handling": "falcon birds animal carriage",
  falcon: "falcon birds cabin",
  birds: "falcon birds animal carriage",
  exst: "extra seat",
  cbbg: "cabin baggage seat",
  "extra seat": "extra seat exst cbbg",
  "baggage upgrade": "baggage upgrade excess baggage",
  fdis: "flight disruption",
  "flight disruption": "flight disruption schedule change cancellation",
  olci: "online check-in",
  "online checkin": "online check-in",
  interline: "interline connection transfer ek oal",
  wheelchair: "wheelchair wchr wchs wchc",
  wchr: "wheelchair",
  wchs: "wheelchair",
  wchc: "wheelchair",
  "name correction": "name correction name change ncfb ncfe",
  "name change": "name correction",
  ncfb: "name correction",
  ncfe: "name correction",
  "government deals": "government deals esaad alsaada gdrfa immigration",
  esaad: "government deals",
  alsaada: "government deals",
  gdrfa: "government deals immigration",
  payment: "payment failure cchk card verification",
  cchk: "card verification",
  viok: "visa ok",
  oktb: "ok to board",
  visa: "visa change tourist visa",
  meda: "medical",
  dpna: "disabled passenger",
  oxygen: "oxygen o2 cpap",
  o2: "oxygen",
  cpap: "oxygen cpap",
  "service animal": "service animal svan dog guide dog",
  svan: "service animal",
  bag: "baggage",
  bags: "baggage",
  brb: "blue ribbon bags baggage",
  wt: "worldtracer",
  worldtracer: "worldtracer delayed baggage damaged baggage lost baggage",
  "world-tracer": "worldtracer",
  world: "worldtracer",
  tracer: "worldtracer",
  "business lounge": "business lounge t2 lounge lngl",
  lngl: "business lounge",
  "meet and assist": "meet and assist masd",
  masd: "meet and assist",
  "staff tickets": "staff tickets id50 id90 staff travel",
  id50: "staff tickets",
  id90: "staff tickets",
  "special meals": "special meals spml avml chml vgml",
  spml: "special meals",
  avml: "special meals",
  chml: "special meals",
  vgml: "special meals",
  ssr: "special request cake flower fruit basket",
  dcs: "check-in",
  sprint: "booking system",
  skywards: "skywards miles frequent flyer",
  salesforce: "salesforce case classification",
  ticket: "e-ticketing",
  tickets: "e-ticketing",
};

export function buildSearchTerms(query: string) {
  const trimmed = query.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
  if (trimmed.length < MIN_SEARCH_QUERY_LENGTH) return "";

  const expanded = expandSearchAliases(trimmed);
  const operator = expanded.toLowerCase() === trimmed.toLowerCase() ? " & " : " | ";

  return expanded
    .split(/\s+/)
    .slice(0, MAX_SEARCH_TERMS)
    .map((term) => term.replace(/[^\w-]/g, ""))
    .filter(Boolean)
    .map((term) => `${term}:*`)
    .join(operator);
}

function expandSearchAliases(query: string) {
  const normalized = query.toLowerCase().replace(/\s+/g, " ").trim();
  const phraseAlias = Object.keys(SEARCH_ALIASES)
    .sort((a, b) => b.length - a.length)
    .find((alias) => normalized.includes(alias));

  if (phraseAlias) {
    return SEARCH_ALIASES[phraseAlias];
  }

  return query
    .split(/\s+/)
    .map((term) => SEARCH_ALIASES[term.toLowerCase()] ?? term)
    .join(" ");
}

export function plainSnippet(value?: string | null) {
  return (value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
