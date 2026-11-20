import { prisma } from "@/lib/prisma";
import type { SaaSModule } from "@/generated/prisma/client";

export const RESOURCE_SUITE_MODULE: SaaSModule = "RESOURCE_SUITE";

/**
 * Returns true when the guild has an enabled SaaS module backed by a
 * currently entitled subscription. Core is always available.
 */
export async function hasGuildModule(
  guildId: string,
  module: SaaSModule
): Promise<boolean> {
  if (module === "CORE") return true;

  const entitlement = await prisma.guildModuleEntitlement.findUnique({
    where: { guildId_module: { guildId, module } },
    select: { enabled: true },
  });

  if (!entitlement?.enabled) return false;

  const subscription = await prisma.guildSubscription.findFirst({
    where: {
      guildId,
      status: { in: ["ACTIVE", "TRIALING"] },
      OR: [
        { currentPeriodEnd: null },
        { currentPeriodEnd: { gt: new Date() } },
      ],
    },
    orderBy: { currentPeriodEnd: "desc" },
    select: { id: true },
  });

  return subscription !== null;
}

export async function requireGuildModule(guildId: string, module: SaaSModule) {
  if (!(await hasGuildModule(guildId, module))) {
    throw new Error("MODULE_NOT_SUBSCRIBED");
  }

  return true;
}

/**
 * Legacy FEATHER/CARD resources and allocation are ROOC-specific.
 * Read the guild's authoritative game type rather than trusting request data.
 */
export async function isRoocGuild(guildId: string): Promise<boolean> {
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    select: { gameType: true },
  });

  return guild?.gameType === "ROOC";
}
