// UPD-2 — PDF Update Studio foundation checks.
// Run with: node scripts/check-upd2-sync.mjs
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));

const { classifyExtraction, summarizeDiffs, isAutoApprovable, normalizeBody, chapterContentHash } =
  await import("../lib/sync-diff.ts");
const { buildImpactReport, readiness, versionOf } = await import("../lib/sync-impact.ts");
const { validateUploadRequest, pendingUploadPath, archivedPdfPath, MAX_PDF_BYTES } = await import(
  "../lib/sync-upload.ts"
);

const migration = read("supabase/migrations/20260802000000_pdf_update_studio.sql");
const uploadRoute = read("app/api/sync/upload-url/route.ts");
const runsRoute = read("app/api/sync/runs/route.ts");
const syncPage = read("app/admin/sync/page.tsx");
const uploadPanel = read("components/admin/PdfUploadPanel.tsx");
const workerSrc = read("worker/index.mjs");

// ===========================================================================
// 1. Upload validation
// ===========================================================================
const good = { fileName: "The_GO_TO_document.pdf", fileSize: 20_000_000, mimeType: "application/pdf" };
assert.equal(validateUploadRequest(good).ok, true);
for (const [bad, code] of [
  [{ ...good, mimeType: "image/png" }, "INVALID_MIME"],
  [{ ...good, fileName: "manual.exe" }, "INVALID_EXTENSION"],
  [{ ...good, fileSize: 0 }, "EMPTY_FILE"],
  [{ ...good, fileSize: MAX_PDF_BYTES + 1 }, "FILE_TOO_LARGE"],
  [{ ...good, fileName: "" }, "INVALID_FILENAME"],
  [null, "INVALID_BODY"],
]) {
  const res = validateUploadRequest(bad);
  assert.equal(res.ok, false, `${code} must be rejected`);
  assert.equal(res.errorCode, code);
}
assert.equal(MAX_PDF_BYTES, 40 * 1024 * 1024, "limit must be 40 MB");

// Storage keys must never carry a hostile filename out of the prefix.
const hostile = pendingUploadPath("u1", "../../etc/passwd.pdf");
assert.ok(hostile.startsWith("pending/u1/"), "path must stay inside the user prefix");
assert.ok(!hostile.includes(".."), "path traversal must be neutralised");
assert.ok(!/[^a-zA-Z0-9/_.-]/.test(hostile), "path must be shell/URL safe");
assert.equal(archivedPdfPath("81.7", "a".repeat(64)), `v81.7/${"a".repeat(64)}.pdf`);

