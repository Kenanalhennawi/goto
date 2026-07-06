"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage("Password updated. You can now sign in.");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <section className="content-card w-full max-w-sm p-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Reset password
      </p>
      <h1 className="font-display text-2xl font-semibold text-ink">Choose a new password</h1>
      <p className="mt-2 text-sm leading-6 text-ink-muted">
        This page works after opening the reset link from your email.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="New password">
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-ink focus:border-accent"
            placeholder="Minimum 8 characters"
          />
        </Field>
        <Field label="Confirm password">
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-ink focus:border-accent"
            placeholder="Repeat password"
          />
        </Field>

        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {message && <p className="rounded-lg border border-green-200 bg-mint-soft px-3 py-2 text-sm text-good">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dim disabled:opacity-50"
        >
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-muted">
        Done?{" "}
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
