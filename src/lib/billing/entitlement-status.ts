import { prisma } from "@/lib/prisma";
import { resolveGuildSubscriptionEntitlement, type GuildEntitlementState } from "./entitlement-status-core";

export type { GuildEntitlementState } from "./entitlement-status-core";

export async function getGuildSubscriptionEntitlement(guildId: string): Promise<GuildEntitlementState> {
  const now = new Date();
  const [activeSubscription, latestSubscription] = await Promise.all([
    prisma.guildSubscription.findFirst({
      where: {
        guildId,
        status: { in: ["ACTIVE", "TRIALING"] },
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    }),
    prisma.guildSubscription.findFirst({
      where: { guildId },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    }),
  ]);

  return resolveGuildSubscriptionEntitlement(activeSubscription, latestSubscription, now);
}

export async function getGuildResourceEntitlement(guildId: string): Promise<GuildEntitlementState> {
  const state = await getGuildSubscriptionEntitlement(guildId);
  if (!state.enabled) return { ...state, enabled: false };
  const entitlement = await prisma.guildModuleEntitlement.findUnique({
    where: { guildId_module: { guildId, module: "RESOURCE_SUITE" } },
    select: { enabled: true },
  });
  return { ...state, enabled: state.enabled && entitlement?.enabled === true };
}
