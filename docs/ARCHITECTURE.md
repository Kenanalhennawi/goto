# PDF Update Studio — Architecture

Written so a senior engineer can understand the whole system without reading the
project history.

## The product outcome

An administrator uploads a PDF, waits, reviews what changed, clicks Publish.
No SQL, no terminal, no scripts, no worker to start by hand.

## The system in one picture

```
Admin browser
  │  1. signed upload URL (admin session, storage RLS applies)
  ▼
Supabase Storage  (private bucket "manual-sources", PDF-only, 40 MB)
  │
  ▼
sync_runs row, state = 'queued'          ← created by the API
  │
  ├─ 2. API calls GitHub repository_dispatch (server-side, hardcoded event)
  │       success/failure recorded on the run as dispatch_* telemetry
  ▼
GitHub Actions job  (free; Node 22 + Python + Poppler)
  ├─ claim_sync_run()  (FOR UPDATE SKIP LOCKED — two jobs never collide)
  ├─ download → validate → extract → classify → stage
  ├─ heartbeat while in flight  → sync_worker_heartbeat
  ├─ --drain: repeat until queue empty or time budget spent
  └─ state = 'staged', job exits
  │
  ▼
Review screen (live progress, polls while active)
  │
  ▼
publish_sync_run()  — ONE transaction
  lock run → re-check every rule → apply chapters → mark published
```

Behind that, a scheduled workflow runs every ~5 minutes and drains anything the
dispatch missed.

## Why processing is a job, not a service

The worker needs Python, Poppler and minutes of runtime on a ~20 MB, 356-page
PDF. That exceeds Vercel's request-body limit and function ceiling, so it cannot
live in the web app.

It used to be a **Render Background Worker**. Render's free compute covers web
services, Key Value and Postgres only — background workers start at **$7/month**
— and a free Render *web* service spins down after inactivity, which is fatal
for a queue poller that receives no inbound HTTP. GitHub Actions runs the same
stack for free, so the worker became a finite job with `--once` / `--drain`
modes. The trade is honest: there is no always-on process, so a dispatch is
needed to start work, and a scheduled sweep exists to catch missed dispatches.

The Actions job is the only component holding the service-role key.

## Eight invariants

These are the whole design. Everything else is detail.

1. **One lifecycle field.** `sync_runs.state` is authoritative. `status` is
   deprecated, mirrored unconditionally by a trigger, and written by no
   application code.
2. **One threshold.** `sync_settings.mass_reclassification_limit`. SQL reads it
   via `sync_setting()`; the UI reads it from the same row.
3. **One publish transaction.** `publish_sync_run()`. Nothing else writes
   chapters as part of a publish.
4. **Override columns are owner-only, structurally.** A trigger rejects any
   write to `reclass_override_*` that does not come from the owner-authorised
   RPCs. RLS cannot do this — RLS is row-level and cannot constrain columns.
5. **Every recovery action is an RPC.** Cancel, reprocess, discard, restore. No
   routine operation requires SQL.
6. **RLS is one non-overlapping matrix**, one policy per verb.
7. **The database claim is the only concurrency authority.** `claim_sync_run()`
   uses `FOR UPDATE SKIP LOCKED`. Workflow `concurrency:` groups exist to avoid
   wasting free compute, **not** to provide correctness. Never weaken the claim
   on the assumption the group is enough.
8. **The health model never claims a process is alive.** See below.

## Authorization matrix (`sync_runs`)

| role | SELECT | INSERT | UPDATE | DELETE | set override | publish |
|---|---|---|---|---|---|---|
| owner | yes | yes | yes | yes | via RPC only | yes |
| admin | yes | yes | yes | yes | **no** | yes |
| quality | yes | no | no | no | **no** | no |
| editor | yes | no | no | no | **no** | no |
| agent | no | no | no | no | no | no |
| anon | no | no | no | no | no | no |
| service_role | bypasses RLS — job only | | | | **no** | no |

Verified against the live staging database with real per-user JWT claims, and
against `service_role`, which bypasses RLS and is therefore stopped only by the
column guard.

