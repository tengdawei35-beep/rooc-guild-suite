import { NextResponse } from "next/server";

import { getCurrentPlatformUser } from "@/lib/auth/platform";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const user = await getCurrentPlatformUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const body = await request.json() as { planId?: string; guildName?: string; discordGuildId?: string };
    const planId = body.planId?.trim();
    const guildName = body.guildName?.trim();
    const discordGuildId = body.discordGuildId?.trim();

    if (!planId || !guildName || !discordGuildId) {
      return NextResponse.json({ error: "PLAN_AND_GUILD_DETAILS_REQUIRED" }, { status: 400 });
    }
    if (guildName.length < 2 || guildName.length > 100) {
      return NextResponse.json({ error: "INVALID_GUILD_NAME" }, { status: 400 });
    }
    if (!/^\d{17,20}$/.test(discordGuildId)) {
      return NextResponse.json({ error: "INVALID_DISCORD_GUILD_ID" }, { status: 400 });
    }

    const creator = await prisma.platformGuildCreator.findUnique({
      where: { discordUserId: user.discordId },
      select: { active: true, maxGuilds: true, freeMonths: true },
    });
    if (!creator?.active) return NextResponse.json({ error: "COMPLIMENTARY_ACCESS_NOT_AVAILABLE" }, { status: 403 });

    const [ownedGuildCount, existingGuild, plan] = await Promise.all([
      prisma.guild.count({ where: { ownerUserId: user.id } }),
      prisma.guild.findUnique({ where: { discordGuildId } }),
      prisma.plan.findFirst({ where: { id: planId, active: true }, include: { modules: true } }),
    ]);

    if (ownedGuildCount >= creator.maxGuilds) {
      return NextResponse.json({ error: "GUILD_CREATION_LIMIT_REACHED" }, { status: 403 });
    }
    if (existingGuild) return NextResponse.json({ error: "DISCORD_GUILD_ALREADY_REGISTERED" }, { status: 409 });
    if (!plan) return NextResponse.json({ error: "INVALID_PLAN" }, { status: 400 });

    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date(currentPeriodStart);
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + creator.freeMonths);

    const guild = await prisma.$transaction(async (tx) => {
      const createdGuild = await tx.guild.create({
        data: { name: guildName, discordGuildId, ownerUserId: user.id },
      });

      await tx.guildMembership.create({
        data: { guildId: createdGuild.id, userId: user.id, role: "ADMIN" },
      });

      await tx.guildSubscription.create({
        data: {
          guildId: createdGuild.id,
          planId: plan.id,
          status: "ACTIVE",
          provider: "complimentary",
          currentPeriodStart,
          currentPeriodEnd,
        },
      });

      await tx.guildModuleEntitlement.createMany({
        data: plan.modules.map((module) => ({
          guildId: createdGuild.id,
          module: module.module,
          enabled: true,
        })),
      });

      return createdGuild;
    });

    return NextResponse.json({ success: true, guildId: guild.id });
  } catch (error) {
    console.error("[BILLING COMPLIMENTARY]", error);
    return NextResponse.json({ error: "COMPLIMENTARY_PROVISIONING_FAILED" }, { status: 500 });
  }
}
