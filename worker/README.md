# PDF Update Studio — background worker

Provider-neutral extraction worker for the GO TO manual sync (UPD-2).

**Reference deployment: Google Cloud Run** (container, scale-to-zero, no request
timeout ceiling for jobs, Python + Node in one image). The job contract below is
plain Postgres + Supabase Storage, so Fly.io / Render / Railway workers run the
same code unchanged — only the deployment manifest differs.

Extraction deliberately does **not** run in Vercel functions: a ~20 MB, 356-page
PDF exceeds the ~4.5 MB request-body limit and the function execution ceiling,
and the extractor needs Python plus Poppler.

## Job contract

| Step | Action |
|---|---|
| 1 | `select public.claim_sync_run('<worker-id>')` — `FOR UPDATE SKIP LOCKED`, so two workers never take the same run. Returns `null` when the queue is empty. |
| 2 | Download `pdf_path` from the private `manual-sources` bucket (service role). |
| 3 | Validate: magic bytes `%PDF-`, MIME, size ≤ 40 MB, page count, title/version/date, revision-control table, duplicate + older-version rules. |
| 4 | `state = 'extracting'`; run the existing `extract.py` + `attach_pdf_links.py`. |
| 5 | Normalize, then `classifyExtraction()` from `lib/sync-diff.ts` against the live chapters. |
| 6 | Insert `sync_staged_changes` rows including `change_class`, `identity_match_method`, page ranges and versions. |
| 7 | `buildImpactReport()` from `lib/sync-impact.ts` → insert `sync_impact_report`. |
| 8 | Re-key the stored object to `v{version}/{sha256}.pdf`, then `state = 'staged'`, `progress_pct = 100`. |
| 9 | On any failure: `state = 'failed'` with a safe `error_code` + `error_detail`. Never write stack traces or secrets. |

The worker **never** touches `procedure_cards`, decision trees or tree versions.
Chapter publication remains the admin-triggered `publish_sync_chapters()` RPC.

## State machine

```
uploaded → queued → validating → extracting → staged → publishing → published
                         │            │           │          │
                         └────────────┴───────────┴──────────┴──→ failed
                                                            (or) → cancelled
```

Retries never mutate a failed run: a new run is created with
`retry_of_run_id` pointing at it, reusing the already-stored PDF.

## Environment

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Worker only.** Never in Vercel, `NEXT_PUBLIC_*`, the client bundle, or browser storage. |
| `WORKER_ID` | Identifier recorded in `sync_runs.claimed_by` |
| `POLL_INTERVAL_MS` | Queue poll interval (default 15000) |
| `EXTRACTOR_VERSION` | Must match `EXTRACTOR_VERSION` in `lib/sync-upload.ts` |

## Safety rules

- Never pass a user-supplied filename into a shell command. Download to a
  generated temp path (`mkdtemp`), operate on that, and delete the directory in
  a `finally` block.
- Validate before extracting; reject duplicates (same SHA-256) and versions
  lower than or equal to production unless the run carries an `override_reason`.
- Cap work: 40 MB, ≤ 500 pages.
- All progress updates are bounded 0–100 (enforced by a CHECK constraint).

## Local run

```bash
cd worker
npm install          # or: pip install -r requirements.txt for the extractor
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... WORKER_ID=local node index.mjs
```
