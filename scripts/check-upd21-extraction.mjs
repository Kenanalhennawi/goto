// UPD-2.1 — extraction + staging pipeline checks.
// Run with: node scripts/check-upd21-extraction.mjs
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));

const { validateExtractionContract, evaluateVersionGate, compareManualVersions, CONTRACT_EXTRACTOR_VERSION } =
  await import("../lib/extraction-contract.ts");
const { classifyExtraction, isAutoApprovable } = await import("../lib/sync-diff.ts");
const { buildImpactReport } = await import("../lib/sync-impact.ts");
const { archivedPdfPath, EXTRACTOR_VERSION } = await import("../lib/sync-upload.ts");

const worker = read("worker/index.mjs");
const dockerfile = read("worker/Dockerfile");
const extractPy = read("tools/extraction/extract.py");
const attachPy = read("tools/extraction/attach_pdf_links.py");
const retryRoute = read("app/api/sync/[id]/retry/route.ts");
const reviewPage = read("app/admin/sync/[id]/page.tsx");
const summaryUi = read("components/admin/SyncRunSummary.tsx");
const reviewClient = read("components/SyncReviewClient.tsx");

// ===========================================================================
// 1. Extraction tools are in the repository and portable
// ===========================================================================
for (const f of [
  "tools/extraction/extract.py",
  "tools/extraction/attach_pdf_links.py",
  "tools/extraction/requirements.txt",
  "tools/extraction/README.md",
]) {
  assert.ok(exists(f), `${f} must be tracked in the repository`);
}
for (const [name, src] of [["extract.py", extractPy], ["attach_pdf_links.py", attachPy]]) {
  // Inspect CODE only — docstrings legitimately say "Never shell=True".
  const code = src
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return t && !t.startsWith("#") && !t.startsWith('"""') && !t.includes("Never shell=True");
    })
    .join("\n");
  assert.ok(!/C:\\\\|c:\\\\/i.test(code), `${name} must not contain Windows paths`);
  assert.ok(!/goto-manual-project/.test(code), `${name} must not reference the obsolete project root`);
  assert.ok(/sys\.argv/.test(code), `${name} must take paths as CLI arguments`);
  assert.ok(!/shell\s*=\s*True/.test(code), `${name} must never use shell=True`);
  assert.ok(/subprocess\.run\(\s*cmd/.test(code), `${name} must pass an argument array`);
}
assert.ok(extractPy.includes(`EXTRACTOR_VERSION = "${CONTRACT_EXTRACTOR_VERSION}"`), "extractor version must match the contract");
assert.equal(EXTRACTOR_VERSION, CONTRACT_EXTRACTOR_VERSION, "upload + contract versions must agree");

// ===========================================================================
// 2. Extraction contract validation
// ===========================================================================
const validChapter = {
  chapterNumber: "29",
  title: "29. Firearms and Carry of Ammunition",
  slug: "29-firearms-and-carry-of-ammunition",
  pageStart: 130,
  pageEnd: 132,
  body: "flydubai is accepting firearms and ammunition at a charge of AED 300 per passenger.",
  contentBlocks: [],
  searchKeywords: ["Firearm", "Ammunition"],
  sourceLinks: [{ type: "page", page: 130, label: "Page 130" }],
};
const validContract = {
  extractorVersion: "upd2-1",
  source: { title: "GO TO", version: "81.7", versionDate: "2026-07-30", pageCount: 356, sha256: "a".repeat(64) },
  chapters: [validChapter],
};
assert.equal(validateExtractionContract(validContract).ok, true, "a valid contract must pass");

