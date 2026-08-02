# PDF Update Studio — Staging Status

Updated 2026-08-02. Production `kupxltcfbvccqfxvpttd` **read-only throughout** —
verified untouched at the end of the session (79 chapters, 45 cards, 1512 history
rows, newest chapter edit 2026-07-21, stuck run `96a1ebc1` still `queued`).
All work landed on staging `edxtludzxcvclzrnslfe` (Free plan). **Cost: $0.**

Phases 1–7 are complete. Phases 8–15 are not started.

---

## 1. Phase 1 — worktree

`git diff --stat` claims 12 files / 624 insertions. That is inflated by CRLF
churn. Verified with `--ignore-cr-at-eol`: the **real diff is 9 files**.
`app/api/chapters/[id]/route.ts` (194/194), `app/api/sync-runs/[id]/route.ts`
(36/36) and `app/api/sync-runs/cleanup/route.ts` (47/47) are **pure line-ending
noise with zero semantic change**.

Real changes: `.gitignore`, `app/admin/sync/[id]/page.tsx`,
`app/admin/sync/page.tsx`, `app/api/sync/[id]/publish/route.ts`,
`app/api/sync/[id]/reclass-override/route.ts`,
`scripts/check-api-authorization.mjs`, `scripts/check-upd2-sync.mjs`,
`scripts/check-upd27-identity.mjs`, `worker/index.mjs`.

Renormalization also revealed a **wider pre-existing problem**: ~190 tracked
files are stored CRLF in the repository. Adding `* text=auto eol=lf` means git
wants all of them rewritten. Plan: one dedicated mechanical commit
("Normalize stored line endings to LF") so the four feature commits stay clean.

Hygiene verified: no BOM, no mojibake, no `.env` tracked, no credential
literals (every `SUPABASE_SERVICE_ROLE_KEY` hit is a variable *name*), no
arbitrary-SQL RPC — the `exec_sql` matches are guards *against* one.

> **Environment constraint discovered.** The workspace mount is FUSE and permits
> create/write but **not delete**, so `git` cannot clear `.git/index.lock` and
> no git write operation succeeds in place. Git work was done in a sandbox clone
> at `/tmp/goto`. The sandbox also has **no network to Supabase or GitHub**
> (package registries only), so nothing can be pushed from here — Phase 11 must
> go through Claude in Chrome.

---

## 2. Phase 2 — fidelity: complete

| Object | Production | Staging | Status |
|---|---|---|---|
| Tables | 11 | 11 | match |
| Policies (public) | 39 | 39 | match |
| Constraints | 60 | 60 | match |
| Indexes | 42 | 42 | **match** |
| RLS-enabled | 11 | 11 | match |
| Triggers (public) | 4 | 4 | match |
| `auth.users` trigger | 1 | 1 | match |
| Storage buckets | 2 | 2 | match |
| Storage policies | 3 | 3 | match |

**The missing index is found and fixed.** It was
`sync_runs_active_hash_idx` — a partial **UNIQUE** index on `pdf_sha256` for
active states. My first fidelity generator filtered `indexdef LIKE 'CREATE INDEX%'`
and silently skipped `CREATE UNIQUE INDEX`. This is the **duplicate-upload
guard**; without it the acceptance test's "duplicate PDF rejected" behaviour
would not exist. Now created on staging.

`manual-sources` created: private, 40 MB limit, `application/pdf` only, with
production's three policies (admin+ read, admin+ upload, owner-only delete).
`chapter-images` also recreated for parity.

Remaining intentional difference: staging has the consolidation migration
applied and production does not, so staging has 19 functions to production's 18
and lacks production's two superseded overloads. Production also retains a
legacy nullable `sync_reclass_override_audit.reason` column the migration
ignores — harmless.

---

## 3. Phase 3 — seed data

79 chapters, 79 unique slugs, chapter numbers 1–79 with no duplicates, real
production UUIDs preserved, `updated_by` nulled (production auth users do not
exist on staging) — **0 dangling FKs**. 45 procedure cards, 44 chapter-linked
across 36 distinct chapters, **0 broken FKs** — matches production exactly.

**Honest limitation.** Chapter `body_text` was **not** transferred. Production
bodies total 574 kB; the sandbox cannot reach Supabase, so the only transfer
path is through the agent context, which cannot carry that volume. Every chapter
carries a clearly-marked deterministic placeholder beginning
`[STAGING SEED - NOT PRODUCTION BODY TEXT]` that embeds the real title, keywords
and page range so full-text search remains exercisable.

Consequence, stated precisely: **the headline acceptance metric is unaffected** —
79 matched / 2 new / 0 removed / 0 ambiguous is an *identity* comparison over
slug/title/number, all of which are faithful. What *is* affected is the
content-classification split: every matched chapter will classify as
`content_changed` rather than `unchanged`. Phase 14 step 11 must be read with
that in mind.

Workflows/decision trees need no seeding — they live in
`lib/decision-engine/definitions/*.ts` as code, not database rows. Workflow
impact is computed from code against changed chapters.

---

## 4. Phase 4 — test users

Owner, Admin and Quality created in `auth.users` with correct `user_roles`, via
the replicated `on_auth_user_created_user_role` trigger. Passwords are random,
bcrypt-hashed, **never printed and deliberately unrecoverable** — no credential
exists in chat, logs or source. Browser login for Phase 14 will need a password
set through the Supabase dashboard at that time.

