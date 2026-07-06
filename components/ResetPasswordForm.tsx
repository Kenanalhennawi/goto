"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function recoverSession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashType = hashParams.get("type");

      if (accessToken && refreshToken && hashType === "recovery") {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (setSessionError) {
          console.error("Password reset setSession failed", setSessionError);
          setError(resetLinkErrorMessage);
          setReady(false);
          return;
        }

        window.history.replaceState({}, "", "/reset-password");
      } else if (tokenHash && type === "recovery") {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });

        if (verifyError) {
          console.error("Password reset token_hash verification failed", verifyError);
          setError(resetLinkErrorMessage);
          setReady(false);
          return;
        }

        window.history.replaceState({}, "", "/reset-password");
      } else if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          console.error("Password reset PKCE exchange failed", exchangeError);
          setError(isPkceVerifierError(exchangeError.message) ? pkceErrorMessage : resetLinkErrorMessage);
          setReady(false);
          return;
        }
        window.history.replaceState({}, "", "/reset-password");
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("Password reset session lookup failed", sessionError);
        setError(resetLinkErrorMessage);
        setReady(false);
        return;
      }

      if (!session) {
        setError("Open this page from the password reset email link, then choose a new password.");
        setReady(false);
        return;
      }

      setReady(true);
    }

    recoverSession();
  }, [supabase.auth]);

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
          disabled={loading || !ready}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dim disabled:opacity-50"
        >
          {loading ? "Updating..." : ready ? "Update password" : "Waiting for reset link"}
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

const pkceErrorMessage =
  "This reset link could not be opened in this browser session. Please request a new reset email and open the link in the same browser, or contact admin.";

const resetLinkErrorMessage =
  "This reset link could not be verified. Please request a new reset email, or contact admin.";

function isPkceVerifierError(message: string) {
  return message.toLowerCase().includes("pkce") || message.toLowerCase().includes("code verifier");
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
