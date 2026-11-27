import { prisma } from "@/lib/prisma";

const DISCORD_API = "https://discord.com/api/v10";
type DiscordRoleMapping = { discordRoleId: string; enabled: boolean };

async function setMemberRole(discordId: string, roleId: string, shouldHaveRole: boolean) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const officialGuildId = process.env.DISCORD_OFFICIAL_GUILD_ID;
  if (!token || !officialGuildId) throw new Error("Discord subscription role sync is not configured.");

  let response: Response | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    response = await fetch(
      `${DISCORD_API}/guilds/${officialGuildId}/members/${discordId}/roles/${roleId}`,
      {
        method: shouldHaveRole ? "PUT" : "DELETE",
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store",
      },
    );
    if (response.status !== 429) break;

    const detail = await response.text().catch(() => "");
    let retryAfterSeconds = Number(response.headers.get("retry-after"));
    try {
      const payload = JSON.parse(detail) as { retry_after?: number };
      if (Number.isFinite(payload.retry_after)) retryAfterSeconds = payload.retry_after!;
    } catch {
      // Fall back to the Retry-After response header.
    }
    if (attempt === 3 || !Number.isFinite(retryAfterSeconds) || retryAfterSeconds < 0 || retryAfterSeconds > 30) {
      throw new Error(`HTTP 429: Discord rate limit reached; retry after ${Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : "an unknown interval"} seconds.`);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.ceil(retryAfterSeconds * 1000)));
  }

  if (!response) throw new Error("Discord role request did not execute.");
  // A user who has not joined the official community server cannot receive a role.
  if (response.status === 404) return;
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    let reason = detail;
    try {
      const payload = JSON.parse(detail) as { message?: string; code?: number };
      reason = [payload.message, payload.code ? `Discord code ${payload.code}` : ""].filter(Boolean).join(" — ");
    } catch {
      // Keep a short response excerpt for non-JSON proxy/API errors.
      reason = detail.slice(0, 160);
    }
    throw new Error(`HTTP ${response.status}${reason ? `: ${reason}` : ""}`);
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

  const operations: Array<{ label: string; run: () => Promise<void> }> = [];
  for (const [discordId, { desiredRoleIds }] of uniqueUsers) {
    for (const mapping of mappings) {
      const shouldHaveRole = mapping.enabled && desiredRoleIds.has(mapping.discordRoleId);
      operations.push({
        label: `role ${mapping.discordRoleId} (${shouldHaveRole ? "assign" : "remove"})`,
        run: () => setMemberRole(discordId, mapping.discordRoleId, shouldHaveRole),
      });
    }
  }

  // Keep requests bounded across large guilds to avoid flooding the Discord API.
  const results: PromiseSettledResult<void>[] = new Array(operations.length);
  let nextOperation = 0;
  const worker = async () => {
    while (nextOperation < operations.length) {
      const index = nextOperation++;
      try {
        await operations[index].run();
        results[index] = { status: "fulfilled", value: undefined };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, operations.length) }, () => worker()));
  const failures = results.flatMap((result, index) =>
    result.status === "rejected"
      ? [`${operations[index].label}: ${result.reason instanceof Error ? result.reason.message : "Unknown Discord API error"}`]
      : [],
  );

  if (failures.length) {
    console.error("[DISCORD SUBSCRIPTION ROLE SYNC] Failed role operations", { guildId, failures });
    throw new Error(`Discord role sync failed for ${failures.length} operation(s): ${failures.slice(0, 5).join("; ")}`);
  }
}