---

## 5. Phase 5 — migration

**Three defects found and fixed** (details in git diff):
1. A **live, uncommented** `drop function claim_sync_run(text)` inside the
   ROLLBACK comment block. No-op today, but a trap that would silently delete a
   legitimately reintroduced function. Verified: zero executable lines after the
   `-- ROLLBACK` marker.
2. A comment asserting the function is `SECURITY INVOKER` when it is declared
   `SECURITY DEFINER` — false reasoning in a security-critical file.
3. `current_setting('request.jwt.claims', true)::json` crashes on an
   empty-string setting. Now `nullif(..., '')::json`.

**Convergence proven.** Both hazards were planted as signature-accurate stubs
first, then the migration removed them. Result: exactly **1** `publish_sync_run`
(4-arg, DEFINER) and **1** `claim_sync_run` (2-arg);
`claim_sync_run_for_publish` and `release_sync_run_publish_claim` absent; 4
non-overlapping `sync_runs` policies, one per verb, no `FOR ALL`.

**Idempotency: partial.** Every statement not guarded by `IF NOT EXISTS` /
`CREATE OR REPLACE` / `ON CONFLICT` was re-executed successfully. **A second
application of the complete file is still owed** (Phase 5 as specified).

---

## 6. Phase 6 — authorization: all pass

Driven by real per-user JWT claims (`request.jwt.claims` + role switching),
which is the same mechanism PostgREST uses. *Caveat: this is the database
enforcement path, not HTTP round-trips — the sandbox cannot reach Supabase.*

| Actor | Result |
|---|---|
| Owner | read ok; record/clear override via RPC ok; **direct override UPDATE blocked** |
| Admin | read ok; INSERT run ok; override RPC refused `OWNER_REQUIRED`; **forged owner UUID blocked** |
| Quality | read runs + staged changes ok; INSERT blocked by RLS; UPDATE/DELETE 0 rows; publish `ADMIN_REQUIRED`; override `OWNER_REQUIRED` |
| Anon | `sync_runs` denied; `sync_system_health()` denied |
| service_role | override forge on INSERT blocked by column guard; normal INSERT unaffected |
| audit | UPDATE blocked `AUDIT_IMMUTABLE` |

**The sequence test is the important one.** recorded → cleared → recorded →
cleared leaves 4 immutable audit rows and the gate returns
`MASS_RECLASSIFICATION_BLOCKED` — proving stale historical `recorded` rows
cannot satisfy the publish gate. All five ineligible states (`published`,
`failed`, `cancelled`, `publishing`, `queued`) refuse override with
`RUN_NOT_OVERRIDEABLE`.

---

## 7. Phase 7 — atomic publish: 13/13 pass

Against the real `publish_sync_chapters`, not a stub.

Valid publish committed once (`published: 1, atomic: true`); repeat publish
returned `PUBLISH_REFUSED: ALREADY_PUBLISHED`; chapter body applied;
`chapters.updated_by` **and** `edit_history.edited_by` both equal `auth.uid()`;
run reached `published` with `published_at` set; an operation naming an
unapproved chapter was rejected with `OPERATION_NOT_IN_RUN (baggage)`.

**Rollback verified.** A failure on the second operation
(`SYNC_INVALID_PAYLOAD: unknown op "bogus"`) after the first had applied left
the chapter body unchanged, **zero** history rows added, and the run still
`staged` with `published_at` null. Retry afterwards committed cleanly.

No `dblink`, `pg_background`, `http` or `pg_net` installed; no
`exec_sql`/`execute_sql`/`run_sql` function exists.

**Not proven: true concurrency.** Two genuinely overlapping sessions require a
second connection, which this channel cannot open, and `dblink`/`pg_background`
are forbidden by the brief. The `SELECT … FOR UPDATE` lock plus the post-lock
`ALREADY_PUBLISHED` re-check (empirically confirmed) is the mechanism that makes
it safe, but the two-session race itself remains untested.

---

## 8. Not started — Phases 8–15

8. GitHub Actions worker: `process-pdf-sync.yml`, `recover-pdf-sync.yml`,
   server-only dispatch route, worker one-shot/drain modes.
9. Honest health model (`dispatcherConfigured`, `lastDispatchSuccessAt`,
   `oldestQueuedAt`…); remove "Worker online" language.
10. Delete `render.yaml`; rewrite `ARCHITECTURE.md` / `RUNBOOK.md` /
    `ENGINEERING_LOG.md`; correct the stale claim that production still carries
    `"Quality+ manage sync runs" FOR ALL` (it does not).
11–15. Branch + PR, Actions secrets, Vercel Preview, real PDF acceptance test,
    production proposal.

**Sequencing note:** Phase 14 cannot run before 8–13, and the PDF acceptance
test is the only remaining proof that the end-to-end
Upload → Wait → Review → Publish workflow holds in a browser.

---

## 9. Verified source PDF

`The_GO_TO_document.pdf` — 20,747,923 bytes, **356 pages**, created
**2026-07-30**, PDF 1.7. Matches the v81.7 acceptance target. Fits inside the
40 MB `manual-sources` limit.
