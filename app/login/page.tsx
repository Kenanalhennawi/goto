"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { SiteHeader } from "@/components/SiteHeader";

export default function LoginPage() {
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
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">
            Quality team sign in
          </h1>
          <p className="text-sm text-ink-muted mb-8">
            For editing chapters and reviewing PDF syncs. Agents don&rsquo;t need an account
            to browse or search.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs text-ink-muted mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-panel border border-border rounded-lg px-4 py-2.5 text-ink focus:border-accent transition-colors"
                placeholder="you@flydubai.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs text-ink-muted mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-panel border border-border rounded-lg px-4 py-2.5 text-ink focus:border-accent transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-accent bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-base font-medium rounded-lg py-2.5 hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