const MALFORMED = [
  [null, "INVALID_EXTRACTOR_OUTPUT"],
  [{ ...validContract, extractorVersion: "" }, "INVALID_EXTRACTOR_OUTPUT"],
  [{ ...validContract, source: { ...validContract.source, sha256: "nope" } }, "INVALID_SHA256"],
  [{ ...validContract, source: { ...validContract.source, pageCount: 0 } }, "INVALID_PAGE_COUNT"],
  [{ ...validContract, source: { ...validContract.source, pageCount: 9999 } }, "INVALID_PAGE_COUNT"],
  [{ ...validContract, source: { ...validContract.source, version: "eighty" } }, "INVALID_VERSION"],
  [{ ...validContract, source: { ...validContract.source, versionDate: "30-Jul-2026" } }, "INVALID_VERSION_DATE"],
  [{ ...validContract, chapters: [] }, "NO_CHAPTERS"],
  [{ ...validContract, chapters: [{ ...validChapter, slug: "Bad Slug!" }] }, "INVALID_CHAPTER"],
  [{ ...validContract, chapters: [{ ...validChapter, body: "   " }] }, "EMPTY_CHAPTER_BODY"],
  [{ ...validContract, chapters: [{ ...validChapter, pageStart: 400 }] }, "INVALID_PAGE_RANGE"],
  [{ ...validContract, chapters: [{ ...validChapter, pageEnd: 129 }] }, "INVALID_PAGE_RANGE"],
  [{ ...validContract, chapters: [validChapter, validChapter] }, "DUPLICATE_SLUG"],
];
for (const [payload, code] of MALFORMED) {
  const res = validateExtractionContract(payload);
  assert.equal(res.ok, false, `${code} must be rejected`);
  assert.equal(res.errorCode, code, `expected ${code}, got ${res.errorCode}`);
}

// ===========================================================================
// 3. Version / duplicate gate
// ===========================================================================
assert.equal(compareManualVersions("81.7", "81.2"), 1);
assert.equal(compareManualVersions("81.2", "81.7"), -1);
assert.equal(compareManualVersions("81.7", "81.7"), 0);

const gate = (over) =>
  evaluateVersionGate({
    incomingVersion: "81.2",
    incomingSha256: "b".repeat(64),
    currentVersion: "81.7",
    knownSha256: [],
    overrideReason: over,
  });
assert.equal(gate(null).allowed, false, "older version must be rejected");
assert.equal(gate(null).errorCode, "OLDER_VERSION");
assert.equal(gate("Owner approved re-issue").allowed, true, "audited owner override permits it");

const dup = evaluateVersionGate({
  incomingVersion: "81.7",
  incomingSha256: "c".repeat(64),
  currentVersion: "81.7",
  knownSha256: ["C".repeat(64)],
  overrideReason: null,
});
assert.equal(dup.allowed, false, "duplicate sha256 must be rejected");
assert.equal(dup.errorCode, "DUPLICATE_PDF");

const sameVersionDifferentHash = evaluateVersionGate({
  incomingVersion: "81.7",
  incomingSha256: "d".repeat(64),
  currentVersion: "81.7",
  knownSha256: ["e".repeat(64)],
  overrideReason: null,
});
assert.equal(sameVersionDifferentHash.allowed, false);
assert.equal(sameVersionDifferentHash.errorCode, "SAME_VERSION_DIFFERENT_CONTENT");

assert.equal(
  evaluateVersionGate({ incomingVersion: null, incomingSha256: "f".repeat(64), currentVersion: "81.7", knownSha256: [], overrideReason: null }).errorCode,
  "VERSION_NOT_DETECTED"
);

