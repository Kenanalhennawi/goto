// AUTH-UX-1 — signed-out experience matches the internal-only access model.
// Run with: node scripts/check-auth-ux.mjs
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const header = read("components/SiteHeader.tsx");
const layout = read("app/layout.tsx");
const loginForm = read("components/LoginForm.tsx");
const loginPage = read("app/login/page.tsx");
const palette = read("components/CommandPalette.tsx");
const proxy = read("proxy.ts");
const searchApi = read("app/api/search/route.ts");

// The signed-out branch of SiteHeader is the early-return block, i.e. from
// `if (!user) {` up to where the authenticated nav is built.
const signedOutStart = header.indexOf("if (!user) {");
const signedOutEnd = header.indexOf("const navItems");
assert.ok(signedOutStart > 0, "SiteHeader must early-return a signed-out header");
assert.ok(signedOutEnd > signedOutStart, "authenticated nav must be built after the signed-out return");
const signedOutBranch = header.slice(signedOutStart, signedOutEnd);

// ---- 1. No operational navigation while signed out ----
for (const label of ["Home", "Search", "Guided decision", "Browse services", "Admin", "Guided", "Services"]) {
  assert.ok(
    !new RegExp(`>\\s*${label}\\s*<`).test(signedOutBranch),
    `signed-out header must not render '${label}'`
  );
}
assert.ok(!signedOutBranch.includes("SidebarNav"), "signed-out header must not render SidebarNav");
assert.ok(!signedOutBranch.includes('href="/search"'), "no /search link when signed out");
assert.ok(!signedOutBranch.includes('href="/decision"'), "no /decision link when signed out");
assert.ok(!signedOutBranch.includes('href="/services"'), "no /services link when signed out");
assert.ok(!signedOutBranch.includes('href="/admin"'), "no /admin link when signed out");
assert.ok(!/href="\/"/.test(signedOutBranch), "no operational home link when signed out");

// ---- 2. No SearchTrigger while signed out ----
assert.ok(!signedOutBranch.includes("SearchTrigger"), "signed-out header must not mount SearchTrigger");
// Identity + sign-in remain.
assert.ok(signedOutBranch.includes("GO TO"), "signed-out header keeps the application identity");
assert.ok(signedOutBranch.includes('href="/login"'), "signed-out header keeps a Sign in action");

// ---- 3 & 4. Palette and shortcuts mount only for an authenticated session ----
assert.ok(layout.includes("createServerSupabaseClient"), "layout must resolve the session server-side");
assert.ok(layout.includes("supabase.auth.getUser()"), "layout must read the authenticated user");
assert.ok(
  /\{user \?[\s\S]{0,200}<CommandPalette \/>[\s\S]{0,200}<KeyboardShortcuts \/>[\s\S]{0,80}\) : null\}/.test(layout),
  "CommandPalette and KeyboardShortcuts must be gated behind a user session"
);
assert.ok(layout.includes("export default async function RootLayout"), "root layout must be async to await the session");

// ---- 5. No signup links anywhere in the signed-out surface ----
for (const [name, src] of [
  ["SiteHeader", header],
  ["LoginForm", loginForm],
  ["login page", loginPage],
  ["layout", layout],
]) {
  assert.ok(!src.includes('href="/signup"'), `${name} must not link to /signup`);
  assert.ok(!/Create an account/i.test(src), `${name} must not offer account creation`);
}

// ---- 6. Internal-tool access message replaces the anonymous-browsing claim ----
assert.ok(
  loginForm.includes("This is an internal operational tool. Sign in with your authorised account to continue."),
  "login must state the internal-only access model"
);
assert.ok(!/do not need an account/i.test(loginForm), "anonymous-browsing claim must be gone");
assert.ok(!/Quality team sign in/.test(loginForm), "heading must be neutral");
assert.ok(loginForm.includes("Sign in to GO TO"), "neutral internal-tool heading missing");

// ---- 7. Protected-route redirect is explained, without echoing the path ----
assert.ok(
  loginPage.includes("Sign in to continue to the requested page."),
  "redirect explanation missing"
);
assert.ok(loginPage.includes("safeRelativePath"), "next must be validated with the safe-redirect helper");
assert.ok(!/\{next\}/.test(loginPage), "the raw requested path must never be rendered");
assert.ok(!/\{redirected \? [\s\S]{0,200}\{next/.test(loginPage), "the raw path must not leak into the banner");

// ---- 8. Password recovery stays reachable ----
assert.ok(loginForm.includes('href="/forgot-password"'), "forgot-password link must remain");
for (const p of ["app/forgot-password/page.tsx", "app/reset-password/page.tsx"]) {
  assert.ok(existsSync(new URL(`../${p}`, import.meta.url)), `${p} must remain`);
}
assert.ok(proxy.includes('"/forgot-password"') && proxy.includes('"/reset-password"'), "recovery routes stay public");

// ---- 9. Signed-in navigation is unchanged ----
const signedInBranch = header.slice(signedOutEnd);
for (const label of ['label: "Home"', 'label: "Search"', 'label: "Guided decision"', 'label: "Browse services"']) {
  assert.ok(header.includes(label), `authenticated nav must keep ${label}`);
}
assert.ok(signedInBranch.includes("SidebarNav"), "authenticated sidebar unchanged");
assert.ok(signedInBranch.includes("SearchTrigger"), "authenticated search trigger unchanged");
assert.ok(header.includes("canAccessAdmin"), "admin gating unchanged");
assert.ok(header.includes('label: "Admin"'), "admin entry unchanged for permitted roles");
assert.ok(signedInBranch.includes("SignOutButton"), "authenticated account block unchanged");

// ---- 10. Authenticated palette/search behaviour unchanged ----
assert.ok(palette.includes("/api/search?q="), "palette still uses the existing search API");
assert.ok(palette.includes("MIN_SEARCH_QUERY_LENGTH"), "palette query threshold unchanged");
assert.ok(palette.includes("No matches. Try an SSR code, service name, or passenger issue."), "normal empty state retained");
// A 401/403 is reported as an auth condition, never as "no matches".
assert.ok(
  /res\.status === 401 \|\| res\.status === 403/.test(palette),
  "palette must detect unauthenticated responses"
);
assert.ok(palette.includes("Sign in required"), "palette must show a sign-in state instead of 'No matches'");
assert.ok(palette.includes("setAuthRequired(false)"), "auth state must reset on a successful response");

// ---- 11. /api/search still requires authentication ----
assert.ok(searchApi.includes("requireUser"), "search API must still require a session");
assert.ok(proxy.includes('errorCode: "AUTH_REQUIRED"') && proxy.includes("status: 401"), "middleware still 401s APIs");
assert.ok(searchApi.includes('.eq("is_published", true)') && searchApi.includes('.eq("review_status", "approved")'), "publication gating unchanged");

// ---- 12. /signup remains present but blocked and unlinked ----
assert.ok(existsSync(new URL("../app/signup/page.tsx", import.meta.url)), "signup route kept in the repository");
assert.ok(!proxy.includes('"/signup"'), "signup must NOT be a public route");
const PUBLIC = proxy.match(/const PUBLIC_PATHS = \[(.*?)\]/s)[1];
assert.deepEqual(
  PUBLIC.match(/"[^"]+"/g),
  ['"/login"', '"/forgot-password"', '"/reset-password"'],
  "public allowlist unchanged"
);

// ---- Security boundary untouched ----
assert.ok(proxy.includes("safeRelativePath"), "safe redirect still applied to next");
assert.ok(proxy.includes('loginUrl.pathname = "/login"'), "protected pages still redirect to login");

console.log("Auth UX checks passed.");
