import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getActiveImpersonation } from "@/lib/impersonation";

function getConfiguredAdminDiscordIds() {
  const configured =
    process.env.PLATFORM_ADMIN_DISCORD_ID ??
    process.env.ADMIN_DISCORD_USER_IDS ??
    "";

  return new Set(
    configured
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export async function getOriginalPlatformAdmin() {
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

export async function getPlatformAdmin() {
  if (await getActiveImpersonation()) return null;
  return getOriginalPlatformAdmin();
}

export async function requirePlatformAdmin() {
  const user = await getPlatformAdmin();

  if (!user) {
    throw new Error("PLATFORM_ADMIN_REQUIRED");
  }

  return user;
}
