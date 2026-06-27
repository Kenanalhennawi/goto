"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function IssueStatusSelect({ id, status }: { id: string; status: string }) {
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function update(nextStatus: string) {
    setValue(nextStatus);
    setSaving(true);
    const res = await fetch(`/api/issues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setSaving(false);

    if (!res.ok) {
      setValue(status);
      return;
    }

    router.refresh();
  }

  return (
    <select
      value={value}
      onChange={(event) => update(event.target.value)}
      disabled={saving}
      className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-ink"
    >
      <option value="open">Open</option>
      <option value="reviewing">Reviewing</option>
      <option value="resolved">Resolved</option>
      <option value="dismissed">Dismissed</option>
    </select>
  );
}
