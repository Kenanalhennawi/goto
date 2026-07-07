"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export function SignupForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    setLoading(false);

    if (signupError) {
      setError(signupError.message);
      return;
    }

    setMessage("Account created. An admin or owner must assign special access.");
    window.setTimeout(() => router.push("/login"), 1800);
  }

  return (
    <section className="content-card w-full p-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Access request
      </p>
      <h1 className="font-display text-2xl font-semibold text-ink">Create account</h1>
      <p className="mt-2 text-sm leading-6 text-ink-muted">
        New accounts can browse and manage their account. Editor/admin access requires approval.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="Full name">
          <input
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-ink focus:border-accent"
            placeholder="Your name"
          />
        </Field>
        <Field label="Email">
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-ink focus:border-accent"
            placeholder="you@flydubai.com"
          />
        </Field>
        <Field label="Password">
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-ink focus:border-accent"
            placeholder="Minimum 8 characters"
          />
        </Field>

        {error && <p className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-sm text-accent">{error}</p>}
        {message && <p className="rounded-lg border border-green-200 bg-mint-soft px-3 py-2 text-sm text-good">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-accent">
          Sign in
        </Link>
      </p>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
