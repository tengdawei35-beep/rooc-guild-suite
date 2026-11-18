import { SaaSModule, SubscriptionStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const ACTIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "ACTIVE",
  "TRIALING",
];

export async function getGuildSubscription(guildId: string) {
  return prisma.guildSubscription.findFirst({
    where: {
      guildId,
      status: { in: ACTIVE_SUBSCRIPTION_STATUSES },
    },
    include: {
      plan: { include: { modules: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function syncGuildEntitlements(
  guildId: string,
  planId: string,
) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: { modules: true },
  });

  if (!plan) throw new Error("Plan not found.");

  const enabledModules = new Set(
    plan.modules.map((item) => item.module),
  );

  return prisma.$transaction(async (tx) => {
    const modules = Object.values(SaaSModule);

    for (const module of modules) {
      await tx.guildModuleEntitlement.upsert({
        where: {
          guildId_module: { guildId, module },
        },
        create: {
          guildId,
          module,
          enabled: enabledModules.has(module),
        },
        update: {
          enabled: enabledModules.has(module),
        },
      });
    }

    return tx.guildModuleEntitlement.findMany({
      where: { guildId },
      orderBy: { module: "asc" },
    });
  });
}

export async function activateGuildSubscription(
  subscriptionId: string,
) {
  return prisma.$transaction(async (tx) => {
    const subscription = await tx.guildSubscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: { include: { modules: true } } },
    });

    if (!subscription) throw new Error("Subscription not found.");

    const updated = await tx.guildSubscription.update({
      where: { id: subscription.id },
      data: { status: "ACTIVE" },
    });

    const enabledModules = new Set(
      subscription.plan.modules.map((item) => item.module),
    );

    for (const module of Object.values(SaaSModule)) {
      await tx.guildModuleEntitlement.upsert({
        where: {
          guildId_module: {
            guildId: subscription.guildId,
            module,
          },
        },
        create: {
          guildId: subscription.guildId,
          module,
          enabled: enabledModules.has(module),
        },
        update: {
          enabled: enabledModules.has(module),
        },
      });
    }

    return updated;
  });
}

export async function hasActiveGuildModule(
  guildId: string,
  module: SaaSModule,
) {
  const entitlement = await prisma.guildModuleEntitlement.findUnique({
    where: {
      guildId_module: { guildId, module },
    },
  });

  return entitlement?.enabled === true;
}
