// UPD-2.1: versioned extraction contract.
//
// The single schema shared by tools/extraction/extract.py, the background
// worker and the tests. Extractor output is validated against this BEFORE any
// staged row is written, so malformed output can never reach the database.
// Pure, dependency-free, no AI.

export const CONTRACT_EXTRACTOR_VERSION = "upd2-1";
export const MAX_CONTRACT_PAGES = 500;
export const MAX_CONTRACT_CHAPTERS = 400;

export type ExtractedSource = {
  title: string | null;
  version: string | null;
  versionDate: string | null;
  pageCount: number;
  sha256: string;
};

export type ExtractedSourceLink = {
  type: string;
  page: number;
  label: string;
};

export type ExtractedChapterContract = {
  chapterNumber: string;
  title: string;
  slug: string;
  pageStart: number;
  pageEnd: number;
  body: string;
  contentBlocks: unknown[];
  searchKeywords: string[];
  sourceLinks: ExtractedSourceLink[];
};

export type ExtractionContract = {
  extractorVersion: string;
  source: ExtractedSource;
  chapters: ExtractedChapterContract[];
};

export type ContractValidation =
  | { ok: true; value: ExtractionContract }
  | { ok: false; errorCode: string; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function bad(errorCode: string, error: string): ContractValidation {
  return { ok: false, errorCode, error };
}

/**
 * Validate raw extractor output. Rejects anything structurally malformed —
 * the worker fails the run with INVALID_EXTRACTOR_OUTPUT rather than staging
 * partial or corrupt chapters.
 */
export function validateExtractionContract(raw: unknown): ContractValidation {
  if (!isRecord(raw)) return bad("INVALID_EXTRACTOR_OUTPUT", "Extractor output is not an object.");

  if (typeof raw.extractorVersion !== "string" || !raw.extractorVersion.trim()) {
    return bad("INVALID_EXTRACTOR_OUTPUT", "Missing extractorVersion.");
  }

  if (!isRecord(raw.source)) return bad("INVALID_EXTRACTOR_OUTPUT", "Missing source metadata.");
  const src = raw.source;
  const pageCount = typeof src.pageCount === "number" ? src.pageCount : NaN;
  const sha256 = typeof src.sha256 === "string" ? src.sha256.toLowerCase() : "";

  if (!Number.isInteger(pageCount) || pageCount <= 0 || pageCount > MAX_CONTRACT_PAGES) {
    return bad("INVALID_PAGE_COUNT", `Page count must be 1-${MAX_CONTRACT_PAGES}.`);
  }
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    return bad("INVALID_SHA256", "Source sha256 is missing or malformed.");
  }
  if (src.version !== null && typeof src.version !== "string") {
    return bad("INVALID_VERSION", "Source version must be a string or null.");
  }
  if (typeof src.version === "string" && !/^\d+\.\d+$/.test(src.version)) {
    return bad("INVALID_VERSION", "Source version must look like 81.7.");
  }
  if (
    src.versionDate !== null &&
    (typeof src.versionDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(src.versionDate))
  ) {
    return bad("INVALID_VERSION_DATE", "Source versionDate must be ISO yyyy-mm-dd or null.");
  }

  if (!Array.isArray(raw.chapters) || raw.chapters.length === 0) {
    return bad("NO_CHAPTERS", "Extractor produced no chapters.");
  }
  if (raw.chapters.length > MAX_CONTRACT_CHAPTERS) {
    return bad("TOO_MANY_CHAPTERS", `More than ${MAX_CONTRACT_CHAPTERS} chapters.`);
  }

  const chapters: ExtractedChapterContract[] = [];
  const seenSlugs = new Set<string>();

  for (const [index, entry] of raw.chapters.entries()) {
    if (!isRecord(entry)) return bad("INVALID_CHAPTER", `Chapter ${index} is not an object.`);

    const title = typeof entry.title === "string" ? entry.title.trim() : "";
    const slug = typeof entry.slug === "string" ? entry.slug.trim() : "";
    const chapterNumber =
      typeof entry.chapterNumber === "string"
        ? entry.chapterNumber.trim()
        : typeof entry.chapterNumber === "number"
          ? String(entry.chapterNumber)
          : "";
    const pageStart = typeof entry.pageStart === "number" ? entry.pageStart : NaN;
    const pageEnd = typeof entry.pageEnd === "number" ? entry.pageEnd : NaN;
    const body = typeof entry.body === "string" ? entry.body : "";

    if (!title) return bad("INVALID_CHAPTER", `Chapter ${index} has no title.`);
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      return bad("INVALID_CHAPTER", `Chapter ${index} has an invalid slug.`);
    }
    if (seenSlugs.has(slug)) return bad("DUPLICATE_SLUG", `Duplicate chapter slug "${slug}".`);
    seenSlugs.add(slug);

    if (!Number.isInteger(pageStart) || pageStart < 1 || pageStart > pageCount) {
      return bad("INVALID_PAGE_RANGE", `Chapter ${index} has an out-of-range pageStart.`);
    }
    if (!Number.isInteger(pageEnd) || pageEnd < pageStart || pageEnd > pageCount) {
      return bad("INVALID_PAGE_RANGE", `Chapter ${index} has an invalid pageEnd.`);
    }
    if (!body.trim()) return bad("EMPTY_CHAPTER_BODY", `Chapter ${index} has an empty body.`);

    chapters.push({
      chapterNumber,
      title,
      slug,
      pageStart,
      pageEnd,
      body,
      contentBlocks: Array.isArray(entry.contentBlocks) ? entry.contentBlocks : [],
      searchKeywords: Array.isArray(entry.searchKeywords)
        ? entry.searchKeywords.filter((k): k is string => typeof k === "string")
        : [],
      sourceLinks: Array.isArray(entry.sourceLinks)
        ? (entry.sourceLinks.filter(
            (l) => isRecord(l) && typeof l.page === "number" && typeof l.label === "string"
          ) as ExtractedSourceLink[])
        : [],
    });
  }

  return {
    ok: true,
    value: {
      extractorVersion: raw.extractorVersion,
      source: {
        title: typeof src.title === "string" ? src.title : null,
        version: typeof src.version === "string" ? src.version : null,
        versionDate: typeof src.versionDate === "string" ? src.versionDate : null,
        pageCount,
        sha256,
      },
      chapters,
    },
  };
}

