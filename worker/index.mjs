// PDF Update Studio — background extraction worker (UPD-2.2, self-healing).
//
// Provider-neutral: runs unchanged on Cloud Run (reference), Fly.io, Render or
// Railway. Uses the service role key, which MUST exist only in the worker
// environment — never in Vercel, NEXT_PUBLIC_*, the client bundle or the
// browser.
//
// Flow: claim -> Downloading -> Validating -> Extracting -> Parsing ->
//       Comparing -> Building impact report -> Ready for review.
// Crashed runs are reclaimed via heartbeat; transient failures auto-retry.
// It NEVER publishes chapters, never approves or publishes procedure cards,
// never edits decision trees, and never deletes a removed chapter.

import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { promisify } from "node:util";

import { validateExtractionContract, evaluateVersionGate } from "../lib/extraction-contract.ts";
import { classifyExtraction, isAutoApprovable } from "../lib/sync-diff.ts";
import { buildImpactReport } from "../lib/sync-impact.ts";
import { archivedPdfPath } from "../lib/sync-upload.ts";

const execFileAsync = promisify(execFile);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKER_ID = process.env.WORKER_ID ?? `worker-${process.pid}`;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 15000);
const EXTRACTOR_VERSION = process.env.EXTRACTOR_VERSION ?? "upd2-1";
const PYTHON_BIN = process.env.PYTHON_BIN ?? "python3";
const TOOLS_DIR = process.env.TOOLS_DIR ?? new URL("../tools/extraction/", import.meta.url).pathname;

const BUCKET = "manual-sources";
const MAX_BYTES = 40 * 1024 * 1024;
const EXTRACT_TIMEOUT_MS = Number(process.env.EXTRACT_TIMEOUT_MS ?? 15 * 60 * 1000);
const MAX_OUTPUT_BYTES = 1024 * 1024; // bounded stdout/stderr
const STALE_AFTER_SECONDS = Number(process.env.STALE_AFTER_SECONDS ?? 900);
const HEARTBEAT_MS = Number(process.env.HEARTBEAT_MS ?? 30000);

// UPD-2.2 progress contract. Stage -> [run state, progress %, label].
const STAGE = {
  QUEUED: ["validating", 5, "Queued"],
  DOWNLOADING: ["validating", 15, "Downloading"],
  VALIDATING: ["validating", 25, "Validating"],
  EXTRACTING: ["extracting", 40, "Extracting"],
  PARSING: ["extracting", 60, "Parsing"],
  COMPARING: ["extracting", 75, "Comparing"],
  IMPACT: ["extracting", 90, "Building impact report"],
  READY: ["staged", 100, "Ready for review"],
};

// Only these failures are worth retrying automatically; everything else would
// fail identically on a second attempt (bad PDF, duplicate, older version...).
const TRANSIENT_ERROR_CODES = new Set([
  "DOWNLOAD_FAILED",
  "SNAPSHOT_FAILED",
  "STAGING_FAILED",
  "IMPACT_FAILED",
  "REKEY_FAILED",
  "EXTRACTION_TIMEOUT",
]);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// State reporting (progress is CHECK-constrained to 0-100 in the database)
// ---------------------------------------------------------------------------
async function setState(runId, state, pct, message, extra = {}) {
  const patch = {
    state,
    progress_pct: Math.max(0, Math.min(100, Math.round(pct))),
    progress_message: message,
    ...extra,
  };
  const { error } = await supabase.from("sync_runs").update(patch).eq("id", runId);
  if (error) console.error(`[${runId}] state update failed:`, error.message);
}

/** Advance to a named pipeline stage (state + bounded progress + label). */
async function setStage(runId, stage, extra = {}) {
  const [state, pct, label] = stage;
  await setState(runId, state, pct, label, { heartbeat_at: new Date().toISOString(), ...extra });
}

/** Periodic liveness signal so a crashed worker's run can be reclaimed. */
function startHeartbeat(runId) {
  const timer = setInterval(() => {
    supabase
      .from("sync_runs")
      .update({ heartbeat_at: new Date().toISOString() })
      .eq("id", runId)
      .then(() => {}, () => {});
  }, HEARTBEAT_MS);
  if (typeof timer.unref === "function") timer.unref();
  return () => clearInterval(timer);
}

