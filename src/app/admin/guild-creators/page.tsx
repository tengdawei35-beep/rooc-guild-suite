import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getPlatformAdmin } from "@/lib/platform-admin";
import GuildCreatorsClient from "./GuildCreatorsClient";

async function ensureAdminPlans() {
  const definitions = [
    { name: "Basic", description: "Basic Guild Suite subscription", modules: ["CORE"] as const },
    { name: "Total", description: "Total Guild Suite subscription", modules: ["CORE", "RESOURCE_SUITE"] as const },
  ];

  for (const definition of definitions) {
    const plan = await prisma.plan.upsert({
      where: { name: definition.name },
      create: {
        name: definition.name,
        description: definition.description,
        priceCents: 0,
        currency: "usd",
        billingInterval: "MONTH",
        active: true,
      },
      update: { active: true, description: definition.description },
    });

    await prisma.planModule.createMany({
      data: definition.modules.map((module) => ({ planId: plan.id, module })),
      skipDuplicates: true,
    });
  }

  return prisma.plan.findMany({
    where: { active: true },
    orderBy: [{ priceCents: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}

export default async function GuildCreatorsAdminPage() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/login");

  const [creators, plans, guilds] = await Promise.all([
    prisma.platformGuildCreator.findMany({ orderBy: { discordUsername: "asc" } }),
    ensureAdminPlans(),
    prisma.guild.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        discordGuildId: true,
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            status: true,
            provider: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            plan: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const creatorIds = creators.map((creator) => creator.discordUserId);
  const users = creatorIds.length
    ? await prisma.user.findMany({ where: { discordId: { in: creatorIds } }, select: { id: true, discordId: true } })
    : [];
  const userIdByDiscordId = new Map(users.map((user) => [user.discordId, user.id]));
  const guildCounts = await Promise.all(creators.map(async (creator) => {
    const userId = userIdByDiscordId.get(creator.discordUserId);
    return userId ? prisma.guild.count({ where: { ownerUserId: userId } }) : 0;
  }));
  const creatorsWithCounts = creators.map((creator, index) => ({ ...creator, guildCount: guildCounts[index] ?? 0 }));
  const guildAccess = guilds.map((guild) => {
    const subscription = guild.subscriptions[0] ?? null;
    return {
      id: guild.id,
      name: guild.name,
      discordGuildId: guild.discordGuildId,
      planName: subscription?.plan.name ?? null,
      status: subscription?.status ?? null,
      provider: subscription?.provider ?? null,
      expiresAt: subscription?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    };
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link href="/" className="text-sm text-zinc-500 hover:text-white">← Dashboard</Link>
        <div className="mt-8">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Platform Administration</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Guild Creators</h1>
          <p className="mt-2 text-sm text-zinc-400">Control which Discord accounts can create guilds, how many guilds each account may own, and complimentary access for existing guilds.</p>
        </div>
        <div className="mt-8">
          <GuildCreatorsClient
            initialCreators={creatorsWithCounts}
            plans={plans}
            initialGuilds={guildAccess}
          />
        </div>
      </div>
    </main>
  );
}
