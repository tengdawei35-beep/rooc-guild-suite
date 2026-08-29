// =============================================================
// APPLICATION ROLES & PERMISSIONS
// =============================================================

export const USER_ROLES = [
  "ADMIN",
  "MANAGER",
  "OFFICER",
  "MEMBER",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  OFFICER: "Officer",
  MEMBER: "Member",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: "Full administrative access to the guild.",
  MANAGER: "Manage guild members, users, events, rosters and allocation.",
  OFFICER: "Manage guild members, events, rosters and allocation operations.",
  MEMBER: "View guild data and edit their own profile.",
};

export type Permission =
  | "members.view"
  | "members.edit"
  | "members.delete"
  | "members.import"
  | "profile.editOwn"
  | "leave.manageOwn"
  | "leave.manageAny"
  | "events.view"
  | "events.manage"
  | "rosters.view"
  | "rosters.edit"
  | "allocation.view"
  | "allocation.run"
  | "users.view"
  | "users.manage"
  | "guild.manage";

export function hasPermission(role: UserRole, permission: Permission): boolean {
  if (role === "ADMIN") return true;

  if (role === "MANAGER") {
    return permission !== "guild.manage";
  }

  if (role === "OFFICER") {
    return [
      "members.view", "members.edit", "members.delete", "members.import",
      "profile.editOwn", "leave.manageOwn", "leave.manageAny",
      "events.view", "events.manage", "rosters.view", "rosters.edit",
      "allocation.view", "allocation.run", "users.view",
    ].includes(permission);
  }

  if (role === "MEMBER") {
    return [
      "members.view", "profile.editOwn", "leave.manageOwn",
      "events.view", "rosters.view",
    ].includes(permission);
  }

  return false;
}

export function canManageRole(
  actorRole: UserRole,
  targetCurrentRole: UserRole,
  targetNewRole: UserRole
): boolean {
  if (actorRole === "OFFICER" || actorRole === "MEMBER") return false;

  if (actorRole === "ADMIN") {
    return targetCurrentRole !== "ADMIN" && targetNewRole !== "ADMIN";
  }

  if (actorRole === "MANAGER") {
    return (
      (targetCurrentRole === "OFFICER" || targetCurrentRole === "MEMBER") &&
      targetNewRole !== "MANAGER"
    );
  }

  return false;
}

export const ROLE_LEVEL: Record<UserRole, number> = {
  ADMIN: 4,
  MANAGER: 3,
  OFFICER: 2,
  MEMBER: 1,
};

export function canManageTarget(
  actorRole: UserRole,
  targetRole: UserRole
): boolean {
  if (actorRole === "ADMIN") return targetRole !== "ADMIN";
  if (actorRole === "MANAGER") {
    return targetRole === "OFFICER" || targetRole === "MEMBER";
  }
  return false;
}
