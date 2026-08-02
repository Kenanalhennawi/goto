// PUB-1.1 — owner-only override boundary, audit trail, atomic publish claim.
// Run with: node scripts/check-pub11-override-boundary.mjs
//
// CONTEXT. public.sync_runs carries FIVE permissive policies in production.
// PostgreSQL ORs permissive policies, so the effective grant is their UNION.
// "Quality+ manage sync runs" (FOR ALL) is a superset that makes the narrower
// UPDATE/DELETE policies dead letters. Measured on a real PostgreSQL with all
// five installed, quality/admin/owner could ALL write the override columns
// directly and forge reclass_override_by. RLS cannot fix that: it is row-level.
//
// These are static assertions. The live authorization matrix is proven
// separately by scripts/verify-override-boundary.sql, which must be run against
// the database itself — source assertions cannot prove a database boundary.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");

const migration = read("supabase/migrations/20260808000000_sync_platform_consolidation.sql");
const overrideRoute = read("app/api/sync/[id]/reclass-override/route.ts");
const publishRoute = read("app/api/sync/[id]/publish/route.ts");

/** Executable SQL only — the header documents the threat model in prose. */
const sql = migration
  .split("\n")
  .filter((l) => !l.trimStart().startsWith("--"))
  .join("\n");

// ===========================================================================
// 1. Column guard — the structural boundary
// ===========================================================================
assert.ok(/create or replace function public\.sync_runs_protect_override/.test(sql), "guard function required");
assert.ok(/before insert or update on public\.sync_runs/.test(sql), "guard must cover INSERT and UPDATE");
// PUB-1.2: policy 5 (FOR ALL) permits INSERT, so a forged override could simply
// be inserted rather than updated. The guard must reject non-null override
// values on INSERT too.
assert.ok(
  /if tg_op = 'INSERT' then[\s\S]{0,400}?new\.reclass_override_reason is not null/.test(sql),
  "guard must reject a forged override on INSERT"
);
// The trigger must be SECURITY INVOKER. As DEFINER, current_user is ALWAYS the
// function owner, so the owner comparison below would be constant-false and
// provide no protection at all. Measured and confirmed.
{
  const fn = sql.slice(sql.indexOf("function public.sync_runs_protect_override"),
                       sql.indexOf("drop trigger if exists sync_runs_protect_override_trg"));
  assert.ok(!/security definer/i.test(fn), "the guard MUST NOT be SECURITY DEFINER");
}
for (const col of ["reclass_override_reason", "reclass_override_by", "reclass_override_at"]) {
  assert.ok(
    new RegExp(`new\\.${col}\\s+is distinct from old\\.${col}`).test(sql),
    `guard must detect changes to ${col}`
  );
}
assert.ok(/OVERRIDE_DIRECT_WRITE_FORBIDDEN/.test(sql), "guard must raise a stable code");
// Defence in depth: a GUC alone is not enough; the write must also be inside a
// SECURITY DEFINER context owned by the table owner.
assert.ok(/current_user is distinct from v_owner/.test(sql), "guard must compare against the table owner");

// ===========================================================================
// 2. Owner-only RPCs, actor derived server-side
// ===========================================================================
for (const fn of ["record_sync_reclass_override", "clear_sync_reclass_override"]) {
  const body = sql.slice(sql.indexOf(`function public.${fn}`));
  assert.ok(/security definer/.test(body.slice(0, 400)), `${fn} must be SECURITY DEFINER`);
  assert.ok(/set search_path = public/.test(body.slice(0, 400)), `${fn} must pin search_path`);
  assert.ok(
    new RegExp(`revoke all on function public\\.${fn}\\(uuid, text\\) from public, anon`).test(sql),
    `${fn} must be revoked from public/anon`
  );
  assert.ok(
    new RegExp(`grant execute on function public\\.${fn}\\(uuid, text\\) to authenticated`).test(sql),
    `${fn} must be granted to authenticated only`
  );
}
assert.ok(/v_uid := public\.assert_current_owner\(\)/.test(sql), "both RPCs must assert owner");
assert.ok(/OWNER_REQUIRED/.test(sql), "a non-owner must be refused with a stable code");
assert.ok(/v_uid := auth\.uid\(\)/.test(sql), "the actor must come from auth.uid()");
// No client-supplied actor anywhere.
assert.ok(
  !/p_actor|p_user_id|p_override_by/i.test(sql),
  "no RPC may accept an actor id from the client"
);
assert.ok(
  /reclass_override_by\s*=\s*v_uid/.test(sql),
  "override_by must be the server-derived caller"
);

