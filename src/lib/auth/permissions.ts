import type { Role } from "./roles";

export const PERMISSIONS = {
  "guild.manage": ["ADMIN"],
  "events.manage": ["ADMIN", "MANAGER", "OFFICER"],
  "rosters.edit": ["ADMIN", "MANAGER", "OFFICER"],
  "allocation.view": ["ADMIN", "MANAGER", "OFFICER"],
  "allocation.run": ["ADMIN", "MANAGER", "OFFICER"],
  "users.view": ["ADMIN", "MANAGER", "OFFICER"],
  "users.manage": ["ADMIN", "MANAGER"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(
  role: Role,
  permission: Permission
): boolean {
  return PERMISSIONS[permission].includes(role);
}
