import { NextResponse } from "next/server";

import { getCurrentPlatformUser } from "@/lib/auth/platform";
import { prisma } from "@/lib/prisma";
import { isGameType } from "@/lib/games";

const MAX_PREVIEW_TEST_GUILDS_PER_USER = 5;

export async function POST(request: Request) {
  try {
    // This endpoint must never be usable on Production or local deployments.
    if (process.env.VERCEL_ENV !== "preview") {
      return NextResponse.json({ error: "PREVIEW_TESTING_ONLY" }, { status: 404 });
    }

    const user = await getCurrentPlatformUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const allowedDiscordIds = (process.env.PREVIEW_GUILD_TESTER_DISCORD_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (!allowedDiscordIds.includes(user.discordId)) {
      return NextResponse.json({ error: "PREVIEW_TEST_ACCESS_DENIED" }, { status: 403 });
    }

    const body = await request.json() as {
      planId?: string;
      guildName?: string;
      discordGuildId?: string;
      gameType?: unknown;
    };

    const planId = body.planId?.trim();
    const guildName = body.guildName?.trim();
    const discordGuildId = body.discordGuildId?.trim();
    const gameType = body.gameType;

    if (!planId || !guildName || !discordGuildId || !isGameType(gameType)) {
      return NextResponse.json({ error: "PLAN_GUILD_DETAILS_AND_GAME_REQUIRED" }, { status: 400 });
    }
    if (guildName.length < 2 || guildName.length > 100) {
      return NextResponse.json({ error: "INVALID_GUILD_NAME" }, { status: 400 });
    }
    if (!/^\d{17,20}$/.test(discordGuildId)) {
      return NextResponse.json({ error: "INVALID_DISCORD_GUILD_ID" }, { status: 400 });
    }

    const [plan, existingGuild, testGuildCount] = await Promise.all([
      prisma.plan.findFirst({ where: { id: planId, active: true }, include: { modules: true } }),
      prisma.guild.findUnique({ where: { discordGuildId } }),
      prisma.guild.count({
        where: {
          ownerUserId: user.id,
          subscriptions: { some: { provider: "preview-test" } },
        },
      }),
    ]);

    if (!plan) return NextResponse.json({ error: "INVALID_PLAN" }, { status: 400 });
    if (existingGuild) return NextResponse.json({ error: "DISCORD_GUILD_ALREADY_REGISTERED" }, { status: 409 });
    if (testGuildCount >= MAX_PREVIEW_TEST_GUILDS_PER_USER) {
      return NextResponse.json({ error: "PREVIEW_TEST_GUILD_LIMIT_REACHED" }, { status: 403 });
    }

    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date(currentPeriodStart);
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);

    const guild = await prisma.$transaction(async (tx) => {
      const createdGuild = await tx.guild.create({
        data: { name: guildName, discordGuildId, ownerUserId: user.id, gameType },
      });

      await tx.guildMembership.create({
        data: { guildId: createdGuild.id, userId: user.id, role: "ADMIN" },
      });

      await tx.guildSubscription.create({
        data: {
          guildId: createdGuild.id,
          planId: plan.id,
          status: "ACTIVE",
          provider: "preview-test",
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

    return NextResponse.json({ success: true, guildId: guild.id, gameType: guild.gameType });
  } catch (error) {
    console.error("[PREVIEW GUILD TEST CREATE]", error);
    return NextResponse.json({ error: "PREVIEW_TEST_GUILD_CREATION_FAILED" }, { status: 500 });
  }
}
