import { prisma } from "@/lib/prisma";

export type GuildEntitlementState = { enabled: boolean; expiresAt: Date | null; warning: boolean; daysRemaining: number | null; planName: string | null; cancelAtPeriodEnd: boolean };

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
  // A canceled historical Stripe row may have a later period end than a newer
  // complimentary grant. Prefer a currently entitled subscription over history.
  const subscription = activeSubscription ?? latestSubscription;
  const expiresAt = subscription?.currentPeriodEnd ?? null;
  const enabled = activeSubscription !== null;
  if (!subscription || !expiresAt) {
    return {
      enabled,
      expiresAt,
      warning: false,
      daysRemaining: null,
      planName: subscription?.plan.name ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    };
  }

  const msRemaining = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / 86400000);
  return {
    enabled: enabled && msRemaining > 0,
    expiresAt,
    warning: enabled && msRemaining > 0 && msRemaining <= 7 * 86400000,
    daysRemaining,
    planName: subscription.plan.name,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  };
}

export async function getGuildResourceEntitlement(guildId: string): Promise<GuildEntitlementState> {
  const state = await getGuildSubscriptionEntitlement(guildId);
  if (!state.enabled) return { ...state, enabled: false };
  const entitlement = await prisma.guildModuleEntitlement.findUnique({ where: { guildId_module: { guildId, module: "RESOURCE_SUITE" } }, select: { enabled: true } });
  return { ...state, enabled: state.enabled && entitlement?.enabled === true };
}
