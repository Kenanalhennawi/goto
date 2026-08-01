import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeRelativePath } from "./lib/auth/safe-redirect";

// SEC-1 internal access boundary.
// 1. Refreshes the Supabase auth session on every request (required by
//    @supabase/ssr so server components see an up-to-date login state).
// 2. Enforces authentication for EVERY route except the public auth routes.
//    Unauthenticated page requests redirect to /login?next=<safe-relative>;
//    unauthenticated API requests receive a consistent 401 JSON body.
// 3. Applies security headers (frame, referrer, permissions, CSP, robots)
//    and a no-store cache policy on protected pages so nothing internal is
//    recoverable from the browser cache after logout.
// Role-based authorization stays where it already lives: server-side checks
// in the Admin pages and the per-route API guards (lib/auth/guards.ts), with
// Supabase RLS as the final boundary.

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];
const PUBLIC_FILES = ["/robots.txt"];

function isPublicPath(pathname: string) {
  if (PUBLIC_FILES.includes(pathname)) return true;
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function applySecurityHeaders(response: NextResponse, isProtectedPage: boolean) {
  const headers = response.headers;
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      // Next.js requires inline scripts/styles for hydration; eval is needed by dev tooling.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ")
  );
  if (isProtectedPage) {
    // Internal pages must never be recoverable from the browser cache (e.g.
    // via the Back button after logout). Server-side caching is unaffected.
    headers.set("Cache-Control", "no-store, max-age=0");
  }
  return response;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isApi = pathname === "/api" || pathname.startsWith("/api/");
  const publicRoute = isPublicPath(pathname);

  if (!user && !publicRoute) {
    if (isApi) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Authentication required", errorCode: "AUTH_REQUIRED" },
          { status: 401 }
        ),
        false
      );
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    const next = safeRelativePath(`${pathname}${search}`);
    if (next !== "/") loginUrl.searchParams.set("next", next);
    return applySecurityHeaders(NextResponse.redirect(loginUrl), false);
  }

  return applySecurityHeaders(response, !publicRoute && !isApi);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
