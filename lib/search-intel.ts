// ============================================================
// GO TO V3 search intelligence layer.
// Pipeline: normalize -> spell-correct -> expand (airports,
// operational concepts) -> hand weighted phrases to the ranker.
// Pure query-side processing: it never invents content and never
// changes card visibility rules.
// ============================================================

export type QueryResolution = {
  /** Query after spell correction (or the original if unchanged). */
  query: string;
  corrected: boolean;
  corrections: { from: string; to: string }[];
  /** Extra weighted phrases with human-readable reasons. */
  expansions: { term: string; reason: string }[];
};

// Airport / city vocabulary (search hints only). MCT is intentionally
// excluded: in this product MCT means minimum connection time.
const AIRPORTS: Record<string, string[]> = {
  dxb: ["dubai", "terminal"],
  dwc: ["dubai world central", "al maktoum"],
  auh: ["abu dhabi"],
  shj: ["sharjah"],
  znz: ["zanzibar"],
  dar: ["dar es salaam"],
  jro: ["kilimanjaro"],
  krt: ["khartoum"],
  cmb: ["colombo"],
  mle: ["male", "maldives"],
  kbv: ["krabi"],
  rgn: ["yangon"],
  ist: ["istanbul"],
  bey: ["beirut"],
  cai: ["cairo"],
  ruh: ["riyadh"],
  jed: ["jeddah"],
  del: ["delhi"],
  bom: ["mumbai"],
  khi: ["karachi"],
};

// Operational concept graph: token -> related operational phrases.
const CONCEPTS: Record<string, string[]> = {
  wheelchair: ["wchr", "special assistance"],
  pregnant: ["pregnancy", "medical"],
  pregnancy: ["medical certificate"],
  medical: ["meda"],
  bag: ["baggage"],
  bags: ["baggage"],
  baggage: ["excess baggage", "baggage upgrade"],
  infant: ["baby", "seat"],
  refund: ["voucher"],
  voucher: ["refund"],
  disruption: ["fdis", "schedule change"],
  delay: ["flight disruption"],
  cancelled: ["flight disruption", "fdis"],
  canceled: ["flight disruption", "fdis"],
  stopover: ["dubai stopover", "dso"],
  lounge: ["lngl", "olci"],
  visa: ["oktb", "travel documents"],
  connection: ["mct", "transfer"],
  transfer: ["mct", "connection"],
  minor: ["unaccompanied", "age"],
  falcon: ["animal carriage"],
  pet: ["petc", "animal"],
  dog: ["service animal", "petc"],
};

// Vocabulary for typo correction, built once.
const BASE_VOCABULARY = [
  "wheelchair", "baggage", "passenger", "pregnancy", "pregnant", "medical",
  "connection", "transfer", "terminal", "voucher", "refund", "payment",
  "insurance", "lounge", "stopover", "disruption", "schedule", "cancellation",
  "correction", "assignment", "equipment", "sporting", "falcon", "animal",
  "infant", "minor", "unaccompanied", "escalation", "supervisor", "deadline",
  "checkin", "check-in", "boarding", "interline", "codeshare", "government",
  "skywards", "salesforce", "sprint", "worldtracer", "delayed", "damaged",
  "oxygen", "certificate", "documents", "emergency", "restriction", "seat",
  "seats", "extra", "flight", "booking", "name", "change", "fare", "fares",
  "staff", "ticket", "tickets", "meal", "meals", "visa", "board", "service",
  "services", "advice", "allowed", "charges", "fees", "cutoff", "olci",
  "wchr", "wchs", "wchc", "meda", "dpna", "exst", "cbbg", "speq", "fdis",
  "oktb", "petc", "svan", "spml", "lngl", "mct", "dso", "xbag", "avih",
];

const VOCAB_SET = new Set(BASE_VOCABULARY);

export function resolveOperationalQuery(raw: string): QueryResolution {
  const normalized = raw.trim().toLowerCase();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const corrections: { from: string; to: string }[] = [];
  const expansions: { term: string; reason: string }[] = [];

  const correctedTokens = tokens.map((token) => {
    const clean = token.replace(/[^a-z0-9-]/g, "");
    if (!clean || clean.length < 4 || VOCAB_SET.has(clean) || /\d/.test(clean)) return token;

    const correction = closestVocabularyWord(clean);
    if (correction && correction !== clean) {
      corrections.push({ from: clean, to: correction });
      return correction;
    }
    return token;
  });

  const query = corrections.length > 0 ? correctedTokens.join(" ") : raw.trim();

  for (const token of correctedTokens) {
    const clean = token.replace(/[^a-z0-9-]/g, "");
    const stem = stemToken(clean);

    const airport = AIRPORTS[clean];
    if (airport) {
      for (const term of airport) expansions.push({ term, reason: `Airport ${clean.toUpperCase()}` });
      continue;
    }

    const related = CONCEPTS[clean] ?? CONCEPTS[stem];
    if (related) {
      for (const term of related) expansions.push({ term, reason: `Related to "${clean}"` });
    }
  }

  return {
    query,
    corrected: corrections.length > 0,
    corrections,
    expansions: dedupeExpansions(expansions).slice(0, 6),
  };
}

function dedupeExpansions(items: { term: string; reason: string }[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.term)) return false;
    seen.add(item.term);
    return true;
  });
}

// Light stemming: plural/participle suffixes only.
export function stemToken(token: string) {
  if (token.length <= 4) return token;
  if (token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.endsWith("ing") && token.length > 6) return token.slice(0, -3);
  if (token.endsWith("es") && token.length > 5) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

function closestVocabularyWord(token: string): string | null {
  const maxDistance = token.length >= 7 ? 2 : 1;
  let best: string | null = null;
  let bestDistance = maxDistance + 1;

  for (const word of BASE_VOCABULARY) {
    if (Math.abs(word.length - token.length) > maxDistance) continue;
    const distance = damerauLevenshtein(token, word, maxDistance);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = word;
      if (distance === 1) break;
    }
  }

  return bestDistance <= maxDistance ? best : null;
}

// Bounded Damerau-Levenshtein (transposition-aware).
function damerauLevenshtein(a: string, b: string, cap: number) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i++) d[i][0] = i;
  for (let j = 0; j < cols; j++) d[0][j] = j;

  for (let i = 1; i < rows; i++) {
    let rowMin = Infinity;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > cap) return cap + 1;
  }

  return d[rows - 1][cols - 1];
}