// ===========================================================================
// 4. Worker safety + pipeline wiring
// ===========================================================================
assert.ok(worker.includes("execFile"), "worker must use execFile, not exec");
assert.ok(!/\bexec\(|execSync\(/.test(worker), "worker must not use shell execution");
assert.ok(/shell:\s*false/.test(worker), "worker must disable shell explicitly");
assert.ok(/timeout:\s*EXTRACT_TIMEOUT_MS/.test(worker), "extraction must have a timeout");
assert.ok(/maxBuffer:\s*MAX_OUTPUT_BYTES/.test(worker), "stdout/stderr must be bounded");
assert.ok(worker.includes("mkdtemp"), "worker must use a safe temp directory");
assert.ok(/finally\s*\{[\s\S]{0,160}rm\(workDir/.test(worker), "temp directory must always be cleaned");
assert.ok(worker.includes("validateExtractionContract"), "extractor output must be validated");
assert.ok(worker.includes("evaluateVersionGate"), "version/duplicate gate must run");
assert.ok(worker.includes("classifyExtraction"), "worker must classify chapters");
assert.ok(worker.includes("buildImpactReport"), "worker must build the impact report");
assert.ok(worker.includes("sync_staged_changes"), "worker must write staged rows");
assert.ok(worker.includes("sync_impact_report"), "worker must persist the impact report");
assert.ok(worker.includes("rekeyPdf"), "worker must re-key the PDF canonically");
assert.ok(worker.includes("createHash(\"sha256\")"), "worker must recompute the hash authoritatively");
assert.ok(worker.includes("isAutoApprovable"), "approval defaults must use the safe-class helper");
// Never mutates operational content.
assert.ok(!/from\("procedure_cards"\)[\s\S]{0,120}\.(update|insert|upsert|delete)\(/.test(worker), "worker must not mutate procedure cards");
assert.ok(!/publish_sync_chapters/.test(worker), "worker must never publish chapters");
assert.ok(!/is_published/.test(worker.replace(/select\([^)]*\)/g, "")), "worker must not set is_published");
assert.ok(!/review_status:\s*/.test(worker), "worker must not set review_status");
// Safe failure surface.
assert.ok(worker.includes("error_detail"), "failures must record a safe detail");
assert.ok(/String\(error\?\?\s*""\)\.slice|String\(detail \?\? ""\)\.slice|\.slice\(0, 300\)/.test(worker), "error detail must be truncated");
assert.ok(!/error\.stack/.test(worker), "stack traces must never be persisted");
// State transitions and progress bounds.
for (const state of ["validating", "extracting", "staged", "failed"]) {
  assert.ok(worker.includes(`"${state}"`), `worker must set state ${state}`);
}
assert.ok(/Math\.max\(0, Math\.min\(100/.test(worker), "progress must be clamped 0-100");
assert.ok(worker.includes("claim_sync_run"), "worker must claim concurrency-safely");

// ===========================================================================
// 5. Docker / deployment
// ===========================================================================
assert.ok(exists("worker/Dockerfile"), "worker Dockerfile required");
assert.ok(exists("worker/package.json"), "worker package.json required");
for (const dep of ["python3", "poppler-utils"]) {
  assert.ok(dockerfile.includes(dep), `image must install ${dep}`);
}
assert.ok(dockerfile.includes("COPY tools/extraction"), "image must include the extraction tools");
// The key must never be baked in via ENV/ARG (a comment showing `docker run -e`
// usage is documentation, not a secret).
const dockerDirectives = dockerfile
  .split("\n")
  .filter((l) => /^\s*(ENV|ARG)\b/i.test(l))
  .join("\n");
assert.ok(!/SERVICE_ROLE/i.test(dockerDirectives), "image must not bake in the service key");
assert.ok(!/eyJ[A-Za-z0-9_-]{20,}/.test(dockerfile), "image must not embed a JWT");
assert.ok(dockerfile.includes("USER node"), "worker should not run as root");

// ===========================================================================
// 6. Classification + approval defaults (end-to-end shapes)
// ===========================================================================
const live = [
  { id: "c1", slug: "ch-a", title: "34. Wheelchair", chapter_number: 34, body_text: "WCHR text.", keywords: ["wchr"], page_start: 165, page_end: 170, source_version: "81.2" },
  { id: "c2", slug: "ch-b", title: "50. Retired", chapter_number: 50, body_text: "Old.", keywords: [], page_start: 280, page_end: 280, source_version: "81.2" },
];
const diffs = classifyExtraction(
  [
    // numeric prefix renumber + page shift, identical body -> metadata_only
    { title: "35. Wheelchair", slug: "ch-a", chapter_number: 35, body_text: "WCHR text.", keywords: ["wchr"], page_start: 164, page_end: 169, source_version: "81.7" },
    // brand-new chapter inserted in the middle
    { title: "34. Accessibility", slug: "ch-new", chapter_number: 34, body_text: "New guidance.", keywords: [], page_start: 163, page_end: 163, source_version: "81.7" },
  ],
  live,
  "81.7"
);
const byClass = Object.fromEntries(diffs.map((d) => [d.slug, d.changeClass]));
assert.equal(byClass["ch-a"], "metadata_only", "numeric prefix renumber is metadata-only");
assert.equal(byClass["ch-new"], "new", "inserted chapter is new");
assert.equal(byClass["ch-b"], "removed", "absent chapter is removed");
// Inserted middle chapter must not misclassify the shifted one.
assert.notEqual(byClass["ch-a"], "content_changed");

assert.equal(isAutoApprovable("unchanged"), true);
assert.equal(isAutoApprovable("metadata_only"), true);
for (const c of ["content_changed", "new", "removed", "renamed_moved"]) {
  assert.equal(isAutoApprovable(c), false, `${c} must never default to approved`);
}

// Impact rows are produced and never mutate their inputs.
const cards = [{ slug: "wheelchair", title: "Wheelchair", chapter_id: "c1", source_version: "81.2", review_status: "approved", is_published: true }];
const workflows = [{ slug: "wheelchair", title: "Wheelchair", sourceVersion: "81.7 (30-Jul-2026)", sourcePages: [164] }];
const impact = buildImpactReport({ diffs, cards, workflows, targetVersion: "81.7" });
assert.ok(impact.length > 0, "impact rows must be produced");
assert.ok(impact.some((i) => i.impactType === "workflow"), "workflow impact must be reported");
assert.ok(impact.some((i) => i.impactType === "chapter" && i.status === "blocked"), "removed chapter blocks");
assert.equal(cards[0].review_status, "approved", "impact analysis must not mutate cards");

// ===========================================================================
// 7. Canonical storage path
// ===========================================================================
assert.equal(archivedPdfPath("81.7", "a".repeat(64)), `v81.7/${"a".repeat(64)}.pdf`);
assert.ok(!archivedPdfPath("../x", "b".repeat(64)).includes(".."), "canonical path must be sanitised");

// ===========================================================================
// 8. Retry endpoint
// ===========================================================================
assert.ok(retryRoute.includes("requireAdmin"), "retry must be admin-guarded");
assert.ok(retryRoute.includes("retry_of_run_id"), "retry must link the original run");
assert.ok(retryRoute.includes('state: "queued"'), "retry must queue a new run");
assert.ok(retryRoute.includes("RUN_NOT_RETRYABLE"), "only failed/cancelled runs may retry");
assert.ok(!/\.update\(/.test(retryRoute), "retry must not overwrite the failed run");
// The retry route must not run or accept any worker command/argument. (The
// word "command" appears only in the explanatory comment.)
const retryCode = retryRoute
  .split("\n")
  .filter((l) => !l.trim().startsWith("//"))
  .join("\n");
assert.ok(!/spawn|execFile|exec\(|child_process/i.test(retryCode), "retry must not execute processes");
assert.ok(!/body\.(command|args|argv|script)/i.test(retryCode), "retry must not accept worker arguments");

// ===========================================================================
// 9. Review UI
// ===========================================================================
assert.ok(reviewPage.includes("sync_impact_report"), "review page must load the impact report");
assert.ok(reviewPage.includes("change_class"), "review page must load classifications");
assert.ok(reviewPage.includes("SyncRunSummary"), "summary panel must be rendered");
for (const label of ["Unchanged", "Metadata only", "Content changed", "New", "Removed", "Renamed / moved"]) {
  assert.ok(summaryUi.includes(label), `classification label '${label}' must be shown`);
}
assert.ok(summaryUi.includes("pdf_sha256"), "sha256 must be displayed");
assert.ok(summaryUi.includes("extractor_version"), "extractor version must be displayed");
assert.ok(/deleted automatically/.test(summaryUi), "removed-chapter warning required");
assert.ok(/explicit owner confirmation/.test(summaryUi), "removed chapters must require owner confirmation");
assert.ok(summaryUi.includes("Retry this run"), "retry action required");
assert.ok(summaryUi.includes("never approved or published automatically"), "impact must be labelled report-only");
// Bulk approval limited to safe classes.
assert.ok(reviewClient.includes('selectByClass("unchanged")'), "approve-unchanged bulk action required");
assert.ok(reviewClient.includes('selectByClass("metadata_only")'), "approve-metadata-only bulk action required");
for (const unsafe of ["content_changed", "new", "removed", "renamed_moved"]) {
  assert.ok(!reviewClient.includes(`selectByClass("${unsafe}")`), `${unsafe} must not be bulk-approvable`);
}
// Existing publish path preserved.
assert.ok(reviewClient.includes("/api/sync/"), "publish call preserved");
const publishRoute = read("app/api/sync/[id]/publish/route.ts");
assert.ok(publishRoute.includes("publish_sync_chapters"), "atomic publish RPC unchanged");
assert.ok(publishRoute.includes("requireAdmin"), "publish stays admin-guarded");

console.log("UPD-2.1 extraction pipeline checks passed.");