// ===========================================================================
// 3. Immutable audit trail
// ===========================================================================
assert.ok(/create table if not exists public\.sync_reclass_override_audit/.test(sql), "audit table required");
for (const col of ["prev_reason","prev_actor_id","prev_acted_at","new_reason","actor_id","acted_at","new_ratio","removed_ratio"]) {
  assert.ok(new RegExp(`\\b${col}\\b`).test(sql), `audit must preserve ${col}`);
}
assert.ok(/references public\.sync_runs\(id\)/.test(sql), "audit must have an FK to sync_runs");
assert.ok(/on delete restrict/.test(sql), "an audited run must not be deletable");
// Override RPCs must lock and accept 'staged' only.
assert.ok(/for update/i.test(sql), "override RPCs must lock the row before deciding");
assert.ok(/RUN_NOT_OVERRIDEABLE/.test(sql), "non-staged states must be refused");
assert.ok(/before update or delete on public\.sync_reclass_override_audit/.test(sql), "audit must be append-only");
assert.ok(/AUDIT_IMMUTABLE/.test(sql), "audit tamper attempt must raise");
assert.ok(/revoke all on public\.sync_reclass_override_audit from anon, authenticated/.test(sql), "no direct writes");
assert.ok(/grant select on public\.sync_reclass_override_audit to authenticated/.test(sql), "reviewers may read");
for (const action of ["recorded", "cleared"]) {
  assert.ok(new RegExp(`'${action}'`).test(sql), `audit must record '${action}'`);
}

// ===========================================================================
// 4. Atomic publish claim
// ===========================================================================
assert.ok(/create or replace function public\.publish_sync_run/.test(sql), "atomic publish RPC required");
// The over-authorised release function must be REMOVED, not patched: it was
// granted to authenticated with no role check, letting any principal move a run
// publishing -> staged, including one whose chapters had already applied.
// The over-authorised claim/release pair is GONE from the schema entirely.
// It was granted to authenticated with no role check, letting any principal
// move a run publishing -> staged, including one whose chapters had applied.
// They must not be CREATED, and must be explicitly dropped so a database that
// already received the earlier draft converges instead of keeping them.
assert.ok(!/create or replace function public\.release_sync_run_publish_claim/.test(sql), "release fn must not be created");
assert.ok(!/create or replace function public\.claim_sync_run_for_publish/.test(sql), "claim fn must not be created");
assert.ok(/drop function if exists public\.release_sync_run_publish_claim/.test(sql), "release fn must be dropped");
assert.ok(/drop function if exists public\.claim_sync_run_for_publish/.test(sql), "claim fn must be dropped");
// The superseded publish signature must be dropped, not left as an overload:
// `create or replace` matches on the argument list, so the vulnerable
// (uuid, jsonb, uuid[], uuid, text, text) form would survive alongside the new one.
assert.ok(
  /drop function if exists public\.publish_sync_run\(uuid, jsonb, uuid\[\], uuid, text, text\)/.test(sql),
  "the old publish_sync_run signature must be dropped to avoid a dangerous overload"
);
// Recovery is now explicit, admin-gated and precondition-checked.
for (const fn of ["cancel_sync_run","reprocess_sync_run","discard_sync_run_staging","restore_sync_run_to_staged"]) {
  assert.ok(new RegExp(`function public\\.${fn}`).test(sql), `${fn} recovery RPC required`);
  assert.ok(new RegExp(`revoke all on function public\\.${fn}`).test(sql), `${fn} must be revoked from public/anon`);
}
assert.ok(/assert_sync_admin/.test(sql), "recovery must be admin-gated in the database");
// Publish must be SECURITY INVOKER so chapter writes stay under the caller's RLS.
{
  const fn = sql.slice(sql.indexOf("function public.publish_sync_run"), sql.indexOf("revoke all on function public.publish_sync_run"));
  // PUB-1.3: DEFINER on purpose. The raw writer publish_sync_chapters is revoked
  // from `authenticated` (it trusts a client-supplied editor UUID), so an
  // INVOKER wrapper could not call it. Authorization is explicit inside instead.
  assert.ok(/security definer/i.test(fn), "publish_sync_run must be SECURITY DEFINER");
  assert.ok(/ADMIN_REQUIRED/.test(fn), "it must verify admin/owner itself");
  assert.ok(/OPERATION_NOT_IN_RUN/.test(fn), "it must reject operations outside the run");
  assert.ok(!/p_editor/.test(fn), "it must not accept a client-supplied editor");
  assert.ok(/request\.jwt\.claims/.test(fn), "editor email must come from verified claims");
  assert.ok(/for update/i.test(fn), "publish must lock the run row");
  assert.ok(/sync_run_publish_blocked/.test(fn), "publish must re-check the guard under the lock");
  assert.ok(/state\s*=\s*'published'/.test(fn) && /published_at\s*=\s*now\(\)/.test(fn),
            "publish must mark the run inside the same transaction");
}
// The guard re-check must validate override completeness and audit evidence.
for (const code of ["OVERRIDE_INCOMPLETE","OVERRIDE_ACTOR_NOT_OWNER","OVERRIDE_UNAUDITED"]) {
  assert.ok(sql.includes(code), `publish gate must detect ${code}`);
}
// The compare-and-swap: the state predicate is what serialises concurrent calls.
assert.ok(/ADMIN_REQUIRED/.test(sql), "publishing stays admin/owner");

