import type { Permission, UserRole } from "@/lib/permissions";

export { hasPermission } from "@/lib/permissions";
export type { Permission, UserRole } from "@/lib/permissions";

export async function requirePermission(
  auth: { role: UserRole },
  permission: Permission
) {
  const { hasPermission } = await import("@/lib/permissions");

  if (!hasPermission(auth.role, permission)) {
    throw new Error("FORBIDDEN");
  }

  return auth;
}
