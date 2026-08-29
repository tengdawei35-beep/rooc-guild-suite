import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function getConfiguredAdminDiscordIds() {
  return new Set(
    (process.env.ADMIN_DISCORD_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export async function getPlatformAdmin() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user || !getConfiguredAdminDiscordIds().has(user.discordId)) {
    return null;
  }

  return user;
}

export async function requirePlatformAdmin() {
  const user = await getPlatformAdmin();

  if (!user) {
    throw new Error("PLATFORM_ADMIN_REQUIRED");
  }

  return user;
}
