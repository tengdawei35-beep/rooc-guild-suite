import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getPlatformAdmin } from "@/lib/platform-admin";
import GuildCreatorsClient from "./GuildCreatorsClient";

export default async function GuildCreatorsAdminPage() {
  const admin = await getPlatformAdmin();

  if (!admin) {
    redirect("/login");
  }

  const creators = await prisma.platformGuildCreator.findMany({
    orderBy: { discordUsername: "asc" },
  });

  const creatorIds = creators.map((creator) => creator.discordUserId);
  const users = creatorIds.length
    ? await prisma.user.findMany({
        where: { discordId: { in: creatorIds } },
        select: { id: true, discordId: true },
      })
    : [];
  const userIdByDiscordId = new Map(users.map((user) => [user.discordId, user.id]));

  const guildCounts = await Promise.all(
    creators.map(async (creator) => {
      const userId = userIdByDiscordId.get(creator.discordUserId);
      return userId
        ? prisma.guild.count({ where: { ownerUserId: userId } })
        : 0;
    })
  );

  const creatorsWithCounts = creators.map((creator, index) => ({
    ...creator,
    guildCount: guildCounts[index] ?? 0,
  }));

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/" className="text-sm text-zinc-500 hover:text-white">
          ← Dashboard
        </Link>

        <div className="mt-8">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
            Platform Administration
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Guild Creators
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Control which Discord accounts can create guilds and how many guilds each account may own.
          </p>
        </div>

        <div className="mt-8">
          <GuildCreatorsClient initialCreators={creatorsWithCounts} />
        </div>
      </div>
    </main>
  );
}
