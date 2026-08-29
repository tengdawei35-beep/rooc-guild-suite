import { prisma } from "@/lib/prisma";
import type { SaaSModule } from "@/generated/prisma/client";

export const RESOURCE_SUITE_MODULE: SaaSModule = "RESOURCE_SUITE";

/**
 * Returns true when the guild has explicitly enabled a SaaS module.
 * Core is always available and does not require a subscription entitlement.
 */
export async function hasGuildModule(
  guildId: string,
  module: SaaSModule
): Promise<boolean> {
  if (module === "CORE") {
    return true;
  }

  const entitlement =
    await prisma.guildModuleEntitlement.findUnique({
      where: {
        guildId_module: {
          guildId,
          module,
        },
      },
      select: {
        enabled: true,
      },
    });

  return entitlement?.enabled === true;
}

/**
 * Throws FORBIDDEN when the guild is not entitled to the requested module.
 */
export async function requireGuildModule(
  guildId: string,
  module: SaaSModule
) {
  const enabled = await hasGuildModule(guildId, module);

  if (!enabled) {
    throw new Error("MODULE_NOT_SUBSCRIBED");
  }

  return true;
}
