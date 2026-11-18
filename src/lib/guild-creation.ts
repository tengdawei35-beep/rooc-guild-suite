import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import {
  GUILD_SELECTION_COOKIE,
  verifyGuildSelectionToken,
} from "@/lib/guild-selection";

export type GuildCreationEligibility = {
  userId: string;
  discordId: string;
  username: string;
  authorized: boolean;
  active: boolean;
  maxGuilds: number;
  currentGuilds: number;
  remainingGuilds: number;
};

export async function getGuildCreationEligibility(): Promise<GuildCreationEligibility | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(GUILD_SELECTION_COOKIE)?.value;
  const selection = token ? verifyGuildSelectionToken(token) : null;

  if (!selection) return null;

  const user = await prisma.user.findUnique({
    where: { id: selection.userId },
    select: {
      id: true,
      discordId: true,
      username: true,
      ownedGuilds: { select: { id: true } },
    },
  });

  if (!user) return null;

  const creator = await prisma.platformGuildCreator.findUnique({
    where: { discordUserId: user.discordId },
    select: { active: true, maxGuilds: true },
  });

  const maxGuilds = creator?.maxGuilds ?? 0;
  const currentGuilds = user.ownedGuilds.length;
  const active = creator?.active === true;
  const remainingGuilds = Math.max(0, maxGuilds - currentGuilds);

  return {
    userId: user.id,
    discordId: user.discordId,
    username: user.username,
    authorized: active && remainingGuilds > 0,
    active,
    maxGuilds,
    currentGuilds,
    remainingGuilds,
  };
}
