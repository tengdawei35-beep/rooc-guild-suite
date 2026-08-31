import { prisma } from "@/lib/prisma";
import { getNotificationConfig } from "@/lib/discord-notifications";

function serverTime(value: Date) {
  return value.toLocaleString("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "")
  );
}

async function sendWebhook(url: string, payload: object) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Discord webhook returned ${response.status}`);
  }
}

export async function notifyRosterPublished(input: {
  guildId: string;
  eventId: string;
  rosterId: string;
  eventUrl?: string | null;
}) {
  try {
    const config = await getNotificationConfig(input.guildId);
    const webhook = config?.rosterWebhookUrl;
    if (!webhook) return false;

    const event = await prisma.event.findFirst({
      where: { id: input.eventId, guildId: input.guildId },
      select: { type: true, date: true },
    });
    if (!event) return false;

    const roster = await prisma.roster.findFirst({
      where: { id: input.rosterId, eventId: input.eventId },
      include: {
        parties: {
          orderBy: [{ battlefield: "asc" }, { partyNumber: "asc" }],
          include: {
            members: {
              orderBy: { slotNumber: "asc" },
              include: {
                member: {
                  select: { characterName: true, discordUsername: true, job: true },
                },
              },
            },
          },
        },
      },
    });
    if (!roster) return false;

    const eventLabel = event.type === "GUILD_LEAGUE" ? "Guild League" : "Emperium Overrun";
    const url = input.eventUrl || `${appUrl()}/events/${input.eventId}`;

    const partyFields = roster.parties.map((party) => ({
      name: `⚔️  ${party.battlefield} • Party ${party.partyNumber}`,
      value:
        party.members
          .map((entry) => {
            const name = entry.member.characterName || entry.member.discordUsername || "Member";
            return `${name}${entry.member.job ? ` — ${entry.member.job}` : ""}`;
          })
          .join("\n") || "No members",
      inline: true,
    }));

    await sendWebhook(webhook, {
      embeds: [
        {
          title: `📋  ROSTER PUBLISHED  •  ${roster.name}`,
          description: `The final roster for **${eventLabel}** has been published and is now visible to the guild.`,
          color: 5793266,
          fields: [
            {
              name: "📅  EVENT",
              value: `${serverTime(event.date)}\nUTC+7 Server Time`,
              inline: true,
            },
            {
              name: "👥  PARTIES",
              value: `${roster.parties.length} ${roster.parties.length === 1 ? "party" : "parties"}`,
              inline: true,
            },
            ...partyFields,
            {
              name: "🔗  PUBLISHED ROSTER",
              value: `[View Published Roster →](${url})`,
              inline: false,
            },
          ],
          footer: { text: "ROOC Guild Suite • Event Rosters" },
          timestamp: new Date().toISOString(),
          url,
        },
      ],
      allowed_mentions: { parse: [] },
    });

    return true;
  } catch (error) {
    console.error("[DISCORD] Published roster notification failed:", error);
    return false;
  }
}
