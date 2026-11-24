import { prisma } from "@/lib/prisma";

const ACTIVE_STATUSES = ["ACTIVE", "TRIALING"] as const;

/**
 * The simulator is independently purchasable by a user or as a guild add-on.
 * Guild access is inherited by every authenticated guild member; personal
 * access follows the user's own subscription regardless of current guild.
 */
export async function hasCombatSimulatorAccess(userId: string, guildId?: string | null): Promise<boolean> {
  const now = new Date();
  const [personal, guild, guildPlan] = await Promise.all([
    prisma.userCombatSimulatorSubscription.findFirst({
      where: {
        userId,
        status: { in: [...ACTIVE_STATUSES] },
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
      },
      select: { id: true },
    }),
    guildId
      ? prisma.guildCombatSimulatorSubscription.findFirst({
          where: {
            guildId,
            status: { in: [...ACTIVE_STATUSES] },
            OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
          },
          select: { id: true },
        })
      : Promise.resolve(null),
    guildId
      ? prisma.guildSubscription.findFirst({
          where: {
            guildId,
            status: { in: [...ACTIVE_STATUSES] },
            OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  return Boolean(personal || (guild && guildPlan));
}

export async function requireCombatSimulatorAccess(userId: string, guildId?: string | null) {
  if (!(await hasCombatSimulatorAccess(userId, guildId))) {
    throw new Error("COMBAT_SIMULATOR_NOT_SUBSCRIBED");
  }
  return true;
}
