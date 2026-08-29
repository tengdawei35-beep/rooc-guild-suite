import { prisma } from "@/lib/prisma";

export type GuildEntitlementState = {
  enabled: boolean;
  expiresAt: Date | null;
  warning: boolean;
  daysRemaining: number | null;
};

export async function getGuildResourceEntitlement(guildId: string): Promise<GuildEntitlementState> {
  const entitlement = await prisma.guildModuleEntitlement.findUnique({
    where: { guildId_module: { guildId, module: "RESOURCE_SUITE" } },
    select: { enabled: true },
  });

  const subscription = await prisma.guildSubscription.findFirst({
    where: {
      guildId,
      status: { in: ["ACTIVE", "TRIALING"] },
      OR: [{ provider: "complimentary" }, { provider: "stripe" }],
    },
    orderBy: { currentPeriodEnd: "desc" },
    select: { currentPeriodEnd: true, cancelAtPeriodEnd: true },
  });

  const expiresAt = subscription?.currentPeriodEnd ?? null;
  if (!entitlement?.enabled) return { enabled: false, expiresAt, warning: false, daysRemaining: null };
  if (!expiresAt) return { enabled: true, expiresAt: null, warning: false, daysRemaining: null };

  const msRemaining = expiresAt.getTime() - Date.now();
  const daysRemaining = Math.ceil(msRemaining / 86400000);
  return {
    enabled: msRemaining > 0,
    expiresAt,
    warning: msRemaining > 0 && msRemaining <= 7 * 86400000,
    daysRemaining,
  };
}
