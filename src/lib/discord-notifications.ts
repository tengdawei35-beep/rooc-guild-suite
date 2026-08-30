import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

type NotificationType = "roster" | "bid" | "stats";

type NotificationConfig = {
  id: string;
  guildId: string;
  rosterWebhookUrl: string | null;
  bidWebhookUrl: string | null;
  statsWebhookUrl: string | null;
};

async function ensureNotificationTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "GuildNotificationConfig" (
      "id" TEXT PRIMARY KEY,
      "guildId" TEXT NOT NULL UNIQUE REFERENCES "Guild"("id") ON DELETE CASCADE,
      "rosterWebhookUrl" TEXT,
      "bidWebhookUrl" TEXT,
      "statsWebhookUrl" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

export async function getNotificationConfig(guildId: string) {
  await ensureNotificationTable();
  const rows = await prisma.$queryRaw<NotificationConfig[]>`
    SELECT "id", "guildId", "rosterWebhookUrl", "bidWebhookUrl", "statsWebhookUrl"
    FROM "GuildNotificationConfig"
    WHERE "guildId" = ${guildId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function saveNotificationConfig(
  guildId: string,
  values: Partial<Pick<NotificationConfig, "rosterWebhookUrl" | "bidWebhookUrl" | "statsWebhookUrl">>
) {
  await ensureNotificationTable();
  const existing = await getNotificationConfig(guildId);
  const roster = values.rosterWebhookUrl !== undefined ? values.rosterWebhookUrl : existing?.rosterWebhookUrl ?? null;
  const bid = values.bidWebhookUrl !== undefined ? values.bidWebhookUrl : existing?.bidWebhookUrl ?? null;
  const stats = values.statsWebhookUrl !== undefined ? values.statsWebhookUrl : existing?.statsWebhookUrl ?? null;

  if (existing) {
    await prisma.$executeRaw`
      UPDATE "GuildNotificationConfig"
      SET "rosterWebhookUrl" = ${roster},
          "bidWebhookUrl" = ${bid},
          "statsWebhookUrl" = ${stats},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "guildId" = ${guildId}
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO "GuildNotificationConfig" ("id", "guildId", "rosterWebhookUrl", "bidWebhookUrl", "statsWebhookUrl")
      VALUES (${randomUUID()}, ${guildId}, ${roster}, ${bid}, ${stats})
    `;
  }
}

function webhookFor(config: NotificationConfig | null, type: NotificationType) {
  if (!config) return null;
  return type === "roster"
    ? config.rosterWebhookUrl
    : type === "bid"
      ? config.bidWebhookUrl
      : config.statsWebhookUrl;
}

export function isDiscordWebhookUrl(value: string | null | undefined) {
  return !!value && /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//i.test(value);
}

async function sendWebhook(
  guildId: string,
  type: NotificationType,
  payload: { content: string; users?: string[] }
) {
  const config = await getNotificationConfig(guildId);
  const webhook = webhookFor(config, type);
  if (!webhook) return false;

  const users = Array.from(new Set(payload.users ?? [])).filter(Boolean);
  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: payload.content,
      allowed_mentions: { users },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Discord webhook failed (${response.status}): ${text.slice(0, 300)}`);
  }

  return true;
}

export async function notifyRosterUpdate(input: {
  guildId: string;
  eventId: string;
  rosterId?: string | null;
}) {
  try {
    const event = await prisma.event.findFirst({
      where: { id: input.eventId, guildId: input.guildId },
      select: { type: true, date: true },
    });
    if (!event) return;

    const roster = input.rosterId
      ? await prisma.roster.findFirst({
          where: { id: input.rosterId, eventId: input.eventId },
          select: { name: true },
        })
      : null;

    await sendWebhook(input.guildId, "roster", {
      content: roster
        ? `📋 **Roster updated:** ${roster.name}`
        : "📋 **Roster updated or removed.**",
    });
  } catch (error) {
    console.error("[DISCORD] Roster notification failed:", error);
  }
}

export async function notifyBidComplete(input: {
  guildId: string;
  allocationRunId: string;
}) {
  try {
    const run = await prisma.allocationRun.findFirst({
      where: { id: input.allocationRunId, guildId: input.guildId, status: "COMPLETED" },
      include: {
        event: { select: { type: true, date: true } },
        bidPages: {
          include: {
            slots: {
              include: {
                member: { select: { discordUserId: true, characterName: true } },
                resource: { select: { name: true, type: true } },
              },
            },
          },
        },
      },
    });
    if (!run) return;

    const users = run.bidPages.flatMap((page) =>
      page.slots.map((slot) => slot.member.discordUserId).filter((id): id is string => !!id)
    );
    const slotCount = run.bidPages.reduce((sum, page) => sum + page.slots.length, 0);
    const pageCount = run.bidPages.length;
    const eventLabel = run.event?.type === "GUILD_LEAGUE" ? "Guild League" : "Emperium Overrun";

    await sendWebhook(input.guildId, "bid", {
      content: `🎯 **Bid pages ready** for ${eventLabel}. ${pageCount} page${pageCount === 1 ? "" : "s"}, ${slotCount} bid slot${slotCount === 1 ? "" : "s"}.\n${Array.from(new Set(users)).map((id) => `<@${id}>`).join(" ")}`,
      users,
    });
  } catch (error) {
    console.error("[DISCORD] Bid notification failed:", error);
  }
}

export async function notifyStatsReminder(guildId: string) {
  try {
    const members = await prisma.guildMember.findMany({
      where: {
        guildId,
        active: true,
        OR: [
          { pdef: null }, { mdef: null }, { patk: null }, { matk: null }, { hp: null },
          { pvpDamageBonus: null }, { pvpDamageReduction: null },
        ],
      },
      select: { characterName: true, discordUserId: true },
      orderBy: { characterName: "asc" },
    });
    if (members.length === 0) return;

    const users = members.map((member) => member.discordUserId).filter((id): id is string => !!id);
    const names = members.slice(0, 10).map((member) => member.characterName).join(", ");
    const suffix = members.length > 10 ? ` and ${members.length - 10} more` : "";

    await sendWebhook(guildId, "stats", {
      content: `📊 **Stats reminder:** ${members.length} guild member${members.length === 1 ? " needs" : "s need"} updated stats. ${names}${suffix}\n${Array.from(new Set(users)).map((id) => `<@${id}>`).join(" ")}`,
      users,
    });
  } catch (error) {
    console.error("[DISCORD] Stats reminder failed:", error);
  }
}

export async function notifyStatsForAllGuilds() {
  await ensureNotificationTable();
  const configs = await prisma.$queryRaw<Array<{ guildId: string }>>`
    SELECT "guildId" FROM "GuildNotificationConfig" WHERE "statsWebhookUrl" IS NOT NULL
  `;
  for (const config of configs) await notifyStatsReminder(config.guildId);
}
