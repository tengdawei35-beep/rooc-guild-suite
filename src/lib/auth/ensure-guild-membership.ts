import { prisma } from "@/lib/prisma";

/**
 * Links an authenticated Discord user to pre-imported GuildMember
 * records and grants MEMBER access to each active linked guild.
 *
 * Discord user ID is authoritative. Username is only a safe fallback
 * when there is exactly one unlinked GuildMember with that username.
 */
export async function ensureGuildMembershipsForDiscordUser({
  userId,
  discordId,
  username,
}: {
  userId: string;
  discordId: string;
  username: string;
}) {
  const linkedMembers =
    await prisma.guildMember.findMany({
      where: {
        OR: [
          { userId },
          { discordUserId: discordId },
        ],
        active: true,
      },
      select: {
        id: true,
        guildId: true,
        userId: true,
        discordUsername: true,
      },
    });

  const linkedMemberIds = new Set(
    linkedMembers.map(
      (member) => member.id
    )
  );

  // Username is deliberately a fallback only. If multiple unlinked
  // records have the same username, do not guess which member is the
  // authenticated Discord account.
  if (linkedMembers.length === 0) {
    const usernameCandidates =
      await prisma.guildMember.findMany({
        where: {
          userId: null,
          discordUserId: null,
          discordUsername: {
            equals: username,
            mode: "insensitive",
          },
          active: true,
        },
        select: {
          id: true,
          guildId: true,
          userId: true,
          discordUsername: true,
        },
      });

    if (
      usernameCandidates.length === 1
    ) {
      const candidate =
        usernameCandidates[0];

      await prisma.guildMember.update({
        where: {
          id: candidate.id,
        },
        data: {
          userId,
          discordUserId: discordId,
          discordUsername: username,
        },
      });

      linkedMembers.push({
        ...candidate,
        userId,
      });

      linkedMemberIds.add(
        candidate.id
      );
    }
  }

  if (linkedMembers.length === 0) {
    return [];
  }

  // Keep the stored Discord username current without using it as the
  // authoritative identity key.
  await prisma.guildMember.updateMany({
    where: {
      id: {
        in: Array.from(
          linkedMemberIds
        ),
      },
    },
    data: {
      discordUserId: discordId,
      discordUsername: username,
      userId,
    },
  });

  const guildIds = Array.from(
    new Set(
      linkedMembers.map(
        (member) => member.guildId
      )
    )
  );

  for (const guildId of guildIds) {
    await prisma.guildMembership.upsert({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      update: {},
      create: {
        userId,
        guildId,
        role: "MEMBER",
      },
    });
  }

  return guildIds;
}
