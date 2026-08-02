// PUB-1 — publish preconditions, guard enforcement and lifecycle invariants.
// Run with: node scripts/check-pub1-publish-gate.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");

const {
  evaluatePublishGate,
  effectiveRunState,
  PUBLISHABLE_STATES,
} = await import("../lib/sync-publish-gate.ts");
const { MASS_RECLASSIFICATION_THRESHOLD } = await import("../lib/sync-diff.ts");

// ===========================================================================
// 1. The gate itself
// ===========================================================================
const staged = { state: "staged", status: "staged", new_ratio: 0.02, removed_ratio: 0 };

assert.equal(evaluatePublishGate(staged).ok, true, "a clean staged run must publish");
assert.equal(evaluatePublishGate(staged).errorCode, null);

// --- Mass reclassification is REFUSED, not merely displayed. ---------------
const massNew = { ...staged, new_ratio: 0.5 };
assert.equal(evaluatePublishGate(massNew).ok, false, "mass-new must block publishing");
assert.equal(evaluatePublishGate(massNew).errorCode, "MASS_RECLASSIFICATION_BLOCKED");
assert.equal(evaluatePublishGate(massNew).reclassBlocked, true);

const massRemoved = { ...staged, removed_ratio: 0.9 };
assert.equal(evaluatePublishGate(massRemoved).errorCode, "MASS_RECLASSIFICATION_BLOCKED");

// The exact v81.7 failure that motivated UPD-2.7: 78 new / 79 removed.
const v817 = { ...staged, new_ratio: 78 / 81, removed_ratio: 79 / 79 };
assert.equal(evaluatePublishGate(v817).ok, false, "the v81.7 bad run must never publish");

// The real, corrected v81.7 run (2 new of 81, 0 removed) must pass.
const corrected = { ...staged, new_ratio: 2 / 81, removed_ratio: 0 };
assert.equal(evaluatePublishGate(corrected).ok, true, "the corrected run must publish");

// --- Boundary: strictly greater-than, matching evaluateReclassificationGuard.
const atLimit = { ...staged, new_ratio: MASS_RECLASSIFICATION_THRESHOLD };
assert.equal(evaluatePublishGate(atLimit).ok, true, "exactly at the limit is allowed");
const overLimit = { ...staged, new_ratio: MASS_RECLASSIFICATION_THRESHOLD + 1e-9 };
assert.equal(evaluatePublishGate(overLimit).ok, false, "just over the limit is blocked");

// --- Only an audited owner override lifts the block. ----------------------
assert.equal(
  evaluatePublishGate({ ...massNew, reclass_override_reason: "Owner reviewed: TOC re-cut" }).ok,
  true,
  "an audited override unblocks"
);
assert.equal(
  evaluatePublishGate({ ...massNew, reclass_override_reason: "   " }).ok,
  false,
  "a whitespace-only reason must NOT count as an override"
);
assert.equal(
  evaluatePublishGate({ ...massNew, reclass_override_reason: null }).ok,
  false,
  "a null reason must not unblock"
);

// --- PostgreSQL numeric arrives as a string; it must still compare. --------
assert.equal(
  evaluatePublishGate({ ...staged, new_ratio: "0.97" }).ok,
  false,
  "a numeric-as-string ratio must still trip the guard"
);
assert.equal(evaluatePublishGate({ ...staged, new_ratio: "not-a-number" }).newRatio, 0);
assert.equal(evaluatePublishGate({ ...staged, new_ratio: null }).newRatio, 0);

// --- Idempotency: a published run is terminal. -----------------------------
assert.equal(evaluatePublishGate({ ...staged, state: "published" }).errorCode, "ALREADY_PUBLISHED");
assert.equal(
  evaluatePublishGate({ ...staged, published_at: "2026-08-02T10:00:00Z" }).errorCode,
  "ALREADY_PUBLISHED",
  "published_at alone marks the run terminal"
);
// Already-published wins over the guard, so the operator gets the true reason.
assert.equal(
  evaluatePublishGate({ ...massNew, state: "published" }).errorCode,
  "ALREADY_PUBLISHED"
);