// ===========================================================================
// 2. API authorization + no service-role leakage
// ===========================================================================
assert.ok(uploadRoute.includes("requireAdmin"), "upload-url must be admin-guarded");
assert.ok(runsRoute.includes("requireAdmin"), "runs route must be admin-guarded");
// No web-app file may READ or embed a service-role key. (Prose telling an
// operator to set it in their own shell for the emergency fallback is fine.)
for (const [name, src] of [["upload-url", uploadRoute], ["runs", runsRoute], ["panel", uploadPanel], ["sync page", syncPage]]) {
  assert.ok(!/process\.env\.[A-Z_]*SERVICE_ROLE/i.test(src), `${name} must not read a service-role key`);
  assert.ok(!/createClient\([^)]*SERVICE_ROLE/i.test(src), `${name} must not build a service-role client`);
  assert.ok(!/NEXT_PUBLIC_[A-Z_]*SERVICE/i.test(src), `${name} must not expose a service key publicly`);
  assert.ok(!/eyJ[A-Za-z0-9_-]{20,}/.test(src), `${name} must not embed a JWT`);
}
// The signed URL is created with the ADMIN'S session, so storage RLS applies.
assert.ok(uploadRoute.includes("createSignedUploadUrl"), "must mint a signed upload URL");
assert.ok(uploadRoute.includes('"Cache-Control": "private, no-store"'), "upload URL must not be cached");
assert.ok(runsRoute.includes("DUPLICATE_ACTIVE_RUN"), "duplicate active runs must be rejected");
assert.ok(runsRoute.includes("overrideReason"), "override must be explicit");
assert.ok(runsRoute.includes('state: "queued"'), "new runs are queued for the worker");
// The API must never publish or approve anything.
for (const src of [uploadRoute, runsRoute]) {
  assert.ok(!/procedure_cards/.test(src), "sync APIs must not touch procedure cards");
  assert.ok(!/is_published\s*:\s*true/.test(src), "sync APIs must not publish");
  assert.ok(!/review_status\s*:\s*['"]approved/.test(src), "sync APIs must not approve");
}

// ===========================================================================
// 3. Diff classification
// ===========================================================================
const live = [
  { id: "c1", slug: "pregnancy", title: "42. Pregnancy", chapter_number: 42, body_text: "Single 0-28 no certificate.", keywords: ["pregnancy"], page_start: 259, page_end: 259, source_version: "81.2" },
  { id: "c2", slug: "wheelchair", title: "34. Wheelchair", chapter_number: 34, body_text: "WCHR ramp assistance.", keywords: ["wchr"], page_start: 165, page_end: 170, source_version: "81.2" },
  { id: "c3", slug: "old-topic", title: "99. Retired Topic", chapter_number: 99, body_text: "Obsolete.", keywords: [], page_start: 300, page_end: 300, source_version: "81.2" },
];

const incoming = [
  // unchanged
  { title: "42. Pregnancy", slug: "pregnancy", chapter_number: 42, body_text: "Single 0-28 no certificate.", keywords: ["pregnancy"], page_start: 259, page_end: 259, source_version: "81.2" },
  // metadata_only: identical body, shifted pages + number + version
  { title: "35. Wheelchair", slug: "wheelchair", chapter_number: 35, body_text: "WCHR ramp assistance.", keywords: ["wchr"], page_start: 164, page_end: 169, source_version: "81.7" },
  // new
  { title: "34. Accessibility", slug: "accessibility", chapter_number: 34, body_text: "Seat allocation guidance.", keywords: [], page_start: 163, page_end: 163, source_version: "81.7" },
];

const diffs = classifyExtraction(incoming, live, "81.7");
const bySlug = Object.fromEntries(diffs.map((d) => [d.slug, d]));
assert.equal(bySlug["pregnancy"].changeClass, "unchanged");
assert.equal(bySlug["wheelchair"].changeClass, "metadata_only", "page/number shift is metadata-only");
assert.equal(bySlug["wheelchair"].oldPageStart, 165);
assert.equal(bySlug["wheelchair"].newPageStart, 164);
assert.equal(bySlug["accessibility"].changeClass, "new");
assert.equal(bySlug["old-topic"].changeClass, "removed", "missing chapter must be detected as removed");
assert.equal(bySlug["old-topic"].existingId, "c3");

// content_changed
const changed = classifyExtraction(
  [{ title: "42. Pregnancy", slug: "pregnancy", chapter_number: 42, body_text: "Single 0-30 no certificate.", keywords: ["pregnancy"], page_start: 259, page_end: 259 }],
  [live[0]],
  "81.7"
);
assert.equal(changed[0].changeClass, "content_changed");

// renamed_moved: same content, materially different title
const renamed = classifyExtraction(
  [{ title: "42. Expectant Mothers", slug: "pregnancy", chapter_number: 43, body_text: "Single 0-28 no certificate.", keywords: ["pregnancy"], page_start: 257, page_end: 257 }],
  [live[0]],
  "81.7"
);
assert.equal(renamed[0].changeClass, "renamed_moved");

// Middle insertion + renumbering must NOT read as content change.
const shifted = classifyExtraction(
  [{ title: "35. Wheelchair", slug: "wheelchair", chapter_number: 35, body_text: "WCHR ramp assistance.", keywords: ["wchr"], page_start: 164, page_end: 169 }],
  [live[1]],
  "81.7"
);
assert.equal(shifted[0].changeClass, "metadata_only", "renumbering alone is metadata-only");

// Normalization: reflowed whitespace/case is not a change.
assert.equal(normalizeBody("  WCHR   Ramp\nAssistance. "), normalizeBody("wchr ramp assistance."));
assert.equal(
  chapterContentHash({ body_text: "A  b", keywords: ["X"] }),
  chapterContentHash({ body_text: "a b", keywords: ["x"] })
);

const summary = summarizeDiffs(diffs);
assert.equal(summary.unchanged + summary.metadata_only + summary.new + summary.removed, diffs.length);

// Only safe classes may be bulk-approved.
assert.equal(isAutoApprovable("unchanged"), true);
assert.equal(isAutoApprovable("metadata_only"), true);
for (const c of ["content_changed", "new", "removed", "renamed_moved"]) {
  assert.equal(isAutoApprovable(c), false, `${c} must never be auto-approvable`);
}

// ===========================================================================
// 4. Impact report
// ===========================================================================
const cards = [
  { slug: "pregnancy", title: "Pregnancy", chapter_id: "c1", source_version: "81.2 (10-Jul-2026)", review_status: "approved", is_published: true },
  { slug: "wheelchair", title: "Wheelchair", chapter_id: "c2", source_version: "81.2 (10-Jul-2026)", review_status: "approved", is_published: true },
  { slug: "legacy", title: "Legacy", chapter_id: "c3", source_version: "81.2", review_status: "approved", is_published: true },
];
const workflows = [
  { slug: "wheelchair", title: "Wheelchair", sourceVersion: "81.7 (30-Jul-2026)", sourcePages: [164, 165] },
  { slug: "pregnancy", title: "Pregnancy", sourceVersion: "81.7 (30-Jul-2026)", sourcePages: [257] },
];
const impact = buildImpactReport({ diffs, cards, workflows, targetVersion: "81.7 (30-Jul-2026)" });

assert.equal(versionOf("81.7 (30-Jul-2026)"), "81.7");
const removedChapterItem = impact.find((i) => i.impactType === "chapter" && i.entitySlug === "old-topic");
assert.equal(removedChapterItem.status, "blocked", "removed chapters block completion");
const legacyCard = impact.find((i) => i.impactType === "procedure_card" && i.entitySlug === "legacy");
assert.equal(legacyCard.status, "blocked", "card linked to a removed chapter is blocked");
// The v81.2 -> v81.7 drift that disabled every workflow must be reported.
const wfImpact = impact.find((i) => i.impactType === "workflow" && i.entitySlug === "wheelchair");
assert.ok(wfImpact, "workflow impact must be reported");
assert.ok(/does not match the tree version/.test(wfImpact.reason), "version mismatch must be named");
assert.equal(wfImpact.requiresManualReview, true);
// New source topic without a card.
assert.ok(impact.some((i) => i.impactType === "orphaned_source" && i.entitySlug === "accessibility"));
// Readiness blocks while anything is blocked.
const state = readiness(impact);
assert.equal(state.canComplete, false, "blocked items must prevent completion");
assert.equal(readiness([{ status: "review" }, { status: "ok" }]).canComplete, true);
// Impact analysis must never mutate its inputs.
assert.equal(cards[0].review_status, "approved");
assert.equal(workflows[0].sourceVersion, "81.7 (30-Jul-2026)");

// ===========================================================================
// 5. Migration: schema, constraints, RLS, storage, claim
// ===========================================================================
for (const col of [
  "pdf_path", "pdf_sha256", "pdf_page_count", "pdf_version", "pdf_version_date",
  "original_filename", "uploaded_by", "state", "progress_pct", "progress_message",
  "error_code", "error_detail", "retry_of_run_id", "extractor_version",
  "started_at", "completed_at",
]) {
  assert.ok(migration.includes(col), `sync_runs must add ${col}`);
}
for (const col of [
  "change_class", "identity_match_method", "old_page_start", "old_page_end",
  "new_page_start", "new_page_end", "old_source_version", "new_source_version",
]) {
  assert.ok(migration.includes(col), `sync_staged_changes must add ${col}`);
}
for (const state of ["uploaded", "queued", "validating", "extracting", "staged", "publishing", "published", "failed", "cancelled"]) {
  assert.ok(migration.includes(`'${state}'`), `state ${state} must be allowed`);
}
assert.ok(/progress_pct >= 0 and progress_pct <= 100/.test(migration), "progress must be bounded 0-100");
assert.ok(migration.includes("retry_of_run_id uuid references public.sync_runs(id)"), "retry FK required");
assert.ok(migration.includes("sync_runs_active_hash_idx"), "duplicate active hash must be prevented");
assert.ok(migration.includes("create table if not exists public.sync_impact_report"), "impact report table required");
for (const t of ["chapter", "procedure_card", "workflow", "search_term", "orphaned_source"]) {
  assert.ok(migration.includes(`'${t}'`), `impact type ${t} must be allowed`);
}
// RLS pinned in version control, no anon access.
assert.ok(!/disable row level security/i.test(migration), "must never disable RLS");
for (const t of ["sync_runs", "sync_staged_changes", "sync_impact_report"]) {
  assert.ok(migration.includes(`alter table public.${t} enable row level security`), `${t} RLS`);
  assert.ok(migration.includes(`revoke all on public.${t} from anon`), `${t} anon revoke`);
}
assert.ok(migration.includes('"Quality+ can update staged sync changes"'), "reviewer approve policy pinned");
assert.ok(migration.includes('"Admin+ can insert sync runs"'), "admin insert policy pinned");
// Private bucket.
assert.ok(/insert into storage\.buckets[\s\S]*'manual-sources'[\s\S]*false/.test(migration), "bucket must be private");
assert.ok(migration.includes("allowed_mime_types") && migration.includes("application/pdf"), "bucket restricted to PDF");
assert.ok(migration.includes('"Admin+ can upload manual sources"'), "storage upload policy required");
assert.ok(!/storage[\s\S]*to anon/.test(migration), "no anonymous storage policy");
// Concurrency-safe claim, worker-only.
assert.ok(migration.includes("for update skip locked"), "claim must use FOR UPDATE SKIP LOCKED");
assert.ok(migration.includes("grant execute on function public.claim_sync_run(text) to service_role"), "claim is worker-only");
assert.ok(/revoke all on function public\.claim_sync_run\(text\) from public, anon, authenticated/.test(migration), "claim must be revoked from users");
// Publishing semantics untouched.
assert.ok(!/publish_sync_chapters/.test(migration.replace(/--.*$/gm, "")), "must not redefine the publish RPC");
assert.ok(!/procedure_cards/.test(migration.replace(/--.*$/gm, "")), "migration must not touch procedure cards");

// ===========================================================================
// 6. Admin UI
// ===========================================================================
assert.ok(syncPage.includes("PdfUploadPanel"), "upload panel must be mounted");
assert.ok(syncPage.includes("Recent sync runs"), "run history required");
assert.ok(syncPage.includes('role="progressbar"'), "progress must be reported");
assert.ok(syncPage.includes("canManageUsers"), "upload restricted to admin/owner");
// Obsolete machine paths are gone; the fallback is repository-relative.
assert.ok(!syncPage.includes("goto-manual-project"), "obsolete hard-coded path removed");
assert.ok(!/C:\\\\/.test(syncPage), "no Windows machine paths");
assert.ok(syncPage.includes("Advanced: local sync"), "collapsed fallback retained");
assert.ok(syncPage.includes("./tools/extraction/extract.py"), "fallback must be repository-relative");
assert.ok(uploadPanel.includes("uploadToSignedUrl"), "browser uploads directly to storage");
assert.ok(uploadPanel.includes("40 MB"), "size limit surfaced to the admin");

// ===========================================================================
// 7. Worker contract
// ===========================================================================
assert.ok(exists("worker/README.md"), "worker contract documented");
assert.ok(workerSrc.includes("claim_sync_run"), "worker must claim via the RPC");
assert.ok(workerSrc.includes("mkdtemp"), "worker must use safe temp directories");
assert.ok(/finally[\s\S]{0,120}rm\(workDir/.test(workerSrc), "temp dir must always be removed");
assert.ok(workerSrc.includes("assertPdfMagic"), "worker must verify PDF magic bytes");
assert.ok(!/procedure_cards/.test(workerSrc), "worker must not touch procedure cards");
assert.ok(!/exec\(|execSync\(/.test(workerSrc), "worker must not use shell string execution");
const readme = read("worker/README.md");
assert.ok(/Cloud Run/.test(readme), "reference platform documented");
assert.ok(/never in Vercel|Never in Vercel/i.test(readme), "service-role handling documented");

// ===========================================================================
// 8. Existing publish flow untouched
// ===========================================================================
const publishRoute = read("app/api/sync/[id]/publish/route.ts");
assert.ok(publishRoute.includes("requireAdmin"), "publish stays admin-guarded");
assert.ok(publishRoute.includes("publish_sync_chapters"), "atomic publish RPC unchanged");
assert.ok(publishRoute.includes("buildPublishPlan"), "publish plan unchanged");

console.log("UPD-2 PDF Update Studio checks passed.");
