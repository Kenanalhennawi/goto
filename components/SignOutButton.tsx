"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export function SignOutButton({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    setLoading(true);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const styles =
    variant === "dark"
      ? "rounded border border-white/25 px-2.5 py-1.5 text-[13px] font-medium text-white/85 transition-colors hover:border-accent hover:bg-accent hover:text-white disabled:opacity-50"
      : "rounded border border-border bg-white px-3 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50";

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className={styles}
    >
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
