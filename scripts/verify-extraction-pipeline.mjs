// UPD-2.2 — end-to-end pipeline verification against a real GO TO PDF.
//
// Runs the EXACT logic the worker runs (extractor -> contract validation ->
// classification -> impact report), but offline: no Supabase, no storage, no
// database writes. Use it to prove a manual extracts and classifies correctly
// before queueing a real run.
//
// Usage:
//   node scripts/verify-extraction-pipeline.mjs <path-to.pdf> [--json]
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));

const { validateExtractionContract, evaluateVersionGate } = await import("../lib/extraction-contract.ts");
const { classifyExtraction, summarizeDiffs, isAutoApprovable } = await import("../lib/sync-diff.ts");
const { buildImpactReport, readiness } = await import("../lib/sync-impact.ts");

const pdfPath = process.argv[2];
const asJson = process.argv.includes("--json");

if (!pdfPath) {
  console.error("usage: node scripts/verify-extraction-pipeline.mjs <path-to.pdf> [--json]");
  process.exit(1);
}

const workDir = await mkdtemp(join(tmpdir(), "goto-verify-"));
try {
  // ---- Extract (same argument-array invocation as the worker) ----
  for (const script of ["extract.py", "attach_pdf_links.py"]) {
    await execFileAsync("python3", [join(root, "tools/extraction", script), pdfPath, workDir], {
      timeout: 15 * 60 * 1000,
      maxBuffer: 1024 * 1024,
      shell: false,
    });
  }

  // ---- Validate the contract ----
  const parsed = JSON.parse(await readFile(join(workDir, "chapters.json"), "utf8"));
  const validation = validateExtractionContract(parsed);
  if (!validation.ok) {
    console.error(`CONTRACT REJECTED: ${validation.errorCode} — ${validation.error}`);
    process.exit(2);
  }
  const contract = validation.value;

  // ---- Version gate (against an empty history: first-ever run) ----
  const gate = evaluateVersionGate({
    incomingVersion: contract.source.version,
    incomingSha256: contract.source.sha256,
    currentVersion: null,
    knownSha256: [],
    overrideReason: null,
  });

  // ---- Classify against the live chapters (none available offline) ----
  const incoming = contract.chapters.map((c) => ({
    title: c.title,
    slug: c.slug,
    chapter_number: Number(c.chapterNumber) || null,
    body_text: c.body,
    keywords: c.searchKeywords,
    page_start: c.pageStart,
    page_end: c.pageEnd,
    source_version: contract.source.version,
  }));
  const diffs = classifyExtraction(incoming, [], contract.source.version);
  const summary = summarizeDiffs(diffs);

  // ---- Impact report against the registered workflows ----
  let workflows = [];
  try {
    const mod = await import("../lib/decision-engine/definitions/index.ts");
    workflows = Object.values(mod.DECISION_DEFINITIONS).map((d) => ({
      slug: d.procedureSlug,
      title: d.procedureTitle,
      sourceVersion: d.sourceVersion,
      sourcePages: d.sourcePages ?? [],
    }));
  } catch {
    /* optional */
  }
  const impact = buildImpactReport({ diffs, cards: [], workflows, targetVersion: contract.source.version });
  const ready = readiness(impact);

  const result = {
    source: { ...contract.source, sha256: `${contract.source.sha256.slice(0, 12)}…` },
    extractorVersion: contract.extractorVersion,
    chapters: contract.chapters.length,
    versionGate: gate.allowed ? "allowed" : `${gate.errorCode}`,
    classification: summary,
    autoApprovable: diffs.filter((d) => isAutoApprovable(d.changeClass)).length,
    requiresReview: diffs.filter((d) => !isAutoApprovable(d.changeClass)).length,
    impact: { total: impact.length, ...ready },
  };

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("PDF Update Studio — pipeline verification");
    console.log(`  title        ${result.source.title}`);
    console.log(`  version      ${result.source.version}  (${result.source.versionDate})`);
    console.log(`  pages        ${result.source.pageCount}`);
    console.log(`  sha256       ${result.source.sha256}`);
    console.log(`  extractor    ${result.extractorVersion}`);
    console.log(`  chapters     ${result.chapters}`);
    console.log(`  version gate ${result.versionGate}`);
    console.log(`  classes      ${JSON.stringify(result.classification)}`);
    console.log(`  impact       ${result.impact.total} item(s); blocked=${ready.blocked} review=${ready.review}`);
    console.log(ready.canComplete ? "  RESULT       pipeline OK" : "  RESULT       pipeline OK (blockers require owner review)");
  }
} finally {
  await rm(workDir, { recursive: true, force: true }).catch(() => {});
}
