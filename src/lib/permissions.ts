// =============================================================
// APPLICATION ROLES & PERMISSIONS
// =============================================================
//
// Application access roles:
//
//   ADMIN
//   MANAGER
//   OFFICER
//   MEMBER
//
// IMPORTANT:
//
// These are separate from MemberPriority.
//
// MemberPriority continues to use:
//
//   LEADER
//   OFFICER
//   COUNCIL
//   MEMBER
//
// =============================================================

export const USER_ROLES = [
  "ADMIN",
  "MANAGER",
  "OFFICER",
  "MEMBER",
] as const;

export type UserRole =
  (typeof USER_ROLES)[number];

// =============================================================
// ROLE LABELS
// =============================================================

export const ROLE_LABELS: Record<
  UserRole,
  string
> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  OFFICER: "Officer",
  MEMBER: "Member",
};

// =============================================================
// ROLE DESCRIPTIONS
// =============================================================

export const ROLE_DESCRIPTIONS: Record<
  UserRole,
  string
> = {
  ADMIN:
    "Full administrative access to the guild.",

  MANAGER:
    "Manage guild members, users, events, rosters and allocation.",

  OFFICER:
    "Manage guild members, events, rosters and allocation operations.",

  MEMBER:
    "View guild data and edit their own profile.",
};

// =============================================================
// PERMISSIONS
// =============================================================

export type Permission =
  // Members
  | "members.view"
  | "members.edit"
  | "members.delete"
  | "members.import"

  // Own profile / leave
  | "profile.editOwn"
  | "leave.manageOwn"
  | "leave.manageAny"

  // Events
  | "events.view"
  | "events.manage"

  // Rosters
  | "rosters.view"
  | "rosters.edit"

  // Allocation
  | "allocation.view"
  | "allocation.run"

  // Users / application access
  | "users.view"
  | "users.manage"

  // Guild configuration
  | "guild.manage";

// =============================================================
// PERMISSION CHECK
// =============================================================

export function hasPermission(
  role: UserRole,
  permission: Permission
): boolean {
  // -----------------------------------------------------------
  // ADMIN
  // -----------------------------------------------------------

  if (
    role === "ADMIN"
  ) {
    return true;
  }

  // -----------------------------------------------------------
  // MANAGER
  // -----------------------------------------------------------

  if (
    role === "MANAGER"
  ) {
    switch (
      permission
    ) {
      case "members.view":
      case "members.edit":
      case "members.delete":
      case "members.import":

      case "profile.editOwn":

      case "leave.manageOwn":
      case "leave.manageAny":

      case "events.view":
      case "events.manage":

      case "rosters.view":
      case "rosters.edit":

      case "allocation.view":
      case "allocation.run":

      case "users.view":
      case "users.manage":

        return true;

      case "guild.manage":
        return false;

      default:
        return false;
    }
  }

  // -----------------------------------------------------------
  // OFFICER
  // -----------------------------------------------------------

  if (
    role === "OFFICER"
  ) {
    switch (
      permission
    ) {
      case "members.view":
      case "members.edit":
      case "members.delete":
      case "members.import":

      case "profile.editOwn":

      case "leave.manageOwn":
      case "leave.manageAny":

      case "events.view":
      case "events.manage":

      case "rosters.view":
      case "rosters.edit":

      case "allocation.view":
      case "allocation.run":

      // Officer can see users, but cannot manage
      // application access.
      case "users.view":

        return true;

      case "users.manage":
      case "guild.manage":

        return false;

      default:
        return false;
    }
  }

  // -----------------------------------------------------------
  // MEMBER
  // -----------------------------------------------------------

  if (
    role === "MEMBER"
  ) {
    switch (
      permission
    ) {
      case "members.view":

      case "profile.editOwn":

      case "leave.manageOwn":

      case "events.view":

      case "rosters.view":

      case "allocation.view":

      // users.view is granted to MEMBER, but the
      // users API MUST restrict the result to the
      // authenticated user's own membership.
      case "users.view":

        return true;

      case "members.edit":
      case "members.delete":
      case "members.import":

      case "leave.manageAny":

      case "events.manage":

      case "rosters.edit":

      case "allocation.run":

      case "users.manage":

      case "guild.manage":

        return false;

      default:
        return false;
    }
  }

  return false;
}

// =============================================================
// ROLE MANAGEMENT
// =============================================================
//
// Hierarchy:
//
//   ADMIN
//      ↓
//   MANAGER
//      ↓
//   OFFICER
//      ↓
//   MEMBER
//
// ADMIN may manage MANAGER / OFFICER / MEMBER.
//
// MANAGER may manage OFFICER / MEMBER.
//
// OFFICER cannot manage application roles.
//
// MEMBER cannot manage application roles.
//
// =============================================================

export function canManageRole(
  actorRole: UserRole,
  targetCurrentRole: UserRole,
  targetNewRole: UserRole
): boolean {
  // -----------------------------------------------------------
  // OFFICER / MEMBER
  // -----------------------------------------------------------

  if (
    actorRole === "OFFICER" ||
    actorRole === "MEMBER"
  ) {
    return false;
  }

  // -----------------------------------------------------------
  // ADMIN
  // -----------------------------------------------------------

  if (
    actorRole === "ADMIN"
  ) {
    // Another ADMIN cannot be modified through
    // the normal role-management flow.

    if (
      targetCurrentRole ===
      "ADMIN"
    ) {
      return false;
    }

    // ADMIN cannot be assigned through the normal
    // role-management flow.

    if (
      targetNewRole ===
      "ADMIN"
    ) {
      return false;
    }

    return true;
  }

  // -----------------------------------------------------------
  // MANAGER
  // -----------------------------------------------------------

  if (
    actorRole === "MANAGER"
  ) {
    // Managers cannot modify Admins.

    if (
      targetCurrentRole ===
      "ADMIN"
    ) {
      return false;
    }

    // Managers cannot modify another Manager.

    if (
      targetCurrentRole ===
      "MANAGER"
    ) {
      return false;
    }

    // Managers cannot create/promote someone to Manager.

    if (
      targetNewRole ===
      "MANAGER"
    ) {
      return false;
    }

    return (
      targetCurrentRole ===
        "OFFICER" ||
      targetCurrentRole ===
        "MEMBER"
    );
  }

  return false;
}

// =============================================================
// ROLE HIERARCHY
// =============================================================

export const ROLE_LEVEL: Record<
  UserRole,
  number
> = {
  ADMIN: 4,
  MANAGER: 3,
  OFFICER: 2,
  MEMBER: 1,
};

// =============================================================
// CAN MANAGE TARGET
// =============================================================
//
// Used for operations such as removing a user's guild access,
// where there is no target "new role".
//
// This intentionally mirrors canManageRole().
//
// =============================================================

export function canManageTarget(
  actorRole: UserRole,
  targetRole: UserRole
): boolean {
  if (
    actorRole === "ADMIN"
  ) {
    return targetRole !==
      "ADMIN";
  }

  if (
    actorRole === "MANAGER"
  ) {
    return (
      targetRole ===
        "OFFICER" ||
      targetRole ===
        "MEMBER"
    );
  }

  return false;
}