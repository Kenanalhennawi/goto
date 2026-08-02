# Runbook

Two audiences. Keep them separate.

---

# Part 1 — For the administrator

This is the entire job.

1. Sign in.
2. Open **PDF Update Studio**.
3. Click **Upload** and choose the new GO TO PDF.
4. Wait. The page updates itself and shows the stage it has reached.
5. When it says **Ready for review**, look through the detected changes.
6. Click **Publish**.

That is all. There is nothing to install, start or run. You will never need SQL,
a terminal, or an engineer for a routine update.

### If something looks wrong

| What you see | What it means | What to do |
|---|---|---|
| "Your PDF is saved and the scheduled check will process it" | Processing could not be started instantly. The upload **worked**. | Nothing. It starts within a few minutes. |
| "Waiting longer than expected" | Something is not picking the queue up. Your PDF is safe. | Tell engineering if it persists past ~15 minutes. |
| "Automatic processing is not configured" | A deployment setting is missing. | Tell engineering. Uploads still queue safely. |
| "The database is still being updated" | A deployment is finishing. | Wait a minute and reload. |
| **Failed** with a reason | The PDF was rejected (wrong version, duplicate, unreadable). | Read the reason. Use **Process again**, or upload the correct file. |
| Publishing is blocked | The update would replace an unusually large share of the manual, which usually means a bad read of the PDF. | An owner must review and record an override, or the run should be discarded. |
| Stuck on **Publishing** | A publish was interrupted. Nothing was half-applied. | Click **Return to review**, then Publish again. |

Buttons available on a run: **Process again**, **Stop**, **Discard review**,
**Return to review**. These replace every database repair that used to be
needed.

**Why "ready" and not "online".** Processing runs on demand rather than as a
permanent service, so the panel says *Processing system ready* — meaning a job
can be started — rather than claiming a machine is sitting there waiting. An
idle system is normal and is not a fault.

---

# Part 2 — For engineering

## Architecture in one line

Upload → queued run → server-side `repository_dispatch` → GitHub Actions job
drains the queue → staged → atomic publish. A scheduled workflow sweeps every
~5 minutes as the safety net.

## One-time setup

1. **GitHub repository secrets** (Settings → Secrets and variables → Actions).
   Prefer a **staging Environment** so production credentials are separate and
   can require approval:
   - `STAGING_SUPABASE_URL`
   - `STAGING_SUPABASE_SERVICE_ROLE_KEY`
   The service-role key lives **only** here. Never in Vercel, never in
   `NEXT_PUBLIC_*`, never in the client bundle.

2. **Vercel environment variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL`
   - `GITHUB_DISPATCH_REPOSITORY` — `owner/repo`, server-only
   - `GITHUB_DISPATCH_TOKEN` — server-only, **not** `NEXT_PUBLIC`

   The dispatch credential should be a GitHub App installation token, or a
   fine-grained PAT scoped to **this repository only** with
   **Contents: read-only** and **Metadata: read-only**. `repository_dispatch`
   requires Contents write on classic tokens; prefer the fine-grained token or
   App so the blast radius stays small. It cannot select a workflow — the event
   type is hardcoded in `lib/github-dispatch.ts`.

3. **Migrations.** Apply `supabase/migrations/*` to the target project. The
   worker no longer applies them: an Actions job is not a deployment gate, and
   giving a job DDL rights to run unattended was not worth it. Deploy order is
   therefore: migrate → deploy app. If the app is ahead, it degrades safely —
   health reports `MIGRATION_PENDING` and the UI says so.

## Worker modes

```
node worker/index.mjs --once        # claim one run, process, exit
node worker/index.mjs --drain       # until queue empty or time budget  (CI default)
node worker/index.mjs --continuous  # forever-loop; LOCAL ENGINEERING ONLY
```

`--drain` stops claiming new work once less than `DRAIN_RESERVE_MS` of the
`DRAIN_BUDGET_MS` budget remains, so it never starts a job it cannot finish.
Anything left is collected by the scheduled workflow.

An empty queue exits **0**. That is success, not failure — otherwise the
scheduled workflow would be red almost permanently and nobody would notice a
genuine fault. Exit **1** is reserved for infrastructure failure (unusable
`claim_sync_run`, missing credentials).

## Verifying a deployment

- `/admin/sync` shows "Processing system ready".
- `GET /api/sync/health` returns `processingSystemReady: true` and
  `dispatcherConfigured: true`.
- Actions → **PDF sync - process** shows a run triggered by `repository_dispatch`.
- Upload a PDF and confirm a job appears within ~30 seconds.

## Rollback

| Scope | Action |
|---|---|
| Bad app build | Vercel → previous deployment → Promote. |
| Bad workflow | Revert the workflow file; scheduled recovery keeps draining. |
| Bad migration | Each migration file ends with its rollback SQL, inert by default. `20260808000000` rolls back by dropping its triggers, functions and policies and recreating the previous policy set. `20260809000000` drops three additive columns and restores the previous health function. Chapter content is never modified by either. |
| Bad publish | Chapter edit history is retained; publishing is one transaction, so there is no partial state to unwind. |

## Known constraints

- **Scheduled workflows are best-effort.** `*/5` is the tightest cron GitHub
  accepts, but delivery is routinely delayed to 5–15 minutes under load. This is
  the fallback, not the expected processing time — the dispatch path starts in
  seconds. Do not quote the cron interval to administrators as an SLA.
- **GitHub disables scheduled workflows after 60 days of repository inactivity.**
  Re-enable from the Actions tab if the repo goes quiet.
- **Actions minutes.** Free and unlimited for public repositories; private
  repositories get 2,000 minutes/month. A full extraction is single-digit
  minutes, and the recovery sweep exits in seconds on an empty queue.
- The extractor requires Poppler (`pdftotext`, `pdfinfo`), installed per job.
- `EXTRACTOR_VERSION` in the workflows must match `lib/sync-upload.ts`.

## Local verification (optional)

```
node scripts/check-*.mjs                      # 28 suites
node scripts/verify-extraction-pipeline.mjs <pdf>
```

`scripts/verify-override-boundary.sql` proves the live authorization matrix in
the Supabase SQL editor; it rolls back and mutates nothing.
`scripts/verify-publish-concurrency.psql` needs two psql sessions and **commits**
— staging only.
