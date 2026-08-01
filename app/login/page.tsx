import { SiteHeader } from "@/components/SiteHeader";
import { LoginForm } from "@/components/LoginForm";
import { safeRelativePath } from "@/lib/auth/safe-redirect";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // AUTH-UX-1: explain WHY the user landed here when proxy.ts redirected a
  // protected route. The value is validated with the same safe-redirect helper
  // used for the redirect itself, and the requested path is never rendered.
  const { next } = await searchParams;
  const redirected = safeRelativePath(next, "/") !== "/";

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-sm">
          {redirected ? (
            <p
              role="status"
              className="mb-5 rounded-lg border border-border bg-white px-4 py-3 text-sm leading-6 text-ink-muted"
            >
              Sign in to continue to the requested page.
            </p>
          ) : null}
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
