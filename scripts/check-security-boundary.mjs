// SEC-1 — middleware boundary, safe redirect, headers, robots.
// Run with: node scripts/check-security-boundary.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const proxy = read("proxy.ts");
const robots = read("public/robots.txt");
const login = read("components/LoginForm.tsx");

// ---- Public allowlist is exactly the auth routes (+robots) ----
assert.ok(proxy.includes('const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"]'), "public allowlist must be exactly the three auth routes");
assert.ok(proxy.includes('"/robots.txt"'), "robots.txt must remain reachable");
assert.ok(!proxy.includes('"/signup"'), "signup must NOT be publicly reachable (admin-invited accounts only)");

// ---- Unauthenticated behavior ----
assert.ok(proxy.includes('loginUrl.pathname = "/login"'), "pages must redirect to /login");
assert.ok(proxy.includes('searchParams.set("next", next)'), "redirect must carry a next param");
assert.ok(proxy.includes("safeRelativePath"), "next param must pass the safe-redirect helper");
assert.ok(proxy.includes('errorCode: "AUTH_REQUIRED"') && proxy.includes("status: 401"), "APIs must return 401 AUTH_REQUIRED JSON");
assert.ok(proxy.includes('pathname.startsWith("/api/")'), "API detection missing");

// ---- Session refresh still happens before enforcement ----
assert.ok(proxy.includes("supabase.auth.getUser()"), "session refresh must remain");

// ---- Security headers ----
for (const header of [
  '"X-Frame-Options", "DENY"',
  '"Referrer-Policy", "no-referrer"',
  '"Permissions-Policy"',
  '"X-Robots-Tag", "noindex, nofollow, noarchive"',
  '"Content-Security-Policy"',
  "frame-ancestors 'none'",
  '"X-Content-Type-Options", "nosniff"',
]) {
  assert.ok(proxy.includes(header), `security header ${header} missing`);
}
// ---- Cache posture (SEC-1.1) ----
// Protected pages (and login redirects) must not be cacheable anywhere.
assert.ok(proxy.includes('"Cache-Control", "private, no-store, max-age=0"'), "protected pages must send private, no-store, max-age=0");
// Every protected API response — including the middleware 401 — is private.
// The middleware sets this because edge headers override route-handler headers,
// which is how the platform default (public, max-age=0, must-revalidate) was
// previously leaking onto the 401.
assert.ok(proxy.includes('"Cache-Control", "private, no-store"'), "protected API responses must send private, no-store");
assert.ok(proxy.includes('"protected-api"') && proxy.includes('"protected-page"') && proxy.includes('"public-page"'), "response classes missing");
// The 401 branch and the redirect branch must both be classified as protected.
assert.ok(/status: 401[\s\S]{0,40}\),\s*"protected-api"/.test(proxy), "middleware 401 must be protected-api classified");
assert.ok(/NextResponse\.redirect\(loginUrl\), "protected-page"/.test(proxy), "login redirect must be protected-page classified");
// No protected response may ever be marked public.
assert.ok(!proxy.includes('"Cache-Control", "public'), "no protected response may set a public cache header");
// Route-level defense-in-depth stays: authenticated /api/search payloads are
// also private, no-store at the handler level.
const searchRoute = read("app/api/search/route.ts");
assert.ok(searchRoute.includes('"Cache-Control": "private, no-store"'), "search route must keep private, no-store on authenticated responses");

// ---- Safe redirect helper behavior (runtime) ----
const { safeRelativePath } = await import("../lib/auth/safe-redirect.ts");
assert.equal(safeRelativePath("/search?q=visa"), "/search?q=visa");
assert.equal(safeRelativePath("/procedure/name-correction"), "/procedure/name-correction");
assert.equal(safeRelativePath("https://evil.example"), "/");
assert.equal(safeRelativePath("//evil.example"), "/");
assert.equal(safeRelativePath("javascript:alert(1)"), "/");
assert.equal(safeRelativePath("/\\evil.example"), "/");
assert.equal(safeRelativePath("/ok:nope"), "/");
assert.equal(safeRelativePath(null), "/");
assert.equal(safeRelativePath(undefined, "/account"), "/account");
assert.equal(safeRelativePath("", "/account"), "/account");

// ---- Login honors ?next= through the safe helper only ----
assert.ok(login.includes("safeRelativePath"), "LoginForm must sanitize the next param");
assert.ok(login.includes('params.get("next")'), "LoginForm must read the next param");

// ---- Robots: no crawling ----
assert.ok(/User-agent: \*/.test(robots) && /Disallow: \//.test(robots), "robots.txt must disallow all crawling");

console.log("Security boundary checks passed.");
