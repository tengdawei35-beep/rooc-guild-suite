import { prisma } from "@/lib/prisma";

const DISCORD_API = "https://discord.com/api/v10";

function attendanceComponents(eventId: string) {
  return [{
    type: 1,
    components: [
      { type: 2, style: 3, label: "Available", emoji: { name: "🟢" }, custom_id: "att:" + eventId + ":AVAILABLE" },
      { type: 2, style: 4, label: "Unavailable", emoji: { name: "🔴" }, custom_id: "att:" + eventId + ":UNAVAILABLE" },
      { type: 2, style: 2, label: "AFK / Busy", emoji: { name: "🟡" }, custom_id: "att:" + eventId + ":AFK_BUSY" },
    ],
  }];
}

async function getEventChannelId(guildId: string) {
  await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "guild_event_discord_channels" ("guild_id" text PRIMARY KEY,"channel_id" text NOT NULL,"updated_at" timestamptz NOT NULL DEFAULT now())');
  const rows = await prisma.$queryRawUnsafe<Array<{ channel_id: string }>>('SELECT channel_id FROM "guild_event_discord_channels" WHERE guild_id=$1', guildId);
  return rows[0]?.channel_id ?? null;
}

async function discordRequest(path: string, method: string, body: unknown) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not configured.");
  return fetch(DISCORD_API + path, {
    method,
    headers: { authorization: "Bot " + token, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function eventTitle(event: { type: string; eventTypeName: string | null }) {
  if (event.type === "RO3_CUSTOM") return event.eventTypeName || "RO3 Event";
  return event.type === "GUILD_LEAGUE" ? "Guild League" : "Emperium Overrun";
}

export async function sendEventAttendanceMessage(eventId: string, allowResend = false) {
  const event = await prisma.event.findFirst({
    where: { id: eventId },
    include: { guild: { select: { id: true, name: true, discordGuildId: true } } },
  });
  if (!event) return { sent: false, reason: "event_not_found" };
  if (event.date.getTime() - Date.now() <= 30 * 60 * 1000) return { sent: false, reason: "event_started_or_locked" };
  if (event.attendanceMessageId && !allowResend) return { sent: false, reason: "already_sent" };
  const channelId = await getEventChannelId(event.guildId);
  if (!channelId || !process.env.DISCORD_BOT_TOKEN) return { sent: false, reason: "discord_not_configured" };
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: event.scheduleTimeZone || "Asia/Bangkok",
    dateStyle: "full",
    timeStyle: "short",
  }).format(event.date);
  const response = await discordRequest("/channels/" + channelId + "/messages", "POST", {
    content: "📣 **" + eventTitle(event) + "** — " + event.guild.name + "\n" +
      "Event time: **" + date + "**\nEvent reference: `" + event.id + "`\n\n" +
      "Please select your attendance status below. You can change your response until 30 minutes before the event starts.\n" +
      "🟢 Available — eligible for normal roster assignment\n" +
      "🔴 Unavailable — excluded from event participation\n" +
      "🟡 AFK / Busy — excluded from active parties but retained for rewards",
    components: attendanceComponents(event.id),
    allowed_mentions: { parse: [] },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error("Discord attendance message failed (" + response.status + "): " + detail.slice(0, 300));
  }
  const message = await response.json() as { id: string };
  await prisma.event.update({ where: { id: event.id }, data: { attendanceChannelId: channelId, attendanceMessageId: message.id } });
  return { sent: true, messageId: message.id };
}

export async function sendEventAttendanceReminder(eventId: string) {
  const event = await prisma.event.findFirst({
    where: { id: eventId },
    include: { guild: { select: { name: true } } },
  });
  if (!event || event.reminderMessageId) return { sent: false, reason: "already_sent_or_missing" };
  const channelId = event.attendanceChannelId || await getEventChannelId(event.guildId);
  if (!channelId || !process.env.DISCORD_BOT_TOKEN) return { sent: false, reason: "discord_not_configured" };
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: event.scheduleTimeZone || "Asia/Bangkok",
    dateStyle: "full",
    timeStyle: "short",
  }).format(event.date);
  const response = await discordRequest("/channels/" + channelId + "/messages", "POST", {
    content: "⏰ **48-hour event reminder**\n" + eventTitle(event) + " — " + event.guild.name +
      "\nEvent time: **" + date + "**\n\nPlease confirm or update your attendance below. Responses lock 30 minutes before the event starts.",
    components: attendanceComponents(event.id),
    allowed_mentions: { parse: [] },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error("Discord attendance reminder failed (" + response.status + "): " + detail.slice(0, 300));
  }
  const message = await response.json() as { id: string };
  await prisma.event.update({ where: { id: event.id }, data: { reminderMessageId: message.id } });
  return { sent: true, messageId: message.id };
}

export async function sendEventTimeReminder(eventId: string, minutesBefore: 60 | 15) {
  const event = await prisma.event.findFirst({
    where: { id: eventId },
    include: { guild: { select: { name: true } } },
  });
  if (!event) return { sent: false, reason: "event_not_found" };
  const alreadySent = minutesBefore === 60 ? event.reminder1hMessageId : event.reminder15mMessageId;
  if (alreadySent) return { sent: false, reason: "already_sent" };
  const channelId = event.attendanceChannelId || await getEventChannelId(event.guildId);
  if (!channelId || !process.env.DISCORD_BOT_TOKEN) return { sent: false, reason: "discord_not_configured" };
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: event.scheduleTimeZone || "Asia/Bangkok",
    dateStyle: "full",
    timeStyle: "short",
  }).format(event.date);
  const label = minutesBefore === 60 ? "1-hour" : "15-minute";
  const response = await discordRequest("/channels/" + channelId + "/messages", "POST", {
    content: "@everyone ⏰ **" + label + " event reminder**\n" + eventTitle(event) + " — " + event.guild.name +
      "\nEvent time: **" + date + "**\n\nThe event starts in " + minutesBefore +
      " minutes. Please get ready and make sure your attendance status is up to date.",
    components: attendanceComponents(event.id),
    allowed_mentions: { parse: ["everyone"] },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error("Discord " + label + " reminder failed (" + response.status + "): " + detail.slice(0, 300));
  }
  const message = await response.json() as { id: string };
  if (minutesBefore === 60) {
    await prisma.event.update({ where: { id: event.id }, data: { reminder1hMessageId: message.id } });
  } else {
    await prisma.event.update({ where: { id: event.id }, data: { reminder15mMessageId: message.id } });
  }
  return { sent: true, messageId: message.id };
}

export async function updateDiscordAttendanceMessage(eventId: string, channelId: string, messageId: string) {
  const counts = await prisma.eventAttendance.groupBy({
    by: ["status"],
    where: { eventId },
    _count: { _all: true },
  });
  const count = (status: string) => counts.find(row => row.status === status)?._count._all ?? 0;
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { type: true, eventTypeName: true } });
  if (!event) return;
  await discordRequest("/channels/" + channelId + "/messages/" + messageId, "PATCH", {
    content: "📋 **" + eventTitle(event) + " — Attendance**\n" +
      "🟢 Available: **" + count("AVAILABLE") + "** · 🔴 Unavailable: **" + count("UNAVAILABLE") +
      "** · 🟡 AFK / Busy: **" + count("AFK_BUSY") + "**\n\nYou can update your response until 30 minutes before the event starts.",
    components: attendanceComponents(eventId),
    allowed_mentions: { parse: [] },
  });
}
