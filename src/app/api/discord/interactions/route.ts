import { NextResponse } from "next/server";
import { createPublicKey, verify } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { updateDiscordAttendanceMessage } from "@/lib/discord-event-attendance";

export const runtime = "nodejs";

function verifyDiscordSignature(body: string, signature: string | null, timestamp: string | null) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey || !signature || !timestamp || !/^[0-9a-f]{128}$/i.test(signature) || !/^\d+$/.test(timestamp)) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(publicKey, "hex")]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.concat([Buffer.from(timestamp), Buffer.from(body)]), key, Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

function ephemeral(content: string) {
  return NextResponse.json({ type: 4, data: { content, flags: 64 } });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyDiscordSignature(rawBody, request.headers.get("x-signature-ed25519"), request.headers.get("x-signature-timestamp"))) {
    return NextResponse.json({ error: "Invalid Discord request signature." }, { status: 401 });
  }

  let interaction: any;
  try { interaction = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid interaction payload." }, { status: 400 }); }
  if (interaction.type === 1) return NextResponse.json({ type: 1 });
  if (interaction.type !== 3 || typeof interaction.data?.custom_id !== "string") return ephemeral("This HMDL interaction is not supported.");

  const [prefix, eventId, status] = interaction.data.custom_id.split(":");
  if (prefix !== "att" || !eventId || !["AVAILABLE", "UNAVAILABLE", "AFK_BUSY"].includes(status)) return ephemeral("This attendance button is invalid.");

  const discordUserId = interaction.member?.user?.id || interaction.user?.id;
  const guildId = interaction.guild_id;
  if (!discordUserId || !guildId) return ephemeral("This attendance button must be used inside your guild server.");

  const event = await prisma.event.findFirst({
    where: { id: eventId },
    include: { guild: { select: { id: true, discordGuildId: true } } },
  });
  if (!event || event.guild.discordGuildId !== guildId) return ephemeral("This event does not belong to this Discord server.");
  const clickedMessageId = interaction.message?.id;
  if (!event.attendanceChannelId || event.attendanceChannelId !== interaction.channel_id || !clickedMessageId || (clickedMessageId !== event.attendanceMessageId && clickedMessageId !== event.reminderMessageId)) {
    return ephemeral("This attendance message is no longer valid for this event.");
  }
  if (event.date.getTime() - Date.now() <= 30 * 60 * 1000) return ephemeral("Attendance is locked 30 minutes before the event starts.");

  const member = await prisma.guildMember.findFirst({
    where: {
      guildId: event.guildId,
      active: true,
      OR: [{ discordUserId }, { user: { is: { discordId: discordUserId } } }],
    },
    select: { id: true },
  });
  if (!member) return ephemeral("Your Discord account is not linked to an active HMDL guild member.");

  await prisma.eventAttendance.upsert({
    where: { eventId_memberId: { eventId, memberId: member.id } },
    create: { eventId, memberId: member.id, status },
    update: { status, respondedAt: new Date() },
  });

  const channelId = interaction.channel_id;
  const messageId = interaction.message?.id;
  if (channelId && messageId) {
    try { await updateDiscordAttendanceMessage(eventId, channelId, messageId); }
    catch (error) { console.error("[DISCORD ATTENDANCE] Failed to update message:", error); }
  }

  const labels: Record<string, string> = {
    AVAILABLE: "🟢 Available",
    UNAVAILABLE: "🔴 Unavailable",
    AFK_BUSY: "🟡 AFK / Busy",
  };
  return ephemeral("Your attendance response is saved: " + labels[status] + ". You can change it until 30 minutes before the event.");
}