/** Numeric version comparison: -1 | 0 | 1. */
export function compareManualVersions(a: string | null, b: string | null): number {
  const pa = String(a ?? "").split(".").map(Number);
  const pb = String(b ?? "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

export type VersionGateInput = {
  incomingVersion: string | null;
  incomingSha256: string;
  currentVersion: string | null;
  knownSha256: string[];
  overrideReason: string | null;
};

export type VersionGate = { allowed: true } | { allowed: false; errorCode: string; error: string };

/**
 * Duplicate / older-version policy. An owner may override any rejection, but
 * only with an explicit reason (audited on the run row). Overriding never
 * publishes anything.
 */
export function evaluateVersionGate(input: VersionGateInput): VersionGate {
  const { incomingVersion, incomingSha256, currentVersion, knownSha256, overrideReason } = input;
  const override = Boolean(overrideReason && overrideReason.trim().length > 0);

  if (knownSha256.map((h) => h.toLowerCase()).includes(incomingSha256.toLowerCase())) {
    if (override) return { allowed: true };
    return { allowed: false, errorCode: "DUPLICATE_PDF", error: "This exact PDF has already been processed." };
  }

  if (!incomingVersion) {
    if (override) return { allowed: true };
    return { allowed: false, errorCode: "VERSION_NOT_DETECTED", error: "Could not read the manual version." };
  }

  if (currentVersion) {
    const cmp = compareManualVersions(incomingVersion, currentVersion);
    if (cmp < 0 && !override) {
      return {
        allowed: false,
        errorCode: "OLDER_VERSION",
        error: `Uploaded manual (${incomingVersion}) is older than production (${currentVersion}).`,
      };
    }
    // Same version, different content — a silent re-cut of the manual.
    if (cmp === 0 && !override) {
      return {
        allowed: false,
        errorCode: "SAME_VERSION_DIFFERENT_CONTENT",
        error: `Version ${incomingVersion} is already published with different content.`,
      };
    }
  }

  return { allowed: true };
}