// --- Lifecycle: only a staged run may publish. -----------------------------
for (const state of ["uploaded", "queued", "validating", "extracting", "failed", "cancelled"]) {
  assert.equal(
    evaluatePublishGate({ ...staged, state }).errorCode,
    "RUN_NOT_PUBLISHABLE",
    `state '${state}' must not be publishable`
  );
}
for (const state of PUBLISHABLE_STATES) {
  assert.equal(evaluatePublishGate({ ...staged, state }).ok, true, `${state} must publish`);
}

// --- Legacy fallback matches the admin list's display rule. ----------------
assert.equal(effectiveRunState({ state: null, status: "staged" }), "staged");
assert.equal(effectiveRunState({ state: "staged", status: "pending" }), "staged", "state wins");
assert.equal(effectiveRunState({ state: null, status: null }), "uploaded");
assert.equal(effectiveRunState({ state: "  ", status: "staged" }), "staged", "blank state falls back");

// ===========================================================================
// 2. The publish route actually enforces the gate
// ===========================================================================
const publishRoute = read("app/api/sync/[id]/publish/route.ts");
assert.ok(
  /import \{ evaluatePublishGate \} from "@\/lib\/sync-publish-gate"/.test(publishRoute),
  "the publish route must import the shared gate"
);
assert.ok(/const gate = evaluatePublishGate\(syncRun\)/.test(publishRoute), "gate must be evaluated");
assert.ok(/if \(!gate\.ok\)/.test(publishRoute), "gate must be enforced");

// The gate must be checked BEFORE any write path — i.e. before the RPC call.
assert.ok(
  publishRoute.indexOf("if (!gate.ok)") < publishRoute.indexOf("publish_sync_chapters"),
  "the gate must be evaluated before the publish RPC is invoked"
);
// ...and before the staged rows are even loaded, so a blocked run does no work.
assert.ok(
  publishRoute.indexOf("if (!gate.ok)") < publishRoute.indexOf("sync_staged_changes"),
  "the gate must precede loading staged changes"
);

// The run query must actually select the columns the gate depends on.
for (const col of ["state", "new_ratio", "removed_ratio", "reclass_override_reason", "published_at"]) {
  assert.ok(
    new RegExp(`select\\([^)]*${col}`, "s").test(publishRoute),
    `the publish route must select ${col} for the gate`
  );
}

// A blocked publish must return a conflict, never a success.
assert.ok(/status: 409/.test(publishRoute), "a blocked publish must answer 409");

