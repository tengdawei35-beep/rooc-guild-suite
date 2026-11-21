import { prisma } from "@/lib/prisma";

export type EventAttendanceStatus = "AVAILABLE" | "UNAVAILABLE" | "AFK_BUSY";

export function localDateKey(date: Date, timeZone?: string | null) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function dateKeyToUtcDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export async function syncEventAttendanceAndLeave(args: {
  eventId: string;
  memberId: string;
  eventDate: Date;
  timeZone?: string | null;
  status: EventAttendanceStatus;
}) {
  const leaveDate = dateKeyToUtcDate(localDateKey(args.eventDate, args.timeZone));
  const attendance = await prisma.eventAttendance.upsert({
    where: { eventId_memberId: { eventId: args.eventId, memberId: args.memberId } },
    create: { eventId: args.eventId, memberId: args.memberId, status: args.status },
    update: { status: args.status, respondedAt: new Date() },
  });

  if (args.status === "UNAVAILABLE") {
    await prisma.memberLeave.upsert({
      where: { memberId_date: { memberId: args.memberId, date: leaveDate } },
      create: { memberId: args.memberId, date: leaveDate, reason: "Unavailable for event" },
      update: {},
    });
  } else {
    await prisma.memberLeave.deleteMany({
      where: { memberId: args.memberId, date: leaveDate },
    });
  }

  return attendance;
}

export async function syncManualLeaveToEvents(args: {
  guildId: string;
  memberId: string;
  date: Date;
  status: "UNAVAILABLE" | "AVAILABLE";
}) {
  const dateKey = args.date.toISOString().slice(0, 10);
  const events = await prisma.event.findMany({
    where: { guildId: args.guildId },
    select: { id: true, date: true, scheduleTimeZone: true },
  });
  const matching = events.filter((event) => localDateKey(event.date, event.scheduleTimeZone) === dateKey);
  for (const event of matching) {
    await prisma.eventAttendance.upsert({
      where: { eventId_memberId: { eventId: event.id, memberId: args.memberId } },
      create: { eventId: event.id, memberId: args.memberId, status: args.status },
      update: { status: args.status, respondedAt: new Date() },
    });
  }
}
