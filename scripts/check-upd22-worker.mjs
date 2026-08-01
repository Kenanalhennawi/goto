// UPD-2.2 — background worker completion checks.
// Run with: node scripts/check-upd22-worker.mjs
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const worker = read("worker/index.mjs");
const migration = read("supabase/migrations/20260803000000_worker_reclaim.sql");
const extractPy = read("tools/extraction/extract.py");
const verifyScript = read("scripts/verify-extraction-pipeline.mjs");

// ===========================================================================
// 1. Continuous polling + atomic single-run claim
// ===========================================================================
assert.ok(/setTimeout\(resolve, POLL_INTERVAL_MS\)/.test(worker), "worker must poll continuously");
assert.ok(/for \(;;\)/.test(worker), "poll loop must run forever");
assert.ok(worker.includes("claim_sync_run"), "worker must claim through the RPC");
assert.ok(worker.includes("p_stale_after_seconds"), "worker must pass the stale window");
assert.ok(migration.includes("for update skip locked"), "claim must use FOR UPDATE SKIP LOCKED");
assert.ok(/limit 1/.test(migration), "claim must take exactly one run");
assert.ok(
  /revoke all on function public\.claim_sync_run\(text, integer\) from public, anon, authenticated/.test(migration),
  "claim must be worker-only"
);
assert.ok(migration.includes("grant execute on function public.claim_sync_run(text, integer) to service_role"), "claim granted to service_role");

