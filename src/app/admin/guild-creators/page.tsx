import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getPlatformAdmin } from "@/lib/platform-admin";
import ManagementPageHeader from "@/app/ManagementPageHeader";
import GuildCreatorsClient from "./GuildCreatorsClient";

async function getActiveAdminPlans() {
  // Plan creation and Stripe price synchronization belong to the controlled seed process,
  // not to a read-only admin page request.
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
    getActiveAdminPlans(),
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
    <main className="hmdl-platform-admin-workspace min-h-screen bg-zinc-950 text-white">
      <div className="hmdl-page">
        <ManagementPageHeader eyebrow="PLATFORM · CREATOR ACCESS" title="Guild Creators" description="Control which Discord accounts can create guilds, how many guilds each account may own, and complimentary access for existing guilds." />
        <div className="mt-6">
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
