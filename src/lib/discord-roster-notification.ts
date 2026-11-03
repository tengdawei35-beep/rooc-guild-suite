import sharp from "sharp";
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

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type RosterImageParty = {
  battlefield: string;
  partyNumber: number;
  members: Array<{ name: string; job: string | null }>;
};

function buildRosterSvg(input: {
  title: string;
  subtitle: string;
  parties: RosterImageParty[];
}) {
  const width = 1400;
  const height = 1040;
  const margin = 36;
  const gap = 24;
  const cardWidth = (width - margin * 2 - gap) / 2;
  const cardHeight = 390;
  const startY = 190;
  const cards = input.parties.map((party, index) => {
    const x = margin + (index % 2) * (cardWidth + gap);
    const y = startY + Math.floor(index / 2) * (cardHeight + gap);
    const label = party.battlefield.replace(/^BATTLEFIELD_/, "Battlefield ");
    const rows = Array.from({ length: 5 }, (_, slotIndex) => {
      const member = party.members[slotIndex];
      const rowY = y + 128 + slotIndex * 48;
      const name = member?.name || "— Empty slot —";
      const job = member?.job || "";
      return `
        <line x1="${x + 24}" y1="${rowY - 25}" x2="${x + cardWidth - 24}" y2="${rowY - 25}" stroke="#303b51" stroke-width="1"/>
        <text x="${x + 28}" y="${rowY + 2}" fill="${member ? "#f4f7fb" : "#7e8ba1"}" font-size="24" font-weight="${member ? "600" : "400"}">${escapeXml(name.slice(0, 32))}</text>
        <text x="${x + cardWidth - 28}" y="${rowY + 2}" text-anchor="end" fill="#a9b9d1" font-size="19">${escapeXml(job.slice(0, 24))}</text>`;
    }).join("");
    return `
      <rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="18" fill="#111b2d" stroke="#35435b" stroke-width="2"/>
      <path d="M ${x + 18} ${y} H ${x + cardWidth - 18} Q ${x + cardWidth} ${y} ${x + cardWidth} ${y + 18} V ${y + 88} H ${x} V ${y + 18} Q ${x} ${y} ${x + 18} ${y}" fill="#1b2b45"/>
      <text x="${x + 26}" y="${y + 39}" fill="#ffffff" font-size="27" font-weight="700">${escapeXml(label)} · Party ${party.partyNumber}</text>
      <text x="${x + 26}" y="${y + 68}" fill="#9fb6d6" font-size="16" letter-spacing="2">PARTY ROSTER</text>
      ${rows}`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#080e19"/>
    <circle cx="1270" cy="60" r="170" fill="#183052" opacity=".28"/>
    <text x="40" y="62" fill="#8da9d0" font-size="18" font-weight="700" letter-spacing="5">ROOC GUILD SUITE</text>
    <text x="40" y="116" fill="#ffffff" font-size="42" font-weight="800">${escapeXml(input.title)}</text>
    <text x="40" y="153" fill="#a8b5c9" font-size="22">${escapeXml(input.subtitle)}</text>
    ${cards}
    <text x="40" y="1010" fill="#687b98" font-size="16" letter-spacing="2">OFFICIAL EVENT ROSTER</text>
  </svg>`;
}

async function renderRosterImage(input: {
  title: string;
  subtitle: string;
  parties: RosterImageParty[];
}) {
  return sharp(Buffer.from(buildRosterSvg(input)))
    .png()
    .toBuffer();
}

async function sendWebhookWithImages(
  url: string,
  input: {
    title: string;
    description: string;
    color: number;
    url: string;
    images: Array<{ filename: string; buffer: Buffer }>;
  },
) {
  const payload = {
    embeds: input.images.map((image, index) => ({
      title: input.title,
      description: index === 0 ? input.description : undefined,
      color: input.color,
      image: { url: `attachment://${image.filename}` },
      footer: { text: `ROOC Guild Suite • Roster image ${index + 1}/${input.images.length}` },
      url: input.url,
    })),
    attachments: input.images.map((image, index) => ({
      id: index,
      filename: image.filename,
    })),
    allowed_mentions: { parse: [] },
  };

  const form = new FormData();
  form.append("payload_json", JSON.stringify(payload));
  input.images.forEach((image, index) => {
    form.append(`files[${index}]`, new Blob([new Uint8Array(image.buffer)], { type: "image/png" }), image.filename);
  });

  const response = await fetch(url, {
    method: "POST",
    body: form,
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Discord webhook returned ${response.status}: ${detail.slice(0, 300)}`);
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
    // Published rosters use the dedicated roster webhook, never the Call To Arms webhook.
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

    const overrideRows = await prisma.$queryRawUnsafe<Array<{ rosterMemberId: string; job: string }>>(
      `SELECT "rosterMemberId", job
       FROM "RosterJobOverride"
       WHERE "rosterMemberId" IN (
         SELECT rm.id
         FROM "RosterMember" rm
         JOIN "RosterParty" rp ON rp.id = rm."partyId"
         WHERE rp."rosterId" = $1
       )`,
      roster.id
    );
    const overrideMap = new Map(
      overrideRows.map((row) => [row.rosterMemberId, row.job])
    );

    const eventLabel = event.type === "GUILD_LEAGUE" ? "Guild League" : "Emperium Overrun";
    const url = input.eventUrl || `${appUrl()}/events/${input.eventId}`;
    const parties: RosterImageParty[] = roster.parties.map((party) => ({
      battlefield: party.battlefield,
      partyNumber: party.partyNumber,
      members: party.members.map((entry) => ({
        name: entry.member.characterName || entry.member.discordUsername || "Member",
        job: overrideMap.get(entry.id) ?? entry.member.job,
      })),
    }));

    // Keep each image readable: four party cards (20 slots) per image.
    const partyGroups: RosterImageParty[][] = [];
    for (let index = 0; index < parties.length; index += 4) {
      partyGroups.push(parties.slice(index, index + 4));
    }
    const images = await Promise.all(
      partyGroups.map(async (group, index) => ({
        filename: `roster-${index + 1}.png`,
        buffer: await renderRosterImage({
          title: roster.name,
          subtitle: `${eventLabel} · ${serverTime(event.date)} · UTC+7`,
          parties: group,
        }),
      }))
    );

    await sendWebhookWithImages(webhook, {
      title: `📋 Roster Published · ${roster.name}`,
      description: `The ${eventLabel} final roster has been published. The roster is displayed in the attached images.`,
      color: 5793266,
      url,
      images,
    });

    return true;
  } catch (error) {
    console.error("[DISCORD] Published roster notification failed:", error);
    return false;
  }
}
