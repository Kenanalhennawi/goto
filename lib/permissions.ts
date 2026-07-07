import type { UserRole } from "@/lib/types";

export type NormalizedRole = "editor" | "admin" | "owner" | null;
export type RoleInput = UserRole | string | null | undefined;

export function normalizeRole(role: RoleInput): NormalizedRole {
  if (role === "quality" || role === "editor") return "editor";
  if (role === "admin" || role === "owner") return role;
  return null;
}

export function hasAssignedRole(role: RoleInput) {
  return normalizeRole(role) !== null;
}

export function isEditorRole(role: RoleInput) {
  return ["editor", "admin", "owner"].includes(normalizeRole(role) ?? "");
}

export function canReviewProcedures(role: RoleInput) {
  return isEditorRole(role);
}

export function canEditProcedures(role: RoleInput) {
  return isEditorRole(role);
}

export function canApproveProcedures(role: RoleInput) {
  return isEditorRole(role);
}

export function canArchiveProcedures(role: RoleInput) {
  return ["admin", "owner"].includes(normalizeRole(role) ?? "");
}

export function canManageUsers(role: RoleInput) {
  return ["admin", "owner"].includes(normalizeRole(role) ?? "");
}

export function isOwner(role: RoleInput) {
  return normalizeRole(role) === "owner";
}

export function normalizeRoleLabel(role: RoleInput) {
  if (role === "quality") return "editor (legacy quality)";
  const normalized = normalizeRole(role);
  if (!normalized) return "No special access";
  return normalized;
}
