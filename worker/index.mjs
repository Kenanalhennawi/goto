// PDF Update Studio — background extraction worker (UPD-2 skeleton).
//
// Provider-neutral: runs unchanged on Cloud Run (reference), Fly.io, Render or
// Railway. Uses the service role key, which MUST exist only in the worker
// environment — never in Vercel, NEXT_PUBLIC_*, the client bundle or the
// browser.
//
// This skeleton implements the full job lifecycle, validation, safe temp-file
// handling and state reporting. The extraction call-out (extract.py /
// attach_pdf_links.py) is isolated in `runExtractor()` so the existing scripts
// can be wired in without touching the lifecycle.

import { createClient } from "@supabase/supabase-js";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKER_ID = process.env.WORKER_ID ?? `worker-${process.pid}`;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 15000);
const EXTRACTOR_VERSION = process.env.EXTRACTOR_VERSION ?? "upd2-1";

const BUCKET = "manual-sources";
const MAX_BYTES = 40 * 1024 * 1024;
const MAX_PAGES = 500;

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

async function fail(runId, code, detail) {
  // Safe error surface only: never a stack trace, never a secret.
  console.error(`[${runId}] ${code}: ${detail}`);
  await setState(runId, "failed", 100, "Extraction failed", {
    error_code: code,
    error_detail: String(detail).slice(0, 500),
    completed_at: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function assertPdfMagic(buffer) {
  const header = buffer.subarray(0, 5).toString("latin1");
  if (header !== "%PDF-") throw new Error("File is not a PDF (missing %PDF- header)");
}

function parseManualVersion(firstPageText) {
  // e.g. "Version 81.7 30-Jul-2026"
  const match = firstPageText.match(/Version\s+(\d+\.\d+)\s+(\d{1,2}-[A-Za-z]{3}-\d{4})/);
  if (!match) return { version: null, versionDate: null };
  return { version: match[1], versionDate: match[2] };
}

function compareVersions(a, b) {
  const pa = String(a ?? "").split(".").map(Number);
  const pb = String(b ?? "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Extraction call-out (wire the existing Python scripts here)
// ---------------------------------------------------------------------------
async function runExtractor(pdfPath, outDir) {
  // Intentionally not implemented in the UPD-2 foundation. Wire in:
  //   spawn("python", ["tools/extraction/extract.py", pdfPath, outDir])
  //   spawn("python", ["tools/extraction/attach_pdf_links.py", pdfPath, outDir])
  // Always pass arguments as an ARRAY (never a shell string) so a hostile
  // filename cannot inject a command. pdfPath is a generated temp path, never
  // the user-supplied name.
  void pdfPath;
  void outDir;
  throw new Error("EXTRACTOR_NOT_WIRED");
}

// ---------------------------------------------------------------------------
// One job
// ---------------------------------------------------------------------------
async function processRun(run) {
  const runId = run.id;
  let workDir = null;

  try {
    workDir = await mkdtemp(join(tmpdir(), "goto-sync-"));

    // 1. Download the stored PDF (service role, private bucket).
    await setState(runId, "validating", 10, "Downloading uploaded PDF");
    const { data: blob, error: dlError } = await supabase.storage
      .from(BUCKET)
      .download(run.pdf_path);
    if (dlError || !blob) throw new Error("Could not download the uploaded PDF");

    const buffer = Buffer.from(await blob.arrayBuffer());

    // 2. Validate.
    if (buffer.byteLength === 0) throw new Error("Uploaded file is empty");
    if (buffer.byteLength > MAX_BYTES) throw new Error("Uploaded file exceeds 40 MB");
    assertPdfMagic(buffer);

    const sha256 = createHash("sha256").update(buffer).digest("hex");
    if (run.pdf_sha256 && run.pdf_sha256 !== sha256) {
      throw new Error("Uploaded file hash does not match the recorded hash");
    }

    const pdfPath = join(workDir, "manual.pdf");
    await writeFile(pdfPath, buffer);

    await setState(runId, "validating", 25, "Validating manual version", {
      pdf_sha256: sha256,
    });

    // 3. Duplicate / older-version policy (override must be explicit + audited).
    const { data: current } = await supabase
      .from("sync_runs")
      .select("pdf_version")
      .eq("state", "published")
      .order("completed_at", { ascending: false })
      .limit(1);
    const currentVersion = current?.[0]?.pdf_version ?? null;

    // parseManualVersion() consumes text produced by the extractor; the
    // skeleton stops before that point.
    void parseManualVersion;
    void compareVersions;
    void currentVersion;
    void MAX_PAGES;

    // 4. Extract.
    await setState(runId, "extracting", 45, "Extracting chapters");
    await runExtractor(pdfPath, join(workDir, "output"));

    // 5..8 — classify (lib/sync-diff.ts), stage rows, build the impact report
    // (lib/sync-impact.ts), re-key the object to v{version}/{sha256}.pdf, then:
    // await setState(runId, "staged", 100, "Ready for review", {
    //   extractor_version: EXTRACTOR_VERSION,
    //   completed_at: new Date().toISOString(),
    // });
    void EXTRACTOR_VERSION;
  } catch (error) {
    const code = String(error?.message) === "EXTRACTOR_NOT_WIRED" ? "EXTRACTOR_NOT_WIRED" : "EXTRACTION_FAILED";
    await fail(runId, code, error?.message ?? "Unknown error");
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Poll loop — concurrency-safe claim
// ---------------------------------------------------------------------------
async function tick() {
  const { data, error } = await supabase.rpc("claim_sync_run", { p_worker_id: WORKER_ID });
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
