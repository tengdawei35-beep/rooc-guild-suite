import { NextResponse } from "next/server";

import { getCurrentPlatformUser } from "@/lib/auth/platform";
import { prisma } from "@/lib/prisma";
import { isGameType } from "@/lib/games";

export async function POST(request: Request) {
  try {
    const user = await getCurrentPlatformUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const body = await request.json() as { planId?: string; guildName?: string; discordGuildId?: string; gameType?: unknown };
    const planId = body.planId?.trim();
    const guildName = body.guildName?.trim();
    const discordGuildId = body.discordGuildId?.trim();
    const gameType = body.gameType;

    if (!planId || !guildName || !discordGuildId || !isGameType(gameType)) {
      return NextResponse.json({ error: "PLAN_AND_GUILD_DETAILS_REQUIRED" }, { status: 400 });
    }
    if (guildName.length < 2 || guildName.length > 100) {
      return NextResponse.json({ error: "INVALID_GUILD_NAME" }, { status: 400 });
    }
    if (!/^\d{17,20}$/.test(discordGuildId)) {
      return NextResponse.json({ error: "INVALID_DISCORD_GUILD_ID" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Serialize complimentary guild creation per owner. The transaction-scoped
      // advisory lock prevents concurrent requests from both passing maxGuilds.
      // Select a supported scalar instead of the lock function's PostgreSQL void
      // return type, which Prisma's query adapter cannot deserialize.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(87241, hashtext(${user.id}))`;

      const creator = await tx.platformGuildCreator.findUnique({
        where: { discordUserId: user.discordId },
        select: { active: true, maxGuilds: true, freeMonths: true },
      });
      if (!creator?.active) {
        return { error: "COMPLIMENTARY_ACCESS_NOT_AVAILABLE", status: 403 } as const;
      }

      const [ownedGuildCount, existingGuild, plan] = await Promise.all([
        tx.guild.count({ where: { ownerUserId: user.id } }),
        tx.guild.findUnique({ where: { discordGuildId } }),
        tx.plan.findFirst({ where: { id: planId, active: true }, include: { modules: true } }),
      ]);

      if (ownedGuildCount >= creator.maxGuilds) {
        return { error: "GUILD_CREATION_LIMIT_REACHED", status: 403 } as const;
      }
      if (existingGuild) {
        return { error: "DISCORD_GUILD_ALREADY_REGISTERED", status: 409 } as const;
      }
      if (!plan) {
        return { error: "INVALID_PLAN", status: 400 } as const;
      }

      const currentPeriodStart = new Date();
      const currentPeriodEnd = new Date(currentPeriodStart);
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + creator.freeMonths);

      const guild = await tx.guild.create({
        data: { name: guildName, discordGuildId, ownerUserId: user.id, gameType },
      });

      await tx.guildMembership.create({
        data: { guildId: guild.id, userId: user.id, role: "ADMIN" },
      });

      await tx.guildSubscription.create({
        data: {
          guildId: guild.id,
          planId: plan.id,
          status: "ACTIVE",
          provider: "complimentary",
          currentPeriodStart,
          currentPeriodEnd,
        },
      });

      await tx.guildModuleEntitlement.createMany({
        data: plan.modules.map((module) => ({
          guildId: guild.id,
          module: module.module,
          enabled: true,
        })),
      });

      return { guildId: guild.id } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, guildId: result.guildId });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "DISCORD_GUILD_ALREADY_REGISTERED" }, { status: 409 });
    }
    console.error("[BILLING COMPLIMENTARY]", error);
    return NextResponse.json({ error: "COMPLIMENTARY_PROVISIONING_FAILED" }, { status: 500 });
  }
}
