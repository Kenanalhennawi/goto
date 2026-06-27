"use client";

import { useState } from "react";
import type { UserRole } from "@/lib/types";

interface UserRow {
  user_id: string;
  role: UserRole;
  full_name: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  agent: "Pending / no edit",
  supervisor: "Supervisor",
  quality: "Editor",
  admin: "Admin",
  owner: "Owner",
};

export function UserRoleManager({
  users,
  currentUserId,
  currentRole,
}: {
  users: UserRow[];
  currentUserId: string;
  currentRole: UserRole;
}) {
  const [rows, setRows] = useState(users);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateRole(userId: string, role: UserRole) {
    setSavingId(userId);
    setError(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not update user role.");
        return;
      }

      setRows((prev) => prev.map((row) => (row.user_id === userId ? { ...row, role } : row)));
    } catch {
      setError("Could not update user role. Check your connection and try again.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="content-card overflow-hidden">
      {error && (
        <p className="border-b border-accent/20 bg-accent/10 px-4 py-3 text-sm text-accent">
          {error}
        </p>
      )}
      <div className="grid grid-cols-[1fr_150px_230px] gap-3 border-b border-border bg-sky-soft px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
        <span>User</span>
        <span>Current role</span>
        <span>Set access</span>
      </div>
      {rows.map((user) => {
        const isSelf = user.user_id === currentUserId;
        const isOwner = user.role === "owner";
        const canChange =
          !isSelf &&
          (currentRole === "owner" || (currentRole === "admin" && !isOwner));

        return (
          <div
            key={user.user_id}
            className="grid grid-cols-[1fr_150px_230px] items-center gap-3 border-b border-border px-4 py-3 text-sm last:border-0"
          >
            <div>
              <p className="font-semibold text-ink">{user.full_name ?? "Unnamed user"}</p>
              <p className="font-mono text-xs text-ink-faint">{user.user_id}</p>
              {isSelf && <p className="mt-1 text-xs font-semibold text-accent">This is you</p>}
            </div>
            <RoleBadge role={user.role} />
            <select
              value={user.role}
              disabled={!canChange || savingId === user.user_id}
              onChange={(event) => updateRole(user.user_id, event.target.value as UserRole)}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink disabled:opacity-50"
            >
              <option value="agent">Pending / no edit</option>
              <option value="supervisor">Supervisor</option>
              <option value="quality">Editor</option>
              <option value="admin">Admin</option>
              {currentRole === "owner" && <option value="owner">Owner</option>}
            </select>
          </div>
        );
      })}
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const styles: Record<UserRole, string> = {
    agent: "border-amber-200 bg-amber-soft text-warn",
    supervisor: "border-blue-200 bg-sky-soft text-sky",
    quality: "border-green-200 bg-mint-soft text-good",
    admin: "border-purple-200 bg-purple-50 text-purple-700",
    owner: "border-orange-200 bg-orange-50 text-accent",
  };

  return (
    <span className={`w-max rounded-full border px-3 py-1 text-xs font-semibold ${styles[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}