/** Safe failure: a stable code plus a short message. Never a stack trace. */
async function fail(runId, code, detail) {
  console.error(`[${runId}] ${code}`);

  // Transient problems get a bounded automatic retry; requeue_sync_run()
  // returns false once attempt_count has reached max_attempts.
  if (TRANSIENT_ERROR_CODES.has(code)) {
    const { data: requeued } = await supabase.rpc("requeue_sync_run", {
      p_run_id: runId,
      p_reason: `${code}: retrying automatically`,
    });
    if (requeued === true) {
      console.log(`[${runId}] requeued after transient ${code}`);
      return;
    }
  }

  await setState(runId, "failed", 100, "Extraction failed", {
    error_code: code,
    error_detail: String(detail ?? "").slice(0, 300),
    heartbeat_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });
}

class WorkerError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Extraction: argument arrays only, never shell interpolation
// ---------------------------------------------------------------------------
async function runExtractor(pdfPath, outDir) {
  const scripts = [
    join(TOOLS_DIR, "extract.py"),
    join(TOOLS_DIR, "attach_pdf_links.py"),
  ];

  for (const script of scripts) {
    try {
      // execFile (not exec): arguments are passed as an array, so a hostile
      // filename can never be interpreted by a shell. pdfPath/outDir are
      // generated temp paths, never the user-supplied name.
      await execFileAsync(PYTHON_BIN, [script, pdfPath, outDir], {
        timeout: EXTRACT_TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_BYTES,
        shell: false,
        windowsHide: true,
      });
    } catch (error) {
      if (error?.killed || error?.signal === "SIGTERM") {
        throw new WorkerError("EXTRACTION_TIMEOUT", "Extraction exceeded the time limit.");
      }
      // The script emits {"error": CODE} on stderr; surface only that code.
      let code = "EXTRACTION_FAILED";
      try {
        const parsed = JSON.parse(String(error?.stderr ?? "").trim().split("\n").pop() ?? "");
        if (parsed?.error) code = String(parsed.error).slice(0, 40);
      } catch {
        /* keep the generic code */
      }
      throw new WorkerError(code, "The extractor could not process this PDF.");
    }
  }

  const raw = await readFile(join(outDir, "chapters.json"), "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new WorkerError("INVALID_EXTRACTOR_OUTPUT", "Extractor output was not valid JSON.");
  }

  const validation = validateExtractionContract(parsed);
  if (!validation.ok) throw new WorkerError(validation.errorCode, validation.error);
  return validation.value;
}

// ---------------------------------------------------------------------------
// Canonical storage re-keying (idempotent)
// ---------------------------------------------------------------------------
async function rekeyPdf(runId, pendingPath, version, sha256) {
  const canonical = archivedPdfPath(version ?? "unknown", sha256);
  if (pendingPath === canonical) return canonical;

  const { error: moveError } = await supabase.storage.from(BUCKET).move(pendingPath, canonical);
  if (moveError) {
    // Already re-keyed by a previous attempt? Treat an existing object as success.
    const { data: existing } = await supabase.storage
      .from(BUCKET)
      .list(canonical.split("/")[0], { search: canonical.split("/")[1] });
    if (!existing || existing.length === 0) {
      throw new WorkerError("REKEY_FAILED", "Could not archive the uploaded PDF.");
    }
  }
  await supabase.from("sync_runs").update({ pdf_path: canonical }).eq("id", runId);
  return canonical;
}

