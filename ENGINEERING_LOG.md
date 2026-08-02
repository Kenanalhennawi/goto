# Engineering Log

Running record of issues, fixes, migrations, verifications and open blockers.
Newest session first. Every entry states root cause, impact and verification.

---

## Session PUB-1 / HYG-1 — 2026-08-02

Publish-path safety, sync-run lifecycle integrity, repository hygiene.

### PUB-1.1 — The mass-reclassification guard was never enforced (CRITICAL)

**Root cause.** `evaluateReclassificationGuard()` (UPD-2.7) was used in exactly
two places: the worker, to persist `new_ratio` / `removed_ratio`, and
`app/admin/sync/[id]/page.tsx`, to decide whether to *render* a publish button.
`POST /api/sync/[id]/publish` performed no check whatsoever. The route loaded
only `source_version` from `sync_runs`, so it could not have checked even if it
wanted to.

**Why it happened.** The guard was introduced as a *review-screen* feature. The
control was placed at the presentation layer, where it reads as complete —
`SyncRunSummary` even renders the sentence "Publishing is disabled until an owner
records an audited override." Nothing in the codebase made that sentence true.
The review screen also re-implemented the threshold with its own `0.2` literal
rather than importing `MASS_RECLASSIFICATION_THRESHOLD`, so the UI and the
(absent) server rule could drift independently.

**Impact.** Any admin could publish a run the guard had flagged by issuing the
POST directly — no override, no owner, no audit trail. This is precisely the
v81.7 scenario UPD-2.7 was built to prevent: 78 new / 79 removed chapters, which
would have replaced essentially the entire live manual. Severity is operational,
not merely theoretical: the failing run still exists in the database, staged.

**Fix.** New `lib/sync-publish-gate.ts` — a pure, dependency-free evaluator that
is the single source of truth for "may this run be published?". The publish route
enforces it before loading staged rows or calling the publish RPC, answering
`409` with a stable `errorCode`. The review screen consumes the same function, so
the button state and the server decision cannot disagree.

**Regression analysis.** `check-upd27-identity.mjs` asserted the literal old
expression `canPublish = canManageUsers(role?.role) && !reclassBlocked`. That
assertion was updated to the new expression **and** strengthened with a
behavioural check that a mass-reclassified run fails the gate — the guarantee,
not the syntax. `gate.ok` is strictly stronger than `!reclassBlocked`.

### PUB-1.2 — `sync_runs` carried two divergent lifecycle columns (CRITICAL)

**Root cause.** `sync_runs` has `state` (added by UPD-2, vocabulary pinned by
`sync_runs_state_check`) *and* a legacy `status` column pinned by
`sync_runs_status_check` — a constraint defined in the original schema and
present in **no migration in this repository**. Application code wrote both, from
three sites, using values from the `state` vocabulary that the `status`
constraint had never been taught to accept.

**Observed production failure** (`worker-error.log`, run `04063edf`):

```
[04063edf-…] state update failed: new row for relation "sync_runs"
violates check constraint "sync_runs_status_check"
```

The run had already staged 81 chapters and 154 impact rows correctly. Only the
final transition was rejected, leaving a fully successful extraction looking
unfinished. `'pending'` happened to be legal, which is why run *creation* always
worked and only later transitions failed — masking the problem until the last
step of a long job.

**Impact.**
1. Completed extractions were left stranded mid-lifecycle.
2. `markRunPublished()` set **only** `status`, never `state`. Every surface that
   resolves `state ?? status` therefore showed a fully published run as still
   `staged` and offered to publish it **again** — a double-apply hazard against
   live chapter content.
3. `status: 'published'` is very likely outside the legacy vocabulary too, in
   which case publishing returned HTTP 500 *after* chapters were already written,
   inviting exactly the retry that double-applies.
4. The no-op publish path ignored the error from `markRunPublished()` entirely
   and reported success.

**Fix.**
- Migration `20260805000000_sync_run_status_reconciliation.sql` widens
  `sync_runs_status_check` to a superset of both vocabularies, added `NOT VALID`
  then validated separately so an unforeseen legacy value can never abort the
  migration.
- The invariant `status = state` is enforced by a `BEFORE INSERT OR UPDATE`
  trigger, **not** by convention. This is the decisive point: `state` is written
  by `claim_sync_run()` and `requeue_sync_run()` in SQL, which bypass every
  application code path. A trigger is the only place that observes all writers.
