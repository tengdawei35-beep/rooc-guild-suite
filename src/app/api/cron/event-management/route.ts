import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEventAttendanceMessage, sendEventAttendanceReminder, sendEventTimeReminder } from "@/lib/discord-event-attendance";
import { formatCalendarDate, getLocalCalendarDate, zonedDateTimeToUtc } from "@/lib/event-schedule";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const eventTypes = await prisma.guildEventType.findMany({
    where: { active: true, guild: { is: { gameType: "RO3", subscriptions: { some: { status: { in: ["ACTIVE", "TRIALING"] }, OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }] } } } } },
    select: { id: true, guildId: true, name: true, weekdays: true, startTime: true, timeZone: true, battlefieldCount: true, partiesPerBattlefield: true },
  });

  let created = 0;
  let skipped = 0;
  for (const eventType of eventTypes) {
    const localToday = getLocalCalendarDate(now, eventType.timeZone);
    const start = new Date(Date.UTC(localToday.year, localToday.month - 1, localToday.day));
    for (let offset = 0; offset < 30; offset++) {
      const calendar = new Date(start.getTime() + offset * 86400000);
      if (!eventType.weekdays.includes(calendar.getUTCDay())) continue;
      const dateString = formatCalendarDate(calendar.getUTCFullYear(), calendar.getUTCMonth() + 1, calendar.getUTCDate());
      const eventDate = zonedDateTimeToUtc(dateString, eventType.startTime, eventType.timeZone);
      if (!eventDate || eventDate <= now) continue;
      const existing = await prisma.event.findFirst({
        where: { guildId: eventType.guildId, guildEventTypeId: eventType.id, type: "RO3_CUSTOM", date: eventDate },
        select: { id: true },
      });
      if (existing) { skipped++; continue; }

      const activeSeason = await prisma.ro3Season.findFirst({
        where: { guildId: eventType.guildId, status: "ACTIVE" },
        select: { id: true },
      });
      const rewardType = activeSeason ? await prisma.ro3EventType.findFirst({
        where: { guildId: eventType.guildId, seasonId: activeSeason.id, guildEventTypeId: eventType.id, active: true },
        select: { id: true },
      }) : null;

      await prisma.event.create({
        data: {
          guildId: eventType.guildId,
          type: "RO3_CUSTOM",
          date: eventDate,
          guildEventTypeId: eventType.id,
          eventTypeName: eventType.name,
          battlefieldCount: eventType.battlefieldCount,
          partiesPerBattlefield: eventType.partiesPerBattlefield,
          scheduleTimeZone: eventType.timeZone,
          ro3EventTypeId: rewardType?.id ?? null,
        },
      });
      created++;
      try {
        const createdEvent = await prisma.event.findFirst({ where: { guildId: eventType.guildId, guildEventTypeId: eventType.id, type: "RO3_CUSTOM", date: eventDate }, select: { id: true } });
        if (createdEvent) await sendEventAttendanceMessage(createdEvent.id);
      } catch (error) { console.error("[EVENT CRON] Attendance message failed:", error); }
    }
  }

  const pendingAttendanceMessages = await prisma.event.findMany({
    where: { date: { gt: now, lte: new Date(now.getTime() + 30 * 86400000) }, attendanceMessageId: null, guild: { is: { subscriptions: { some: { status: { in: ["ACTIVE", "TRIALING"] }, OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }] } } } } },
    select: { id: true },
  });
  let attendanceMessagesSent = 0;
  for (const event of pendingAttendanceMessages) {
    try {
      const result = await sendEventAttendanceMessage(event.id);
      if (result.sent) attendanceMessagesSent++;
    } catch (error) { console.error("[EVENT CRON] Attendance message retry failed:", error); }
  }

  const reminderStart = new Date(now.getTime() + 47.5 * 60 * 60 * 1000);
  const reminderEnd = new Date(now.getTime() + 48.5 * 60 * 60 * 1000);
  const reminders = await prisma.event.findMany({
    where: { date: { gte: reminderStart, lte: reminderEnd }, reminderMessageId: null, attendanceMessageId: { not: null }, guild: { is: { subscriptions: { some: { status: { in: ["ACTIVE", "TRIALING"] }, OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }] } } } } },
    select: { id: true },
  });
  let remindersSent = 0;
  for (const event of reminders) {
    try {
      const result = await sendEventAttendanceReminder(event.id);
      if (result.sent) remindersSent++;
    } catch (error) { console.error("[EVENT CRON] Attendance reminder failed:", error); }
  }

  const oneHourStart = new Date(now.getTime() + 57.5 * 60 * 1000);
  const oneHourEnd = new Date(now.getTime() + 62.5 * 60 * 1000);
  const oneHourEvents = await prisma.event.findMany({
    where: { date: { gte: oneHourStart, lte: oneHourEnd }, reminder1hMessageId: null, attendanceMessageId: { not: null }, guild: { is: { subscriptions: { some: { status: { in: ["ACTIVE", "TRIALING"] }, OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }] } } } } },
    select: { id: true },
  });
  let oneHourRemindersSent = 0;
  for (const event of oneHourEvents) {
    try {
      const result = await sendEventTimeReminder(event.id, 60);
      if (result.sent) oneHourRemindersSent++;
    } catch (error) { console.error("[EVENT CRON] 1-hour reminder failed:", error); }
  }

  const fifteenMinuteStart = new Date(now.getTime() + 12.5 * 60 * 1000);
  const fifteenMinuteEnd = new Date(now.getTime() + 17.5 * 60 * 1000);
  const fifteenMinuteEvents = await prisma.event.findMany({
    where: { date: { gte: fifteenMinuteStart, lte: fifteenMinuteEnd }, reminder15mMessageId: null, attendanceMessageId: { not: null }, guild: { is: { subscriptions: { some: { status: { in: ["ACTIVE", "TRIALING"] }, OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }] } } } } },
    select: { id: true },
  });
  let fifteenMinuteRemindersSent = 0;
  for (const event of fifteenMinuteEvents) {
    try {
      const result = await sendEventTimeReminder(event.id, 15);
      if (result.sent) fifteenMinuteRemindersSent++;
    } catch (error) { console.error("[EVENT CRON] 15-minute reminder failed:", error); }
  }

  return NextResponse.json({ success: true, created, skipped, attendanceMessagesSent, remindersSent, oneHourRemindersSent, fifteenMinuteRemindersSent, scannedEventTypes: eventTypes.length, generatedAt: now.toISOString() });
}
