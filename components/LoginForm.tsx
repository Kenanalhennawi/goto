"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

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

    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        Quality team sign in
      </h1>
      <p className="mb-8 text-sm text-ink-muted">
        For editing chapters and reviewing PDF syncs. Agents do not need an account to browse.
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
      <p className="mt-5 text-center text-sm text-ink-muted">
        Need access?{" "}
        <Link href="/signup" className="font-semibold text-accent">
          Create an account
        </Link>
      </p>
    </div>
  );
}