- The migration repairs rows the pre-fix publish path left inconsistent, in both
  directions.
- `markRunPublished()` now writes both columns plus progress and timestamps.
- The worker's `setState()` mirrors `state` into `status`; the hardcoded
  `status: "pending"` literal is gone.

**Deployment ordering.** The migration MUST be applied before the worker is
deployed. The worker now sends `status = state` (e.g. `'staged'`), which the
un-widened legacy constraint would reject.

### PUB-1.3 — Publish had no preconditions or idempotency

**Root cause.** The route verified the caller's role and nothing about the run.

**Impact.** A `failed`, `cancelled`, `queued` or still-`extracting` run could be
published. An already-published run could be published again.

**Fix.** `evaluatePublishGate()` enforces, in order: already-published (terminal,
checked first so the operator gets the accurate reason), publishable lifecycle
state, then the reclassification guard.

### HYG-1.1 — CRLF churn was hiding real changes (HIGH)

**Root cause.** No `.gitattributes`. A Windows tool rewrote 21 tracked files from
LF to CRLF.

**Impact.** `git diff` showed 8,629 insertions / 8,533 deletions across 22 files,
of which **113 lines were real**. This is not cosmetic — it is a review-integrity
failure, and it has already caused a defect: commit `9339835` ("Use pending
status for staged sync runs", 15 real lines) silently carried a full-file
re-encode that turned every em dash in `worker/index.mjs` into mojibake, needing
commit `1081ae4` to undo. A reviewer could not have spotted that.

**Fix.** `.gitattributes` pins `* text=auto eol=lf`, marks binaries, and collapses
lockfiles in review. All 21 files normalised to LF. `scripts/check-hygiene.mjs`
fails the build on any CRLF or mojibake in tracked text.

### HYG-1.2 — The documented emergency fallback was broken

**Root cause.** The "Advanced: local sync (emergency fallback)" panel on
`/admin/sync` instructed operators to run `./tools/sync/sync.mjs`. That file does
not exist; `tools/` contains only `extraction/`.

**Impact.** The disaster-recovery procedure failed at exactly the moment it would
be needed — when the background worker is unavailable.

**Fix.** Rewritten to drain the queue with the real worker (`cd worker && npm
start` with the service-role key confined to that shell), which is the identical
code path the deployed worker uses and is proven to work. `check-upd2-sync.mjs`
now asserts the fallback invokes the actual worker and rejects any reference to
the non-existent script, any absolute machine path, and any literal credential.

### HYG-1.3 — Untracked artifact and lockfile risks

- `worker-*.log` (contains run ids, filenames, database error text),
  `chapters.json`, `existing-chapters.json` and `*.pdf` were not ignored.
- Two lockfiles: tracked `package-lock.json` plus a stray `pnpm-lock.yaml`, with
  `pnpm-workspace.yaml` still holding unconfigured placeholders ("set this to
  true or false") that would fail a pnpm install. Two lockfiles make the
  deployment platform's package-manager detection ambiguous.

**Fix.** All added to `.gitignore` with a documented, reversible decision that
npm is canonical. `check-hygiene.mjs` asserts exactly one tracked lockfile.

### Corrections made to my own work this session

- A comment in the new migration named `reclaim_stale_runs()` as a writer of
  `state`. **No such function exists** — `claim_sync_run()` performs the stale-run
  reclaim inline. Comment corrected; a wrong comment in a migration is a
  landmine for whoever reads it next.
- Three of my own new assertions initially matched prose rather than code (a
  safety comment reading "no DROP TABLE, no DELETE"; a runbook naming
  `SUPABASE_SERVICE_ROLE_KEY`). Each was **tightened** — strip SQL comments before
  scanning; match key *usage* (`process.env.*SERVICE_ROLE`, `createClient(...)`)
  rather than the variable's name — never weakened.

### Files changed

| File | Change |
|---|---|
| `lib/sync-publish-gate.ts` | **New.** Single source of truth for publish preconditions. |
| `app/api/sync/[id]/publish/route.ts` | Enforce the gate; write both lifecycle columns; check the no-op update error. |
| `app/admin/sync/[id]/page.tsx` | Consume the shared gate; remove the duplicated `0.2` literal. |
| `app/admin/sync/page.tsx` | Repair the broken emergency-fallback runbook. |
| `worker/index.mjs` | Mirror `state` into `status` in `setState`; drop the hardcoded literal. |
| `supabase/migrations/20260805000000_sync_run_status_reconciliation.sql` | **New.** Widen the constraint, add the mirror trigger, repair inconsistent rows. |
| `scripts/check-pub1-publish-gate.mjs` | **New.** 6 sections covering the gate, route enforcement and migration safety. |
| `scripts/check-hygiene.mjs` | **New.** Encoding, line endings, artifacts, lockfiles, secret confinement. |
| `scripts/check-upd27-identity.mjs` | Assertion updated to the stronger gate + behavioural check. |
| `scripts/check-upd2-sync.mjs` | Fallback assertions rewritten to intent. |
| `.gitattributes` | **New.** Pin LF, mark binaries. |
| `.gitignore` | Worker logs, extraction artifacts, PDFs, pnpm files. |
| 21 source files | CRLF → LF normalisation only; no logic change. |

### Database changes

`supabase/migrations/20260805000000_sync_run_status_reconciliation.sql` —
idempotent; no `DROP TABLE`, `DELETE` or `TRUNCATE`; drops only a constraint and
a trigger; touches no chapter, procedure card, decision tree or RLS policy;
publishes and approves nothing.

### Testing results

- 28 / 28 check suites pass (2 new).
- `npx tsc --noEmit` clean.
- `npx eslint` clean on all changed files.
- `npm run lint` / `npm run build` **could not be executed** in the sandbox
  (45 s cap / bus error). Not claimed as passing.
- The migration has **not** been executed against a database. No credentials were
  provided, so its runtime behaviour is unverified.

---

## Earlier sessions

Recorded in commit history: OI-1, STAB-1, OPS-1, SEC-1/1.1, DEP-1, AUTH-UX-1,
UPD-1, OPS-2/2.1, UPD-2 → UPD-2.8. See `git log`.

---

## Open blockers

| # | Blocker | Needs |
|---|---|---|
| B1 | **Code is ahead of the database.** SEC-1 RLS, UPD-1 alignment, OPS-2.1 card and now PUB-1 reconciliation are committed but unapplied. Last measured effect: 26 of 26 workflows UNAVAILABLE (trees at 81.7, cards at 81.2). | Supabase access |
| B2 | **The worker is not deployed.** No `vercel.json`, no cron, no CI, `worker/node_modules` absent. Runs sit in `queued` unless a worker is run by hand. | Hosting decision + deploy |
| B3 | **Git commits blocked by the sandbox mount.** `git add` creates `.git/index.lock`, then cannot unlink it ("Operation not permitted"), so the lock persists and blocks the next git command. `.git/index.lock.{g1,j1,p1,s4,stale}` show this has recurred since 21 Jul. All work is saved in the working tree; only the commit is blocked. | Run `del .git\index.lock` then `git add -A && git commit` locally |
| B4 | **No CI.** Nothing runs the 28 suites automatically; every regression caught this session was caught by hand. | CI decision |
| B5 | ~~The bad v81.7 staged run (157 rows) is still present.~~ **CLOSED 2026-08-02** — confirmed by the owner as already cancelled/discarded. `supabase/seed_upd27_cancel_bad_run.sql` must **not** be run again. | — |
| B6 | **Owner-override boundary is bypassable** (PUB-1.1, confirmed empirically). Any `admin` can write `reclass_override_reason` / `_by` / `_at` directly through PostgREST and then publish a mass-reclassified run. Fix designed and proven; not yet implemented. | Approval to implement Pass 2 |
| B7 | **Publish is not concurrency-safe** (confirmed empirically). Two simultaneous requests both pass the read-then-act gate and both apply the staged rows. | Approval to implement Pass 2 |

---

## Session PUB-1.1 — 2026-08-02 (later)

### Root cause: five permissive policies, OR'd

Live `public.sync_runs` carries FIVE policies. PostgreSQL combines *permissive*
policies with **OR**, so the effective grant is their UNION. Policy 5,
"Quality+ manage sync runs" (`FOR ALL`, quality/admin/owner), is a superset that
makes the narrower policies 1 (DELETE, admin+) and 3 (UPDATE, admin+) dead
letters. It exists only in production — it is **not in this repository**, which
is why Pass 1's repo-derived model wrongly reported quality as blocked.

Measured on a real PostgreSQL with all five installed:

| principal | SELECT | UPDATE | SET override | DELETE |
|---|---|---|---|---|
| owner | yes | yes | **yes** | yes |
| admin | yes | yes | **yes** | yes |
| quality | yes | yes | **yes** | **yes** |
| agent | no | no | no | no |
| anon | denied at table grant | | | |

So quality — not just admin — could tamper with the override fields, and any of
them could set `reclass_override_by` to another person's UUID, fabricating an
audit trail. **RLS cannot fix this: it is row-level and cannot constrain
columns.**

### Fix (migration `20260806000000_owner_override_boundary.sql`)

Guard trigger + owner-only SECURITY DEFINER RPCs + append-only audit table +
atomic publish claim. The five live policies are **not** modified. Verified on
real PostgreSQL, before and after; consolidation is proposed but not performed.

### Method note

Pass 1's first harness reported "ALLOWED" for every principal — RLS filters rows
rather than raising, so exception-based testing is meaningless here. Row counts
are the only valid signal. Two of my own new assertions also matched prose or
mis-parsed a `+` in a policy name as a regex quantifier; both were tightened.

---

## Production facts of record (2026-08-02)

- The old 157-row bad run is **cancelled/discarded**. Do not re-run the
  cancellation SQL.
- The latest successful extraction produced **81 staged rows and 154 impact
  rows** (run `04063edf`), consistent with the corrected UPD-2.8 extractor
  (81 chapters, 79 exact slug matches, 2 new, 0 removed, guard not triggered).
- That run's final state write was rejected by `sync_runs_status_check`; the
  staged data itself is sound.

---

## ZC-1 — Zero-cost processing: Render removed, GitHub Actions adopted

**Why.** `render.yaml` declared a Render **Background Worker** on the `starter`
plan. Render's own pricing FAQ scopes free compute to *"web services, Render Key
Value instances, and Render Postgres databases"* — background workers are
excluded and start at **$7/month**. The previous runbook conceded this outright
("must stay on a paid always-on plan"), which directly contradicted the zero-cost
constraint. A free Render *web* service was considered and rejected: it spins
down after inactivity, and a queue poller receives no inbound HTTP to wake it.

**What replaced it.** GitHub Actions. The upload API sends a server-side
`repository_dispatch`; a job installs Node 22 + Python + Poppler and drains the
queue. A `*/5` scheduled workflow is the safety net. Cost: **$0**.

**Worker modes.** `--once`, `--drain` (CI default), `--continuous` (local only).
An empty queue exits 0 — treating it as failure would make the scheduled
workflow permanently red and mask real faults. Exit 1 is reserved for
infrastructure failure. `--drain` stops claiming new work with
`DRAIN_RESERVE_MS` left so it never starts a job it cannot finish.

**Concurrency.** Unchanged and deliberately so: `claim_sync_run()` with
`FOR UPDATE SKIP LOCKED` remains the only authority. The workflow `concurrency:`
group avoids duplicate compute; it is not a correctness mechanism. `tick()` now
returns `claimed | empty | error` so drain can distinguish "queue empty" from
"claim RPC unusable" — only the latter fails the job.

**Dispatch security.** `lib/github-dispatch.ts` is server-only (hard guard on
`window`), the event type and repository are constants, the sole caller-supplied
value is a UUID-validated run id, and errors collapse to a closed set of codes so
a GitHub response body can never reach a log or a reviewer. Dispatch failure
returns **201 with a warning**, not a 5xx: the PDF is already stored and the run
is already queued, and telling the admin to re-upload would then trip the
duplicate-hash unique index — a confusing dead end.

**Health model rewritten (the important part).** `workerOnline` was deleted, not
re-plumbed. Under Actions there is no permanent process, so that field would read
"offline" during entirely normal idle periods — destroying the one signal that
should mean something and making a real outage indistinguishable from a quiet
afternoon. The contract now answers *will my upload be processed, and is anything
stuck*: `dispatcherConfigured`, `lastDispatchSuccessAt`, `queueDepth`,
`oldestQueuedAt`, `stuckQueuedCount`, `activeRun`, `processingSystemReady`.
`sync_worker_heartbeat` survives only so `claim_sync_run` can reclaim runs
abandoned by an evicted job; its comment now says so explicitly.

**Documentation correction.** `docs/ARCHITECTURE.md` claimed production still
carried the dangerous `"Quality+ manage sync runs" FOR ALL` policy. Live
inspection shows production has four policies and that one is **absent**. It did
exist historically; the migration still drops it by name so an older database
converges. The stale claim is corrected rather than quietly deleted.

**Verified.** `tsc --noEmit` clean; all 28 `scripts/check-*.mjs` suites pass.