**A correction to earlier documentation.** A previous version of this file said
production carried a `"Quality+ manage sync runs"` **FOR ALL** policy that
silently granted quality write and delete. That policy **did** exist
historically and was genuinely dangerous — permissive policies combine with OR,
so it was a superset defeating every narrower policy. It is **not present in
production today**; production currently has four policies, and the
consolidation migration replaces them with the non-overlapping set above. The
migration still drops it by name so a database that predates the fix converges.

## Health: what the UI may and may not say

There is no permanent process, so the UI must not imply one. `workerOnline` was
removed. Reporting it under Actions would read "offline" during completely
normal idle periods, which destroys the signal — a real outage would look
exactly like a quiet afternoon.

`GET /api/sync/health` reports what is actually knowable:

| field | meaning |
|---|---|
| `dispatcherConfigured` | this deployment holds a dispatch credential |
| `recoveryScheduleConfigured` | the scheduled sweep is part of this build |
| `lastDispatchAttemptAt` / `lastDispatchSuccessAt` | did asking for processing work |
| `lastDispatchErrorCode` | short code from a closed set; never a GitHub body |
| `queueDepth` / `oldestQueuedAt` | is anything waiting |
| `stuckQueuedCount` | waiting past `dispatch_grace_seconds` — the real alarm |
| `activeRun` | a job is genuinely mid-flight |
| `lastProcessingActivityAt` | recent activity; **not** liveness |
| `migrationReady` / `processingSystemReady` | can an upload succeed at all |

Permitted phrasing: "Processing system ready", "Processing requested", "Queue
waiting for dispatcher", "Scheduled recovery available".
Forbidden: "Worker online", "Heartbeat online", "Background process healthy".

## Lifecycle states

`uploaded → queued → validating → extracting → staged → publishing → published`,
with `failed` and `cancelled` as terminal branches. The UI shows plain language
("Reading chapters", "Ready for review"); internal names never reach the screen.

## Failure handling

| Condition | Detection | Administrator sees |
|---|---|---|
| Dispatch failed | `dispatch_error_code` on the run | "Your PDF is saved and the scheduled check will process it" — upload still succeeds |
| Dispatcher unconfigured | `dispatcherConfigured: false` | Same, plus "tell engineering" |
| Nothing picked it up | `stuckQueuedCount > 0` past the grace period | "Waiting longer than expected… safe… scheduled check will process them" |
| Migration pending | RPC returns `PGRST202` | "The database is still being updated" |
| Job evicted mid-run | `claim_sync_run` reclaims past the heartbeat cutoff | run resumes or fails with a reason |
| Transient failure | `requeue_sync_run`, bounded by `max_attempts` | automatic retry |
| Mass reclassification | ratios vs `sync_settings` limit | publish blocked, owner override required |
| Publish interrupted | run left in `publishing` | "Return to review" button |

Every one of these previously required a person to read a log file and write SQL.

## Duplicate uploads

`sync_runs_active_hash_idx` is a partial UNIQUE index on `pdf_sha256` covering
the active states. The same PDF cannot be queued twice while a run is live. This
is a database guarantee, not an application check.

## What was deliberately deleted

- `render.yaml` and the paid always-on worker. Replaced by GitHub Actions.
- The permanent service heartbeat loop as a *liveness* signal. The heartbeat is
  retained only so `claim_sync_run` can reclaim abandoned runs.
- `claim_sync_run_for_publish` / `release_sync_run_publish_claim` — the release
  function was granted to `authenticated` with no role check, so any principal
  could move a run out of `publishing`. The atomic publish removes the state
  they existed to manage.
- The vulnerable six-argument `publish_sync_run`, which accepted a
  client-supplied editor UUID and let any admin forge attribution.
- The stale one-argument `claim_sync_run`, which had no stale-run reclaim.
- The admin UI's "local sync" runbook, which instructed a non-technical
  administrator to run Python and export a service-role key — and pointed at a
  script that did not exist.