// ===========================================================================
// 2. Progress contract (the exact stages required by UPD-2.2)
// ===========================================================================
for (const label of [
  "Queued",
  "Downloading",
  "Validating",
  "Extracting",
  "Parsing",
  "Comparing",
  "Building impact report",
  "Ready for review",
]) {
  assert.ok(worker.includes(`"${label}"`), `progress stage "${label}" must exist`);
}
assert.ok(worker.includes("const STAGE = {"), "stages must be declared in one table");
// Monotonic, bounded progress.
const stageBlock = worker.slice(worker.indexOf("const STAGE = {"), worker.indexOf("};", worker.indexOf("const STAGE = {")));
const percents = [...stageBlock.matchAll(/,\s*(\d+),/g)].map((m) => Number(m[1]));
assert.ok(percents.length >= 8, "every stage must declare a percentage");
for (const p of percents) assert.ok(p >= 0 && p <= 100, "stage percentages must be 0-100");
for (let i = 1; i < percents.length; i++) {
  assert.ok(percents[i] > percents[i - 1], "stage percentages must increase monotonically");
}
assert.ok(/Math\.max\(0, Math\.min\(100/.test(worker), "progress must be clamped on write");

// ===========================================================================
// 3. Validation coverage (sha256, page count, signature, version, date)
// ===========================================================================
assert.ok(worker.includes('createHash("sha256")'), "worker must recompute sha256 authoritatively");
assert.ok(worker.includes("HASH_MISMATCH"), "hash mismatch must be detected");
assert.ok(worker.includes('"%PDF-"'), "PDF signature must be checked");
assert.ok(worker.includes("pdf_page_count"), "page count must be persisted");
assert.ok(worker.includes("pdf_version") && worker.includes("pdf_version_date"), "version + date persisted");
assert.ok(worker.includes("evaluateVersionGate"), "version/duplicate gate must run");
assert.ok(worker.includes("FILE_TOO_LARGE") && worker.includes("EMPTY_FILE"), "size bounds enforced");

// ===========================================================================
// 4. Pipeline completeness
// ===========================================================================
assert.ok(worker.includes("runExtractor"), "extractor must be invoked");
assert.ok(worker.includes("validateExtractionContract"), "chapters.json must be validated");
assert.ok(worker.includes("classifyExtraction"), "chapters must be classified");
assert.ok(worker.includes("sync_staged_changes"), "staged changes must be written");
assert.ok(worker.includes("buildImpactReport") && worker.includes("sync_impact_report"), "impact report must be written");
assert.ok(worker.includes("rekeyPdf"), "PDF must be archived canonically");

// ===========================================================================
// 5. Idempotency + crash recovery
// ===========================================================================
// Re-running a claimed run must not duplicate rows.
assert.ok(
  /from\("sync_staged_changes"\)\s*\.delete\(\)\s*\.eq\("sync_run_id", runId\)/.test(worker),
  "staged rows must be replaced, not appended"
);
assert.ok(
  /from\("sync_impact_report"\)\s*\.delete\(\)\s*\.eq\("run_id", runId\)/.test(worker),
  "impact rows must be replaced, not appended"
);
// Heartbeat so an abandoned run can be detected.
assert.ok(worker.includes("startHeartbeat"), "worker must emit a heartbeat");
assert.ok(worker.includes("heartbeat_at"), "heartbeat column must be updated");
assert.ok(/stopHeartbeat\(\);/.test(worker), "heartbeat must stop when the run ends");
assert.ok(migration.includes("heartbeat_at"), "migration must add the heartbeat column");
// Reclaim of stale in-flight runs.
assert.ok(
  /state in \('validating', 'extracting'\)/.test(migration),
  "claim must consider abandoned in-flight runs"
);
assert.ok(migration.includes("attempt_count < max_attempts"), "reclaim must respect the attempt limit");
assert.ok(migration.includes("WORKER_STALLED"), "exhausted stale runs must fail safely");
assert.ok(migration.includes("attempt_count = attempt_count + 1"), "attempts must be counted");

// ===========================================================================
// 6. Automatic retry of transient failures only
// ===========================================================================
assert.ok(worker.includes("TRANSIENT_ERROR_CODES"), "transient failure set required");
for (const code of ["DOWNLOAD_FAILED", "SNAPSHOT_FAILED", "STAGING_FAILED", "IMPACT_FAILED", "REKEY_FAILED", "EXTRACTION_TIMEOUT"]) {
  assert.ok(worker.includes(`"${code}"`), `${code} must be retryable`);
}
// Permanent failures must NOT be in the retry set.
const transientBlock = worker.slice(
  worker.indexOf("const TRANSIENT_ERROR_CODES"),
  worker.indexOf("]);", worker.indexOf("const TRANSIENT_ERROR_CODES"))
);
for (const permanent of ["INVALID_PDF", "DUPLICATE_PDF", "OLDER_VERSION", "INVALID_EXTRACTOR_OUTPUT", "SAME_VERSION_DIFFERENT_CONTENT"]) {
  assert.ok(!transientBlock.includes(permanent), `${permanent} must never auto-retry`);
}
assert.ok(worker.includes("requeue_sync_run"), "worker must requeue transient failures");
assert.ok(migration.includes("create or replace function public.requeue_sync_run"), "requeue RPC required");
assert.ok(migration.includes("attempt_count < max_attempts"), "requeue must be bounded");
assert.ok(
  /revoke all on function public\.requeue_sync_run\(uuid, text\) from public, anon, authenticated/.test(migration),
  "requeue must be worker-only"
);

// ===========================================================================
// 7. Safe error surface
// ===========================================================================
assert.ok(!/error\.stack|\.stack\b/.test(worker), "stack traces must never be persisted");
assert.ok(/\.slice\(0, 300\)/.test(worker), "error detail must be truncated");
assert.ok(worker.includes("error_code"), "a stable error code must be stored");
// stderr from the extractor is reduced to a code, never surfaced verbatim.
assert.ok(/String\(error\?\.stderr \?\? ""\)/.test(worker), "extractor stderr must be parsed for a code only");
assert.ok(/code = String\(parsed\.error\)\.slice\(0, 40\)/.test(worker), "extractor error code must be bounded");

// ===========================================================================
// 8. Nothing operational is mutated
// ===========================================================================
assert.ok(
  !/from\("procedure_cards"\)[\s\S]{0,120}\.(update|insert|upsert|delete)\(/.test(worker),
  "worker must not mutate procedure cards"
);
assert.ok(!/publish_sync_chapters/.test(worker), "worker must never publish chapters");
assert.ok(!/review_status:\s*/.test(worker), "worker must not set review_status");
assert.ok(!/from\("chapters"\)[\s\S]{0,120}\.(update|insert|upsert|delete)\(/.test(worker), "worker must not write chapters");
const migrationCode = migration.replace(/--.*$/gm, "");
assert.ok(!/procedure_cards|decision|chapters\b/.test(migrationCode), "migration must not touch operational tables");

// ===========================================================================
// 9. Extractor page-boundary correctness (regression: trailing form feed)
// ===========================================================================
assert.ok(
  /while pages and not pages\[-1\]\.strip\(\)/.test(extractPy),
  "extractor must drop the trailing empty page so pageEnd never overshoots"
);

// ===========================================================================
// 9b. UPD-2.3: Windows-safe Unicode handling in the extraction tools
// ===========================================================================
const attachPy = read("tools/extraction/attach_pdf_links.py");
for (const [name, src] of [["extract.py", extractPy], ["attach_pdf_links.py", attachPy]]) {
  // Every subprocess call must decode UTF-8 explicitly; text=True alone falls
  // back to locale.getpreferredencoding() (cp1252 on Windows) and crashes.
  const calls = [...src.matchAll(/subprocess\.run\(([\s\S]{0,400}?)\)/g)].map((m) => m[1]);
  assert.ok(calls.length > 0, `${name} must invoke subprocess`);
  for (const call of calls) {
    assert.ok(/encoding="utf-8"/.test(call), `${name}: subprocess must set encoding="utf-8"`);
    assert.ok(/errors="replace"/.test(call), `${name}: subprocess must set errors="replace"`);
  }
  // No reliance on the platform locale anywhere in CODE. Docstrings and
  // comments may legitimately explain the cp1252 problem, so strip them first.
  const code = src
    .replace(/"""[\s\S]*?"""/g, "")
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return t && !t.startsWith("#");
    })
    .join("\n");
  assert.ok(!/getpreferredencoding/.test(code), `${name} must not use locale.getpreferredencoding`);
  assert.ok(!/cp1252/.test(code), `${name} must not reference cp1252 in code`);
  // A proper error type instead of AttributeError on None.
  assert.ok(/class ExtractionError\(Exception\)/.test(src), `${name} must define ExtractionError`);
  assert.ok(/if result\.stdout is None:/.test(src), `${name} must guard a None stdout`);
  assert.ok(/except ExtractionError as error:/.test(src), `${name} must exit via the error contract`);
  // Windows console safety.
  assert.ok(/reconfigure\(encoding="utf-8"/.test(src), `${name} must force UTF-8 on its own streams`);
}
// Guards must precede the split() that previously raised AttributeError.
assert.ok(
  extractPy.indexOf('if text is None:') < extractPy.indexOf('pages = text.split("\\f")'),
  "extract.py must check for None before splitting"
);
assert.ok(/raise ExtractionError\("EMPTY_OUTPUT", "pdftotext returned no text"\)/.test(extractPy), "explicit empty-output error required");
assert.ok(/NO_TEXT_LAYER/.test(extractPy), "empty text layer must raise a proper error");

// ===========================================================================
// 10. Verification harness
// ===========================================================================
assert.ok(existsSync(new URL("../scripts/verify-extraction-pipeline.mjs", import.meta.url)), "verifier must exist");
assert.ok(verifyScript.includes("validateExtractionContract"), "verifier uses the real contract");
assert.ok(verifyScript.includes("classifyExtraction"), "verifier uses the real classifier");
assert.ok(verifyScript.includes("buildImpactReport"), "verifier uses the real impact engine");
assert.ok(!/SERVICE_ROLE/i.test(verifyScript), "verifier must not need the service role");

console.log("UPD-2.2 worker checks passed.");
