// SEC-1 — RLS migration assertions (static; the live database is asserted by
// applying supabase/migrations/20260801000000_internal_access_boundary.sql).
// Run with: node scripts/check-rls-policies.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260801000000_internal_access_boundary.sql");

// ---- Never disables RLS ----
assert.ok(!/disable row level security/i.test(migration), "migration must never disable RLS");
for (const table of ["procedure_cards", "chapters", "content_issues", "user_roles", "sync_runs", "sync_staged_changes"]) {
  assert.ok(
    migration.includes(`alter table ${table} enable row level security`),
    `RLS must be asserted on ${table}`
  );
  assert.ok(migration.includes(`revoke all on ${table} from anon`) || migration.includes(`revoke select on ${table} from anon`),
    `anon grants must be revoked on ${table}`);
}

// ---- Anonymous read removed from operational content ----
assert.ok(migration.includes('drop policy if exists "Published procedure cards are public"'), "public card policy must be dropped");
assert.ok(migration.includes("for select to authenticated") && migration.includes("is_published = true and review_status = 'approved'"), "cards readable only by authenticated users, still published+approved only");
assert.ok(migration.includes('"Chapters readable by authenticated users"'), "chapters must be authenticated-read");

// ---- Anonymous issue reporting removed ----
assert.ok(migration.includes('drop policy if exists "Anyone can report content issue"'), "anonymous issue insert must be dropped");
assert.ok(migration.includes('"Authenticated users can report content issues"'), "issue insert must require authentication");

// ---- user_roles: self-read + admin management, recursion-safe ----
assert.ok(migration.includes("security definer"), "role helper must be SECURITY DEFINER (recursion-safe)");
assert.ok(migration.includes("current_app_role"), "role helper missing");
assert.ok(migration.includes('"Users can read own role"') && migration.includes("user_id = auth.uid()"), "self-read policy missing");
assert.ok(migration.includes('"Admin+ can read all roles"'), "admin role-read policy missing");
assert.ok(migration.includes('"Admin+ can update roles"') && migration.includes('"Admin+ can delete roles"'), "admin role-write policies missing");

// ---- sync tables: quality+ read/review, admin+ manage ----
assert.ok(migration.includes('"Quality+ can read sync runs"'), "sync_runs read policy missing");
assert.ok(migration.includes('"Quality+ can read staged sync changes"'), "staged read policy missing");
assert.ok(migration.includes('"Quality+ can update staged sync changes"'), "staged review policy missing");
assert.ok(migration.includes('"Admin+ can insert sync runs"'), "sync_runs insert policy missing");

// ---- RPC surface ----
assert.ok(migration.includes("search_chapters") && migration.includes("from public, anon"), "anon must not execute search_chapters");

// ---- Idempotent + defensive ----
assert.ok((migration.match(/drop policy if exists/g) ?? []).length >= 12, "policies must be dropped-if-exists (idempotent)");
assert.ok((migration.match(/to_regclass/g) ?? []).length >= 6, "table existence must be checked (safe across environments)");

// ---- App still uses only the anon key + cookies (RLS applies) ----
const serverClient = read("lib/supabase-server.ts");
assert.ok(serverClient.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"), "server client must keep using the anon key (RLS enforced)");
assert.ok(!/SERVICE_ROLE/i.test(serverClient), "no service-role usage in the server client");

console.log("RLS policy checks passed.");
