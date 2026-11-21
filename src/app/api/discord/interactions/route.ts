import { NextResponse } from "next/server";
import { createPublicKey, verify } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { updateDiscordAttendanceMessage } from "@/lib/discord-event-attendance";
import { syncEventAttendanceAndLeave } from "@/lib/events/attendance-leave-sync";

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

  // Prefer the explicit guild-member Discord ID. The OR query could match
  // two different member rows when a stale account link exists, causing a
  // valid response to be saved against the wrong character.
  let member = await prisma.guildMember.findFirst({
    where: { guildId: event.guildId, discordUserId, active: true },
    select: { id: true, characterName: true },
  });
  if (!member) {
    member = await prisma.guildMember.findFirst({
      where: { guildId: event.guildId, active: true, user: { is: { discordId: discordUserId } } },
      select: { id: true, characterName: true },
    });
  }
  if (!member) return ephemeral("Your Discord account is not linked to an active HMDL guild member.");

  const savedAttendance = await syncEventAttendanceAndLeave({ eventId, memberId: member.id, eventDate: event.date, timeZone: event.scheduleTimeZone, status });
  const persistedAttendance = await prisma.eventAttendance.findUnique({
    where: { eventId_memberId: { eventId, memberId: member.id } },
    select: { id: true, eventId: true, memberId: true, status: true, respondedAt: true },
  });
  console.info("[DISCORD ATTENDANCE] Write verification", {
    eventId,
    eventGuildId: event.guildId,
    discordGuildId: guildId,
    memberId: member.id,
    characterName: member.characterName,
    requestedStatus: status,
    upsertedStatus: savedAttendance.status,
    persistedStatus: persistedAttendance?.status ?? null,
    persistedEventId: persistedAttendance?.eventId ?? null,
    persistedMemberId: persistedAttendance?.memberId ?? null,
    respondedAt: persistedAttendance?.respondedAt?.toISOString() ?? null,
  });
  if (!persistedAttendance || persistedAttendance.status !== status) {
    return ephemeral("HMDL could not verify the saved attendance response. Please contact a guild manager.");
  }

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
  return ephemeral("Your attendance response is saved for **" + (member.characterName || "your character") + "**: " + labels[status] + ". You can change it until 30 minutes before the event.\nEvent reference: `" + eventId + "`");
}
