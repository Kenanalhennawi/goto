import type { UserRole } from "@/lib/types";

export type NormalizedRole = "quality" | "admin" | "owner" | null;
export type RoleInput = UserRole | string | null | undefined;

export function normalizeRole(role: RoleInput): NormalizedRole {
  if (role === "quality" || role === "editor") return "quality";
  if (role === "admin" || role === "owner") return role;
  return null;
}

export function hasAssignedRole(role: RoleInput) {
  return normalizeRole(role) !== null;
}

export function canAccessAdmin(role: RoleInput) {
  return ["quality", "admin", "owner"].includes(normalizeRole(role) ?? "");
}

export function canReviewProcedures(role: RoleInput) {
  return canAccessAdmin(role);
}

export function canEditProcedures(role: RoleInput) {
  return canAccessAdmin(role);
}

export function canApproveProcedures(role: RoleInput) {
  return canAccessAdmin(role);
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
  if (role === "editor") return "quality";
  const normalized = normalizeRole(role);
  if (!normalized) return "No special access";
  return normalized;
}
