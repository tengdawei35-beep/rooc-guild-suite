import { prisma } from "@/lib/prisma";

const DISCORD_API = "https://discord.com/api/v10";
type DiscordRoleMapping = { discordRoleId: string; enabled: boolean };

async function setMemberRole(discordId: string, roleId: string, shouldHaveRole: boolean) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const officialGuildId = process.env.DISCORD_OFFICIAL_GUILD_ID;
  if (!token || !officialGuildId) throw new Error("Discord subscription role sync is not configured.");

  const response = await fetch(
    `${DISCORD_API}/guilds/${officialGuildId}/members/${discordId}/roles/${roleId}`,
    {
      method: shouldHaveRole ? "PUT" : "DELETE",
      headers: { Authorization: `Bot ${token}` },
      cache: "no-store",
    },
  );

  // A user who has not joined the official community server cannot receive a role.
  if (response.status === 404) return;
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Discord role sync failed (${response.status}): ${detail.slice(0, 300)}`);
  }
}

/**
 * Reconciles subscription roles for every HMDL user affiliated with a guild.
 * A user keeps a plan role while at least one of their guild memberships has
 * an ACTIVE or TRIALING subscription for that plan.
 */
export async function syncGuildSubscriptionDiscordRoles(guildId: string) {
  const [guild, mappings] = await Promise.all([
    prisma.guild.findUnique({
      where: { id: guildId },
      select: {
        memberships: {
          select: {
            user: {
              select: {
                discordId: true,
                guildMemberships: {
                  select: {
                    guild: {
                      select: {
                        subscriptions: {
                          where: { status: { in: ["ACTIVE", "TRIALING"] } },
                          select: {
                            plan: {
                              select: {
                                discordSubscriptionRoleMapping: {
                                  select: { discordRoleId: true, enabled: true },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.discordSubscriptionRoleMapping.findMany({
      select: { discordRoleId: true, enabled: true },
    }),
  ]);

  if (!guild) return;
  const allMappedRoleIds = mappings.map((mapping: DiscordRoleMapping) => mapping.discordRoleId);
  const uniqueUsers = new Map<string, { desiredRoleIds: Set<string> }>();

  for (const membership of guild.memberships) {
    const user = membership.user;
    if (!user) continue;
    const desiredRoleIds = new Set<string>();
    for (const userMembership of user.guildMemberships) {
      for (const subscription of userMembership.guild.subscriptions) {
        const mapping = subscription.plan.discordSubscriptionRoleMapping;
        if (mapping?.enabled) desiredRoleIds.add(mapping.discordRoleId);
      }
    }
    uniqueUsers.set(user.discordId, { desiredRoleIds });
  }

  const operations: Promise<void>[] = [];
  for (const [discordId, { desiredRoleIds }] of uniqueUsers) {
    for (const mapping of mappings) {
      const shouldHaveRole = mapping.enabled && desiredRoleIds.has(mapping.discordRoleId);
      operations.push(setMemberRole(discordId, mapping.discordRoleId, shouldHaveRole));
    }
  }
  const results = await Promise.allSettled(operations);
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length) {
    console.error("[DISCORD SUBSCRIPTION ROLE SYNC] Failed role operations", failures);
    throw new Error(`Discord subscription role sync had ${failures.length} failed operation(s).`);
  }
}
