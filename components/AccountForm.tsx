"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { SignOutButton } from "@/components/SignOutButton";

export function AccountForm({ email, roleLabel }: { email: string; roleLabel: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handlePasswordChange(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All password fields are required.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (newPassword === currentPassword) {
      setError("New password must be different from current password.");
      return;
    }

    setLoading(true);
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (verifyError) {
      setLoading(false);
      setError("Current password is incorrect.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage("Password updated.");
  }

  return (
    <section className="content-card w-full max-w-xl p-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Account
      </p>
      <h1 className="font-display text-2xl font-semibold text-ink">Profile</h1>
      <dl className="mt-5 rounded-xl border border-border bg-white p-4 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-muted">Email</dt>
          <dd className="font-semibold text-ink">{email}</dd>
        </div>
        <div className="mt-3 flex items-center justify-between gap-4 border-t border-border pt-3">
          <dt className="text-ink-muted">Access</dt>
          <dd className="font-semibold text-ink">{roleLabel}</dd>
        </div>
      </dl>

      <form onSubmit={handlePasswordChange} className="mt-6 space-y-4">
        <Field label="Current password">
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-ink focus:border-accent"
            placeholder="Current password"
          />
        </Field>
        <Field label="New password">
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
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
          {loading ? "Updating..." : "Change password"}
        </button>
      </form>

      <div className="mt-5 border-t border-border pt-5">
        <SignOutButton />
      </div>
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
