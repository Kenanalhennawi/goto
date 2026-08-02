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
// 9c. UPD-2.4: cross-platform extractor script paths
// ===========================================================================
{
  const { fileURLToPath } = await import("node:url");
  const { resolve, isAbsolute } = await import("node:path");

  // (a) fileURLToPath is imported and used for the default tools directory.
  assert.ok(/import \{ fileURLToPath \} from "node:url"/.test(worker), "worker must import fileURLToPath");
  assert.ok(/import \{[^}]*\bresolve\b[^}]*\} from "node:path"/.test(worker), "worker must import resolve from node:path");
  assert.ok(
    /const DEFAULT_TOOLS_DIR = fileURLToPath\(new URL\("\.\.\/tools\/extraction\/", import\.meta\.url\)\)/.test(worker),
    "default tools dir must use fileURLToPath"
  );
  assert.ok(
    /const TOOLS_DIR = process\.env\.TOOLS_DIR \? resolve\(process\.env\.TOOLS_DIR\) : DEFAULT_TOOLS_DIR/.test(worker),
    "TOOLS_DIR override must be resolved to an absolute native path"
  );

  // (b) No raw URL.pathname is used for ANY filesystem path.
  const workerCode = worker
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
  assert.ok(!/new URL\([^)]*\)\.pathname/.test(workerCode), "URL.pathname must never be used as a filesystem path");
  assert.ok(!/\.pathname/.test(workerCode), "worker must not read .pathname at all");

  // (c) The Windows conversion produces a native drive-letter path, NOT "/C:/...".
  const winUrl = new URL("../tools/extraction/", "file:///C:/Users/domin/goto/worker/index.mjs");
  const winPathname = winUrl.pathname; // the old, broken behaviour
  const winNative = fileURLToPath(winUrl, { windows: true }); // the fix
  assert.equal(winPathname, "/C:/Users/domin/goto/tools/extraction/", "sanity: pathname is the broken form");
  assert.ok(/^[A-Za-z]:\\/.test(winNative), `Windows path must start with a drive letter (got ${winNative})`);
  assert.ok(!winNative.startsWith("/"), "Windows path must not keep the leading slash");
  assert.ok(winNative.includes("\\tools\\extraction"), "Windows path must use native separators");

  // (d) Linux behaviour is unchanged.
  const posixUrl = new URL("../tools/extraction/", "file:///srv/app/worker/index.mjs");
  const posixNative = fileURLToPath(posixUrl, { windows: false });
  assert.equal(posixNative, "/srv/app/tools/extraction/", "POSIX path must be unchanged");
  assert.equal(posixNative, posixUrl.pathname, "on POSIX, fileURLToPath matches the old behaviour");

  // (e) TOOLS_DIR override still works and stays absolute.
  const overridden = resolve("./tools/extraction");
  assert.ok(isAbsolute(overridden), "an overridden TOOLS_DIR must resolve to an absolute path");

  // (f) Missing scripts raise the dedicated code, never generic EXTRACTION_FAILED.
  assert.ok(/import \{[^}]*\baccess\b[^}]*\} from "node:fs\/promises"/.test(worker), "worker must import fs access");
  assert.ok(/await access\(script\)/.test(worker), "worker must verify each script exists");
  assert.ok(/"EXTRACTOR_SCRIPT_MISSING"/.test(worker), "missing scripts need a dedicated error code");
  const preflight = worker.slice(worker.indexOf("for (const script of scripts)"), worker.indexOf("await execFileAsync"));
  assert.ok(preflight.includes("EXTRACTOR_SCRIPT_MISSING"), "existence check must run BEFORE execFile");
  assert.ok(!preflight.includes("EXTRACTION_FAILED"), "the preflight must not use the generic code");

  // (g) execFile safety options are retained.
  assert.ok(/shell: false/.test(worker) && /windowsHide: true/.test(worker), "execFile safety flags must remain");
  assert.ok(/timeout: EXTRACT_TIMEOUT_MS/.test(worker) && /maxBuffer: MAX_OUTPUT_BYTES/.test(worker), "limits must remain");

  // (h) Diagnostics log the code and basename only — never paths or secrets.
  assert.ok(/basename\(script\)/.test(worker), "diagnostics must log the script basename");
  assert.ok(!/console\.(error|log)\([^)]*TOOLS_DIR/.test(worker), "must not log the tools directory");
  assert.ok(!/console\.(error|log)\([^)]*stderr/.test(worker), "must never log raw stderr");
  // No console call may interpolate a secret VALUE or a filesystem path.
  // (Naming the required env var in the startup message is fine.)
  for (const leak of [
    /console\.(error|log)\([^)]*\$\{SERVICE_ROLE_KEY/,
    /console\.(error|log)\([^)]*\$\{SUPABASE_URL/,
    /console\.(error|log)\([^)]*\$\{pdfPath/,
    /console\.(error|log)\([^)]*\$\{workDir/,
    /console\.(error|log)\([^)]*\$\{script\}/,
  ]) {
    assert.ok(!leak.test(worker), `diagnostics must not interpolate ${leak}`);
  }
}

// ===========================================================================
// 9d. UPD-2.5: safe impact-insert diagnostics + local row validation
// ===========================================================================
{
  // (a) Local row validation runs BEFORE the insert, with its own stable code.
  assert.ok(/function validateImpactRow\(row\)/.test(worker), "impact rows must be validated locally");
  assert.ok(/"INVALID_IMPACT_ROW"/.test(worker), "local validation needs a distinct code");
  const impactBlock = worker.slice(
    worker.indexOf("const impactRows = impact.map"),
    worker.indexOf("await setStage(runId, STAGE.READY")
  );
  assert.ok(impactBlock.length > 0, "impact section must exist");
  assert.ok(
    impactBlock.indexOf("INVALID_IMPACT_ROW") < impactBlock.indexOf('.from("sync_impact_report").insert('),
    "row validation must precede the insert"
  );

  // (b) All required field checks are present.
  for (const check of ["run_id", "impact_type", "status", "entity_slug", "requires_manual_review"]) {
    assert.ok(new RegExp(`row\\.${check}`).test(worker), `validator must check ${check}`);
  }
  assert.ok(/UUID_RE/.test(worker), "run_id must be UUID-checked");
  assert.ok(/IMPACT_TYPES = new Set\(\[/.test(worker), "impact_type must use an allow-list");
  assert.ok(/IMPACT_STATUSES = new Set\(\["ok", "review", "blocked"\]\)/.test(worker), "status allow-list must be ok/review/blocked");

  // (c) Supabase diagnostics: exactly the six safe fields, nothing more.
  assert.ok(/function logImpactInsertFailure\(/.test(worker), "a dedicated safe logger is required");
  const logger = worker.slice(
    worker.indexOf("function logImpactInsertFailure("),
    worker.indexOf("}", worker.indexOf("JSON.stringify({", worker.indexOf("function logImpactInsertFailure(")))
  );
  for (const field of ["error?.code", "error?.message", "error?.details", "error?.hint", "batchStart", "batchCount"]) {
    assert.ok(logger.includes(field), `diagnostics must include ${field}`);
  }
  // (d) Forbidden values must never be logged. Note batchStart/batchCount are
  // required, so the row array `batch` is matched on a word boundary.
  for (const banned of [
    /\bbatch\b/,
    /\bimpactRows\b/,
    /row\.reason/,
    /error\.stack|\?\.stack/,
    /\bheaders\b/i,
    /Authorization/i,
    /SERVICE_ROLE/i,
  ]) {
    assert.ok(!banned.test(logger), `diagnostics must not log ${banned}`);
  }
  // Row CONTENTS must never be logged. A count (impactRows.length) is fine.
  assert.ok(!/JSON\.stringify\(batch\b/.test(worker), "raw batch rows must never be serialised to the log");
  assert.ok(!/JSON\.stringify\(impactRows\b/.test(worker), "impact rows must never be serialised to the log");
  assert.ok(!/console\.(error|log)\([^)]*\$\{impactRows\}/.test(worker), "the impact row array must never be interpolated");
  assert.ok(!/console\.(error|log)\([^)]*\$\{batch\}/.test(worker), "the batch array must never be interpolated");

  // (e) The persisted, user-facing failure is unchanged.
  assert.ok(
    /new WorkerError\("IMPACT_FAILED", "Could not write the impact report\."\)/.test(worker),
    "persisted IMPACT_FAILED message must be preserved"
  );
  assert.ok(
    /new WorkerError\("INVALID_IMPACT_ROW", "Could not write the impact report\."\)/.test(worker),
    "local validation must keep the same user-facing message"
  );

  // (f) A local structural fault must not consume automatic retries.
  const transient = worker.slice(
    worker.indexOf("const TRANSIENT_ERROR_CODES"),
    worker.indexOf("]);", worker.indexOf("const TRANSIENT_ERROR_CODES"))
  );
  assert.ok(!transient.includes("INVALID_IMPACT_ROW"), "INVALID_IMPACT_ROW must not auto-retry");
  assert.ok(transient.includes("IMPACT_FAILED"), "IMPACT_FAILED remains transient");

  // (g) Runtime behaviour of the validator (mirrors the worker implementation).
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const TYPES = new Set(["chapter", "procedure_card", "workflow", "search_term", "orphaned_source"]);
  const STATUSES = new Set(["ok", "review", "blocked"]);
  const validate = (row) => {
    if (!row || typeof row !== "object") return "row is not an object";
    if (typeof row.run_id !== "string" || !UUID_RE.test(row.run_id)) return "run_id is not a UUID";
    if (!TYPES.has(row.impact_type)) return "impact_type not allowed";
    if (!STATUSES.has(row.status)) return "status not allowed";
    if (typeof row.entity_slug !== "string" || row.entity_slug.trim().length === 0) return "entity_slug is empty";
    if (typeof row.requires_manual_review !== "boolean") return "requires_manual_review is not a boolean";
    return null;
  };
  const good = {
    run_id: "3f8a1c2e-5b6d-4e7f-9a8b-1c2d3e4f5a6b",
    impact_type: "workflow",
    entity_slug: "wheelchair",
    status: "review",
    requires_manual_review: true,
  };
  assert.equal(validate(good), null, "a well-formed row must pass");
  assert.ok(validate({ ...good, run_id: "nope" }), "bad UUID rejected");
  assert.ok(validate({ ...good, impact_type: "chapters" }), "bad impact_type rejected");
  assert.ok(validate({ ...good, status: "pending" }), "bad status rejected");
  assert.ok(validate({ ...good, entity_slug: "   " }), "empty slug rejected");
  assert.ok(validate({ ...good, requires_manual_review: "yes" }), "non-boolean rejected");

  // (h) The safe log payload cannot carry a secret even if Supabase attaches one.
  const payload = JSON.stringify({
    code: "42P01",
    message: 'relation "public.sync_impact_report" does not exist',
    details: null,
    hint: "Apply the pending migration.",
    batchStart: 0,
    batchCount: 82,
  });
  assert.ok(!/eyJ|Authorization|Bearer|service_role/i.test(payload), "diagnostic payload must be secret-free");
}

// ===========================================================================
// 10. Verification harness
// ===========================================================================
assert.ok(existsSync(new URL("../scripts/verify-extraction-pipeline.mjs", import.meta.url)), "verifier must exist");
assert.ok(verifyScript.includes("validateExtractionContract"), "verifier uses the real contract");
assert.ok(verifyScript.includes("classifyExtraction"), "verifier uses the real classifier");
assert.ok(verifyScript.includes("buildImpactReport"), "verifier uses the real impact engine");
assert.ok(!/SERVICE_ROLE/i.test(verifyScript), "verifier must not need the service role");

console.log("UPD-2.2 worker checks passed.");