// ---------------------------------------------------------------------------
// One job
// ---------------------------------------------------------------------------
async function processRun(run) {
  const runId = run.id;
  let workDir = null;
  const stopHeartbeat = startHeartbeat(runId);

  try {
    workDir = await mkdtemp(join(tmpdir(), "goto-sync-"));

    // ---- 1. Download (10%) ----
    await setStage(runId, STAGE.DOWNLOADING);
    const { data: blob, error: dlError } = await supabase.storage.from(BUCKET).download(run.pdf_path);
    if (dlError || !blob) throw new WorkerError("DOWNLOAD_FAILED", "Could not download the uploaded PDF.");
    const buffer = Buffer.from(await blob.arrayBuffer());

    // ---- 2. Authoritative validation (15%) ----
    if (buffer.byteLength === 0) throw new WorkerError("EMPTY_FILE", "The uploaded file is empty.");
    if (buffer.byteLength > MAX_BYTES) throw new WorkerError("FILE_TOO_LARGE", "The PDF exceeds 40 MB.");
    if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      throw new WorkerError("INVALID_PDF", "The file is not a PDF.");
    }
    // Never trust the browser-supplied hash: recompute it here.
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const pdfPath = join(workDir, "manual.pdf");
    await writeFile(pdfPath, buffer);
    await setStage(runId, STAGE.VALIDATING, { pdf_sha256: sha256 });

    // ---- 3. Extract (25-70%) ----
    await setStage(runId, STAGE.EXTRACTING, {
      started_at: run.started_at ?? new Date().toISOString(),
      extractor_version: EXTRACTOR_VERSION,
    });
    const outDir = join(workDir, "output");
    const contract = await runExtractor(pdfPath, outDir);

    if (contract.source.sha256 !== sha256) {
      throw new WorkerError("HASH_MISMATCH", "Extracted file hash does not match the stored PDF.");
    }
    // Parsing: the extractor output has been validated against the contract.
    await setStage(runId, STAGE.PARSING, {
      pdf_page_count: contract.source.pageCount,
      pdf_version: contract.source.version,
      pdf_version_date: contract.source.versionDate,
    });

    // ---- 4. Version / duplicate gate ----
    const { data: publishedRuns } = await supabase
      .from("sync_runs")
      .select("pdf_version, pdf_sha256")
      .eq("state", "published")
      .order("completed_at", { ascending: false })
      .limit(50);
    const currentVersion = publishedRuns?.[0]?.pdf_version ?? null;
    const knownSha256 = (publishedRuns ?? []).map((r) => r.pdf_sha256).filter(Boolean);

    const gate = evaluateVersionGate({
      incomingVersion: contract.source.version,
      incomingSha256: sha256,
      currentVersion,
      knownSha256,
      overrideReason: run.override_reason ?? null,
    });
    if (!gate.allowed) throw new WorkerError(gate.errorCode, gate.error);

    // ---- 5. Snapshot live chapters + classify (75%) ----
    await setStage(runId, STAGE.COMPARING);
    const { data: liveChapters, error: liveError } = await supabase
      .from("chapters")
      .select("id, slug, title, chapter_number, body_text, search_keywords, page_start, page_end, source_version");
    if (liveError) throw new WorkerError("SNAPSHOT_FAILED", "Could not read the live chapters.");

    const live = (liveChapters ?? []).map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      chapter_number: c.chapter_number,
      body_text: c.body_text,
      keywords: c.search_keywords,
      page_start: c.page_start,
      page_end: c.page_end,
      source_version: c.source_version,
    }));

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

    const diffs = classifyExtraction(incoming, live, contract.source.version);
    const bySlug = new Map(contract.chapters.map((c) => [c.slug, c]));

    // ---- 6. Stage rows (80-90%) — replace any prior incomplete attempt ----
    await setStage(runId, STAGE.COMPARING, { progress_message: "Comparing" });
    await supabase.from("sync_staged_changes").delete().eq("sync_run_id", runId);

    const stagedRows = diffs.map((d) => {
      const source = bySlug.get(d.slug);
      const liveMatch = live.find((c) => c.id === d.existingId) ?? null;
      const removed = d.changeClass === "removed";
      return {
        sync_run_id: runId,
        chapter_number: d.chapterNumber ?? liveMatch?.chapter_number ?? 0,
        title: d.title,
        is_new_chapter: d.changeClass === "new",
        existing_chapter_id: d.existingId,
        old_body_text: liveMatch?.body_text ?? null,
        new_body_text: removed ? null : (source?.body ?? null),
        old_keywords: liveMatch?.keywords ?? null,
        new_keywords: removed ? null : (source?.searchKeywords ?? null),
        new_content_blocks: removed ? null : (source?.contentBlocks ?? []),
        change_class: d.changeClass,
        identity_match_method: d.identityMatchMethod,
        old_page_start: d.oldPageStart,
        old_page_end: d.oldPageEnd,
        new_page_start: d.newPageStart,
        new_page_end: d.newPageEnd,
        old_source_version: d.oldSourceVersion,
        new_source_version: d.newSourceVersion,
        change_reasons: d.reasons.join(" "),
        // Only unchanged/metadata-only may pre-approve. content_changed, new,
        // removed and renamed_moved ALWAYS require a human.
        approved: isAutoApprovable(d.changeClass),
      };
    });

    for (let i = 0; i < stagedRows.length; i += 100) {
      const { error } = await supabase.from("sync_staged_changes").insert(stagedRows.slice(i, i + 100));
      if (error) throw new WorkerError("STAGING_FAILED", "Could not write the staged changes.");
    }

    // ---- 7. Impact report (90-98%) ----
    await setStage(runId, STAGE.IMPACT);
    const { data: cardRows } = await supabase
      .from("procedure_cards")
      .select("slug, title, chapter_id, source_version, review_status, is_published");
    const workflows = await loadWorkflows();

    const impact = buildImpactReport({
      diffs,
      cards: cardRows ?? [],
      workflows,
      targetVersion: contract.source.version,
    });

    await supabase.from("sync_impact_report").delete().eq("run_id", runId);
    const impactRows = impact.map((i) => ({
      run_id: runId,
      impact_type: i.impactType,
      entity_slug: i.entitySlug,
      entity_title: i.entityTitle,
      current_version: i.currentVersion,
      target_version: i.targetVersion,
      status: i.status,
      reason: i.reason,
      requires_manual_review: i.requiresManualReview,
    }));
    for (let i = 0; i < impactRows.length; i += 100) {
      const { error } = await supabase.from("sync_impact_report").insert(impactRows.slice(i, i + 100));
      if (error) throw new WorkerError("IMPACT_FAILED", "Could not write the impact report.");
    }

    // ---- 8. Archive the PDF and finish (100%) ----
    await rekeyPdf(runId, run.pdf_path, contract.source.version, sha256);

    const changed = diffs.filter((d) => d.changeClass !== "unchanged").length;
    const added = diffs.filter((d) => d.changeClass === "new").length;
    await setStage(runId, STAGE.READY, {
      progress_message: `Ready for review — ${changed} chapter(s) changed`,
      status: "review",
      chapters_changed: changed,
      chapters_added: added,
      source_version: contract.source.version,
      completed_at: new Date().toISOString(),
      error_code: null,
      error_detail: null,
    });
    console.log(`[${runId}] staged: ${diffs.length} rows, ${impactRows.length} impacts`);
  } catch (error) {
    const code = error instanceof WorkerError ? error.code : "EXTRACTION_FAILED";
    const detail = error instanceof WorkerError ? error.message : "Unexpected worker error.";
    await fail(runId, code, detail);
  } finally {
    stopHeartbeat();
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Decision workflows, for impact analysis only. Never mutated. */
async function loadWorkflows() {
  try {
    const mod = await import("../lib/decision-engine/definitions/index.ts");
    return Object.values(mod.DECISION_DEFINITIONS).map((d) => ({
      slug: d.procedureSlug,
      title: d.procedureTitle,
      sourceVersion: d.sourceVersion,
      sourcePages: d.sourcePages ?? [],
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Poll loop — concurrency-safe claim
// ---------------------------------------------------------------------------
async function tick() {
  const { data, error } = await supabase.rpc("claim_sync_run", {
    p_worker_id: WORKER_ID,
    p_stale_after_seconds: STALE_AFTER_SECONDS,
  });
  if (error) {
    console.error("claim_sync_run failed:", error.message);
    return;
  }
  if (!data) return; // queue empty
  const run = Array.isArray(data) ? data[0] : data;
  if (!run?.id) return;
  console.log(`[${run.id}] claimed by ${WORKER_ID}`);
  await processRun(run);
}

async function main() {
  console.log(`PDF Update Studio worker ${WORKER_ID} started (poll ${POLL_INTERVAL_MS}ms)`);
  for (;;) {
    await tick().catch((e) => console.error("tick failed:", e?.message));
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main();