// ===========================================================================
// 3. The run transition happens INSIDE the publish transaction
// ===========================================================================
// PUB-1.2: markRunPublished() is gone. Marking the run published was a separate
// write after the chapter RPC, so a crash between them left chapters live with
// the run still 'staged' — and the natural retry re-applied them. Both now
// happen inside publish_sync_run's single transaction.
{
  const overrideMigration = read("supabase/migrations/20260808000000_sync_platform_consolidation.sql");
  const fn = overrideMigration.slice(
    overrideMigration.indexOf("function public.publish_sync_run"),
    overrideMigration.indexOf("revoke all on function public.publish_sync_run")
  );
  assert.ok(/state\s*=\s*'published'/.test(fn), "publish must set state inside the transaction");
  assert.ok(/published_at\s*=\s*now\(\)/.test(fn), "publish must stamp published_at inside the transaction");
  assert.ok(!/markRunPublished/.test(publishRoute), "the separate run-marking write must be gone");
  assert.ok(
    !/\.from\("sync_runs"\)[\s\S]{0,200}\.update\(/.test(publishRoute),
    "the route must not update sync_runs directly any more"
  );
}

// ===========================================================================
// 4. The review screen and the API share ONE rule
// ===========================================================================
const adminPage = read("app/admin/sync/[id]/page.tsx");
assert.ok(
  /evaluatePublishGate\(syncRun\)/.test(adminPage),
  "the review screen must use the shared gate"
);
assert.ok(
  !/RECLASS_LIMIT = 0\.2/.test(adminPage),
  "the duplicated 0.2 threshold literal must be gone from the page"
);
assert.ok(/canPublish = canManageUsers\(role\?\.role\) && gate\.ok/.test(adminPage), "role AND gate");

// ===========================================================================
// 5. Lifecycle invariant is enforced in the database, not by convention
// ===========================================================================
const migration = read("supabase/migrations/20260808000000_sync_platform_consolidation.sql");
assert.ok(/create trigger sync_runs_mirror_status_trg/.test(migration), "mirror trigger required");
assert.ok(/before insert or update on public\.sync_runs/.test(migration), "must fire before write");
assert.ok(/new\.status := new\.state/.test(migration), "state is authoritative");
// Must be UNCONDITIONAL: a conditional mirror (only when state changes) still
// allowed status to diverge when a caller wrote status alone. Measured.
{
  const fn = migration.slice(migration.indexOf("function public.sync_runs_mirror_status"),
                             migration.indexOf("drop trigger if exists sync_runs_mirror_status_trg"));
  assert.ok(!/is distinct from old\.state/.test(fn), "the mirror must be unconditional");
}
assert.ok(/not valid/.test(migration), "the widened constraint must be added NOT VALID");
// The constraint must accept every value the state machine can produce.
for (const v of ["staged", "published", "failed", "cancelled", "validating", "extracting"]) {
  assert.ok(new RegExp(`'${v}'`).test(migration), `status vocabulary must accept '${v}'`);
}
// Destructive statements must never appear in a reconciliation migration.
// Scan EXECUTABLE SQL ONLY — the header documents the safety guarantees in
// prose ("no DROP TABLE, no DELETE, no TRUNCATE") and a naive substring match
// would flag the very comment that promises the file is safe.
const migrationSql = migration
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");
// The invariant is that LIVE CONTENT is never destroyed. Deleting staged review
// rows is legitimate and required: "discard review" and "process again" exist
// precisely so an administrator never has to clear them by hand in SQL.
for (const t of ["chapters", "procedure_cards", "decision_trees", "user_roles"]) {
  assert.ok(
    !new RegExp(`delete\\s+from\\s+(public\\.)?${t}\\b`, "i").test(migrationSql),
    `migration must never delete from ${t}`
  );
  assert.ok(
    !new RegExp(`drop\\s+table[^;]*${t}\\b`, "i").test(migrationSql),
    `migration must never drop ${t}`
  );
}
for (const forbidden of ["drop table", "truncate"]) {
  assert.ok(!new RegExp(`\\b${forbidden}\\b`, "i").test(migrationSql), `migration must not ${forbidden}`);
}
// Any delete that IS present must target only staged/report tables.
for (const [, tbl] of migrationSql.matchAll(/delete\s+from\s+(?:public\.)?(\w+)/gi)) {
  assert.ok(
    ["sync_staged_changes", "sync_impact_report"].includes(tbl),
    `unexpected delete from ${tbl}`
  );
}
// `drop` is legitimate for swapping constraints, triggers, policies and
// functions the consolidation replaces — never for a table or a column.
for (const [, dropped] of migrationSql.matchAll(/\bdrop\s+(\w+)/gi)) {
  assert.ok(
    ["constraint", "trigger", "policy", "function", "not"].includes(dropped.toLowerCase()),
    `migration may only drop constraints/triggers/policies/functions, found: drop ${dropped}`
  );
}

// ===========================================================================
// 6. The worker no longer writes a hardcoded legacy status
// ===========================================================================
const worker = read("worker/index.mjs");
assert.ok(!/status: "review"/.test(worker), "'review' violated sync_runs_status_check");
assert.ok(!/status: "pending"/.test(worker), "the worker must not pin a literal legacy status");
assert.ok(/status: state,/.test(worker), "setState must mirror state into status");

console.log("PUB-1 publish gate checks passed.");
