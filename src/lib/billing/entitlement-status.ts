import { prisma } from "@/lib/prisma";

export type GuildEntitlementState = { enabled: boolean; expiresAt: Date | null; warning: boolean; daysRemaining: number | null; planName: string | null; cancelAtPeriodEnd: boolean };

export async function getGuildSubscriptionEntitlement(guildId: string): Promise<GuildEntitlementState> {
  const subscription = await prisma.guildSubscription.findFirst({
    where: { guildId }, orderBy: { currentPeriodEnd: "desc" }, include: { plan: true },
  });
  const expiresAt = subscription?.currentPeriodEnd ?? null;
  const active = subscription?.status === "ACTIVE" || subscription?.status === "TRIALING";
  const periodActive = !expiresAt || expiresAt > new Date();
  const enabled = active && periodActive;
  if (!subscription || !expiresAt) return { enabled, expiresAt, warning: false, daysRemaining: null, planName: subscription?.plan.name ?? null, cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false };
  const msRemaining = expiresAt.getTime() - Date.now();
  const daysRemaining = Math.ceil(msRemaining / 86400000);
  return { enabled: enabled && msRemaining > 0, expiresAt, warning: msRemaining > 0 && msRemaining <= 7 * 86400000, daysRemaining, planName: subscription.plan.name, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd };
}

export async function getGuildResourceEntitlement(guildId: string): Promise<GuildEntitlementState> {
  const state = await getGuildSubscriptionEntitlement(guildId);
  if (!state.enabled) return { ...state, enabled: false };
  const entitlement = await prisma.guildModuleEntitlement.findUnique({ where: { guildId_module: { guildId, module: "RESOURCE_SUITE" } }, select: { enabled: true } });
  return { ...state, enabled: state.enabled && entitlement?.enabled === true };
}
