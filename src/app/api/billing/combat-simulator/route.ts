import { NextResponse } from "next/server";
import { getCurrentPlatformUser } from "@/lib/auth/platform";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentPlatformUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const [personal, guilds] = await Promise.all([
    prisma.userCombatSimulatorSubscription.findFirst({
      where: { userId: user.id }, orderBy: { createdAt: "desc" },
      select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, providerCustomerId: true },
    }),
    prisma.guild.findMany({
      where: { ownerUserId: user.id },
      select: { id: true, name: true, combatSimulatorSubscriptions: {
        orderBy: { createdAt: "desc" }, take: 1,
        select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, providerCustomerId: true },
      } },
    }),
  ]);
  return NextResponse.json({
    personal: personal ? { ...personal, currentPeriodEnd: personal.currentPeriodEnd?.toISOString() ?? null } : null,
    guilds: guilds.map((guild) => ({ id: guild.id, name: guild.name, subscription: guild.combatSimulatorSubscriptions[0] ? { ...guild.combatSimulatorSubscriptions[0], currentPeriodEnd: guild.combatSimulatorSubscriptions[0].currentPeriodEnd?.toISOString() ?? null } : null })),
  });
}
