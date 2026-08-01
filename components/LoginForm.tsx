"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { safeRelativePath } from "@/lib/auth/safe-redirect";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setError("Couldn't sign in. Check your email and password and try again.");
      return;
    }

    // SEC-1: honor ?next=<path> from the middleware redirect, but only ever a
    // safe same-origin relative path (open-redirect protection). Read at
    // submit time (no useSearchParams, so the page prerenders unchanged).
    const params = new URLSearchParams(window.location.search);
    router.push(safeRelativePath(params.get("next"), "/account"));
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        Sign in to GO TO
      </h1>
      <p className="mb-8 text-sm text-ink-muted">
        This is an internal operational tool. Sign in with your authorised account to continue.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs text-ink-muted">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-panel px-4 py-2.5 text-ink transition-colors focus:border-accent"
            placeholder="you@flydubai.com"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label htmlFor="password" className="block text-xs text-ink-muted">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs font-semibold text-accent hover:text-accent-dim">
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-panel px-4 py-2.5 text-ink transition-colors focus:border-accent"
            placeholder="Password"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-sm text-accent">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent py-2.5 text-base font-medium text-white transition-colors hover:bg-accent-dim disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      {/* AUTH-UX-1: public signup is intentionally unavailable — accounts are
          provisioned by an administrator. No signup link is shown. */}
      <p className="mt-5 text-center text-sm text-ink-muted">
        Accounts are provided by your administrator.
      </p>
    </div>
  );
}
