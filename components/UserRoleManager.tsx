"use client";

import { useState } from "react";
import type { UserRole } from "@/lib/types";
import { canManageUsers, isOwner, normalizeRole, normalizeRoleLabel } from "@/lib/permissions";

interface UserRow {
  user_id: string;
  role: UserRole | null;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

type RoleSelection = "no_special_access" | "editor" | "admin" | "owner";

export function UserRoleManager({
  users,
  currentUserId,
  currentRole,
}: {
  users: UserRow[];
  currentUserId: string;
  currentRole: UserRole | string | null;
}) {
  const [rows, setRows] = useState(users);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateRole(userId: string, role: RoleSelection) {
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

      setRows((prev) =>
        prev.map((row) =>
          row.user_id === userId ? { ...row, role: role === "no_special_access" ? null : role } : row
        )
      );
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
      <div className="grid grid-cols-[1fr_180px_150px_230px] gap-3 border-b border-border bg-sky-soft px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
        <span>User</span>
        <span>Created</span>
        <span>Current role</span>
        <span>Set access</span>
      </div>
      {rows.map((user) => {
        const isSelf = user.user_id === currentUserId;
        const targetRole = normalizeRole(user.role);
        const canChange =
          !isSelf &&
          canManageUsers(currentRole) &&
          (isOwner(currentRole) || targetRole !== "owner");

        return (
          <div
            key={user.user_id}
            className="grid grid-cols-[1fr_180px_150px_230px] items-center gap-3 border-b border-border px-4 py-3 text-sm last:border-0"
          >
            <div>
              <p className="font-semibold text-ink">{user.full_name ?? "Unnamed user"}</p>
              <p className="text-xs text-ink-muted">{user.email ?? "Email not available"}</p>
              <p className="font-mono text-xs text-ink-faint">{user.user_id}</p>
              {isSelf && <p className="mt-1 text-xs font-semibold text-accent">This is you</p>}
            </div>
            <span className="text-xs text-ink-muted">{safeDate(user.created_at)}</span>
            <RoleBadge role={user.role} />
            <select
              value={targetRole ?? "no_special_access"}
              disabled={!canChange || savingId === user.user_id}
              onChange={(event) => updateRole(user.user_id, event.target.value as RoleSelection)}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink disabled:opacity-50"
            >
              <option value="no_special_access">No special access</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
              {isOwner(currentRole) && <option value="owner">Owner</option>}
            </select>
          </div>
        );
      })}
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole | null }) {
  const normalized = normalizeRole(role);
  const styles: Record<"none" | "editor" | "admin" | "owner", string> = {
    none: "border-border bg-white text-ink-faint",
    editor: "border-green-200 bg-mint-soft text-good",
    admin: "border-purple-200 bg-purple-50 text-purple-700",
    owner: "border-orange-200 bg-orange-50 text-accent",
  };

  return (
    <span
      className={`w-max rounded-full border px-3 py-1 text-xs font-semibold ${
        styles[normalized ?? "none"]
      }`}
    >
      {normalizeRoleLabel(role)}
    </span>
  );
}

function safeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}