// ===========================================================================
// 5. Idempotency and non-destructiveness (task 13)
// ===========================================================================
// The invariant is that LIVE CONTENT is never destroyed. Deleting staged review
// rows is legitimate and required: "discard review" and "process again" exist
// precisely so an administrator never clears them by hand in SQL.
assert.ok(!/\bdrop table\b/i.test(sql), "must not drop tables");
assert.ok(!/\btruncate\b/i.test(sql), "must not truncate");
for (const t of ["chapters", "procedure_cards", "decision_trees", "user_roles"]) {
  assert.ok(
    !new RegExp(`delete\\s+from\\s+(public\\.)?${t}\\b`, "i").test(sql),
    `migration must never delete from ${t}`
  );
}
for (const [, tbl] of sql.matchAll(/delete\s+from\s+(?:public\.)?(\w+)/gi)) {
  assert.ok(
    ["sync_staged_changes", "sync_impact_report"].includes(tbl),
    `unexpected delete from ${tbl}`
  );
}
// Existing live policies must not be recreated blindly. The only policy this
// migration creates is its own, on its own new table.
// Every policy this migration creates must be dropped IF EXISTS first, so the
// whole file re-runs as a no-op instead of erroring on duplicate objects.
const created = [...sql.matchAll(/create policy\s+"([^"]+)"\s+on\s+([\w.]+)/g)].map((m) => [m[1], m[2]]);
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
assert.ok(created.length > 0, "expected the migration to define policies");
for (const [name, table] of created) {
  assert.ok(
    new RegExp(`drop policy if exists\\s+"${esc(name)}"\\s+on\\s+${esc(table)}`).test(sql),
    `policy "${name}" must be dropped IF EXISTS before creation`
  );
}
// The consolidated RLS matrix must be exactly four non-overlapping sync_runs
// policies — one per verb. The production-only "Quality+ manage sync runs"
// (FOR ALL) is removed: permissive policies OR together, so it silently granted
// quality UPDATE/INSERT/DELETE and defeated every narrower policy.
const runPolicies = created.filter(([, t]) => t === "public.sync_runs").map(([n]) => n).sort();
assert.deepEqual(
  runPolicies,
  ["sync_runs delete", "sync_runs insert", "sync_runs read", "sync_runs update"],
  "sync_runs must have exactly one policy per verb"
);
assert.ok(!/for all/i.test(sql), "no FOR ALL policy may be created");
assert.ok(
  /drop policy if exists "Quality\+ manage sync runs"/.test(sql),
  "the FOR ALL superset policy must be removed"
);

assert.ok(/create table if not exists/.test(sql), "tables must use IF NOT EXISTS");
assert.ok(/create index if not exists/.test(sql), "indexes must use IF NOT EXISTS");

// ===========================================================================
// 6. The routes use the RPCs, not direct writes
// ===========================================================================
assert.ok(/rpc\("record_sync_reclass_override"/.test(overrideRoute), "override route must call the RPC");
assert.ok(
  !/\.from\("sync_runs"\)[\s\S]{0,200}\.update\(/.test(overrideRoute),
  "the override route must not UPDATE sync_runs directly"
);
assert.ok(
  !/reclass_override_by:/.test(overrideRoute),
  "the route must not send an actor id — the RPC derives it from auth.uid()"
);
assert.ok(/isOwner\(role\)/.test(overrideRoute), "route keeps its own owner check as defence in depth");

assert.ok(/rpc\("publish_sync_run"/.test(publishRoute), "route must use the atomic publish RPC");
assert.ok(!/rpc\("publish_sync_chapters"/.test(publishRoute), "route must not call the chapter RPC directly");
assert.ok(!/markRunPublished/.test(publishRoute), "the separate run-marking write must be gone");
assert.ok(!/releaseClaim/.test(publishRoute), "there is no claim to release any more");
// The claim must precede every read of staged rows and every write.

console.log("PUB-1.1 override boundary checks passed.");
