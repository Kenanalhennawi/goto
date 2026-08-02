// SEC-1 — per-route API authorization checks.
// Every API route must call a shared guard; no route may rely on UI gating.
// Run with: node scripts/check-api-authorization.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");

// Collect every route.ts under app/api.
function routeFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}
const routes = routeFiles(join(root, "app/api"));
assert.ok(routes.length >= 8, `expected at least 8 API routes (found ${routes.length})`);

// Expected guard level per route (path fragment -> guard).
const EXPECTED = [
  ["api/search", "requireUser"],
  ["api/issues/[id]", "requireReviewer"], // PATCH; DELETE uses requireAdmin too
  ["api/issues", "requireUser"],
  ["api/chapters", "requireReviewer"],
  // Read-only worker status for the admin screens. Reviewer-level on purpose:
  // quality reviewers must be able to see that processing is running, and it
  // exposes no run content — only online/offline, queue depth and timestamps.
  ["api/sync/health", "requireReviewer"],
  ["api/sync-runs/cleanup", "requireAdmin"],
  ["api/sync-runs", "requireAdmin"],
  ["api/sync", "requireAdmin"],
  ["api/admin/users", "requireAdmin"],
];

for (const file of routes) {
  const rel = file.slice(root.length).replace(/\\/g, "/");
  const src = readFileSync(file, "utf8");
  const expected = EXPECTED.find(([fragment]) => rel.includes(fragment));
  assert.ok(expected, `no expected guard registered for ${rel} — classify it`);
  assert.ok(src.includes(expected[1]), `${rel} must call ${expected[1]}()`);
  assert.ok(src.includes("session.response") || src.includes("session.ok"), `${rel} must return the guard response on failure`);
  // No route may keep a hand-rolled session check (consistency requirement).
  assert.ok(!src.includes("supabase.auth.getUser()"), `${rel} must use the shared guards, not inline auth`);
  // Never leak raw Supabase/postgres errors.
  // PUB-1.1: the bare-substring form of this check was passing by luck — a route
  // that named its variable `rpcError` slipped through while `error` did not.
  // What actually matters is whether a database message reaches the CLIENT, so
  // check the response bodies, not the whole file. Routes may still read
  // `<x>Error.message` server-side to classify a failure or write a server log.
  assert.ok(!src.includes("String(error)"), `${rel} must not stringify raw errors`);
  for (const [, body] of src.matchAll(/NextResponse\.json\(\s*(\{[\s\S]*?\})\s*(?:,|\))/g)) {
    assert.ok(
      !/\b\w*[eE]rror\.(message|details|hint)\b/.test(body),
      `${rel} must not put a raw database message in a response body`
    );
    assert.ok(
      !/\bString\(\s*\w*[eE]rror\s*\)/.test(body),
      `${rel} must not stringify an error into a response body`
    );
  }
}

// The issues [id] route keeps both levels (reviewer PATCH, admin DELETE).
const issueRoute = read("app/api/issues/[id]/route.ts");
assert.ok(issueRoute.includes("requireReviewer") && issueRoute.includes("requireAdmin"), "issue route must keep reviewer PATCH + admin DELETE");

// Search API: authenticated + private, no-store on every payload.
const search = read("app/api/search/route.ts");
assert.ok(search.includes("requireUser"), "search API must require a session");
assert.ok(search.includes('"Cache-Control": "private, no-store"'), "search API must send private, no-store");
assert.ok(!/NextResponse\.json\(\{ results/.test(search), "search payloads must flow through the no-store helper");
// Ranking inputs unchanged: published+approved filter + same threshold/caps.
assert.ok(search.includes('.eq("is_published", true)') && search.includes('.eq("review_status", "approved")'), "published+approved filter must remain");
assert.ok(search.includes("score >= 2500") && search.includes(".slice(0, 8)"), "search threshold and card cap must remain unchanged");

// Issues POST now stores the authenticated reporter (no anonymous reports).
const issues = read("app/api/issues/route.ts");
assert.ok(issues.includes("reported_by: user.id"), "issue reports must record the authenticated reporter");
assert.ok(!issues.includes("user?.id ?? null"), "issue reports must no longer be anonymous");

// Guards: consistent bodies, correct roles, no service-role usage anywhere.
const guards = read("lib/auth/guards.ts");
assert.ok(guards.includes('errorCode: "AUTH_REQUIRED"') && guards.includes("status: 401"), "401 body must be consistent");
assert.ok(guards.includes('errorCode: "FORBIDDEN"') && guards.includes("status: 403"), "403 body must be consistent");
assert.ok(guards.includes("canAccessAdmin") && guards.includes("canManageUsers"), "guards must reuse the existing permission helpers");
for (const file of routes) {
  const src = readFileSync(file, "utf8");
  assert.ok(!/SERVICE_ROLE|service_role/i.test(src), "no API route may use the service role key");
}

console.log("API authorization checks passed.");
