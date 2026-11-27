import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { localDateKey, syncEventAttendanceAndLeave } from "@/lib/events/attendance-leave-sync";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Context = { params: Promise<{ eventId: string }> };
const statuses = ["AVAILABLE", "UNAVAILABLE", "AFK_BUSY"] as const;

export async function GET(_request: Request, context: Context) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { eventId } = await context.params;
  const event = await prisma.event.findFirst({
    where: { id: eventId, guildId: auth.guild.id },
    select: { id: true, date: true, scheduleTimeZone: true, guildId: true, attendance: { where: { member: { is: { active: true } } }, include: { member: { select: { id: true, characterName: true, job: true, userId: true, user: { select: { discordId: true, username: true } } } } }, orderBy: { respondedAt: "asc" } } },
  });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const directAttendanceRows = await prisma.eventAttendance.findMany({
    where: { eventId },
    select: { id: true, memberId: true, status: true, respondedAt: true, member: { select: { characterName: true, active: true, guildId: true } } },
    orderBy: { respondedAt: "desc" },
  });
  console.info("[EVENT ATTENDANCE GET] Database read", {
    eventId,
    guildId: auth.guild.id,
    relatedRows: event.attendance.length,
    directRows: directAttendanceRows.length,
    rows: directAttendanceRows.map(row => ({ memberId: row.memberId, characterName: row.member.characterName, active: row.member.active, memberGuildId: row.member.guildId, status: row.status, respondedAt: row.respondedAt.toISOString() })),
  });
  // Resolve by explicit Discord ID first, matching the Discord interaction
  // handler. Only fall back to the linked HMDL user when no direct link exists.
  let ownMember = auth.user.discordId
    ? await prisma.guildMember.findFirst({
        where: { guildId: auth.guild.id, discordUserId: auth.user.discordId, active: true },
        select: { id: true },
      })
    : null;
  if (!ownMember) {
    ownMember = await prisma.guildMember.findFirst({
      where: { guildId: auth.guild.id, userId: auth.user.id, active: true },
      select: { id: true },
    });
  }
  const canManage = hasPermission(auth.role, "events.manage");
  const visibleMembers = await prisma.guildMember.findMany({
    where: { guildId: auth.guild.id, active: true, ...(canManage ? {} : { id: ownMember?.id ?? "__none__" }) },
    select: { id: true, characterName: true, job: true, user: { select: { username: true } } },
    orderBy: { characterName: "asc" },
  });
  const leaveDate = new Date(`${localDateKey(event.date, event.scheduleTimeZone)}T00:00:00.000Z`);
  const leaves = await prisma.memberLeave.findMany({ where: { memberId: { in: visibleMembers.map(member => member.id) }, date: leaveDate }, select: { memberId: true } });
  const memberLeaveIds = new Set(leaves.map(leave => leave.memberId));
  const attendance = visibleMembers.map(member => {
    const response = event.attendance.find(item => item.memberId === member.id);
    const onLeave = memberLeaveIds.has(member.id);
    return {
      memberId: member.id,
      characterName: member.characterName,
      job: member.job,
      status: onLeave ? "UNAVAILABLE" : response?.status ?? null,
      respondedAt: response?.respondedAt ?? null,
      discordUsername: canManage ? member.user?.username ?? null : null,
    };
  });
  const counts = {
    available: attendance.filter(item => item.status === "AVAILABLE").length,
    unavailable: attendance.filter(item => item.status === "UNAVAILABLE").length,
    afkBusy: attendance.filter(item => item.status === "AFK_BUSY").length,
    noResponse: attendance.filter(item => item.status === null).length,
  };
  return NextResponse.json({
    attendance,
    counts,
    ownStatus: ownMember ? (memberLeaveIds.has(ownMember.id) ? "UNAVAILABLE" : event.attendance.find(item => item.memberId === ownMember.id)?.status ?? null) : null,
    locked: event.date.getTime() - Date.now() <= 30 * 60 * 1000,
    canManage,
    ...(canManage ? { attendanceDiagnostics: directAttendanceRows.map(row => ({ memberId: row.memberId, characterName: row.member.characterName, active: row.member.active, status: row.status, respondedAt: row.respondedAt })) } : {}),
  }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } });
}

export async function POST(request: Request, context: Context) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!auth.subscriptionActive) return NextResponse.json({ error: "This guild is read-only until its subscription is renewed." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const status = body.status;
  if (!statuses.includes(status)) return NextResponse.json({ error: "Choose Available, Unavailable, or AFK / Busy." }, { status: 400 });
  const { eventId } = await context.params;
  const event = await prisma.event.findFirst({ where: { id: eventId, guildId: auth.guild.id }, select: { id: true, date: true, scheduleTimeZone: true } });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  if (event.date.getTime() - Date.now() <= 30 * 60 * 1000) return NextResponse.json({ error: "Attendance responses are locked 30 minutes before the event starts." }, { status: 409 });
  let member = auth.user.discordId
    ? await prisma.guildMember.findFirst({ where: { guildId: auth.guild.id, discordUserId: auth.user.discordId, active: true }, select: { id: true } })
    : null;
  if (!member) member = await prisma.guildMember.findFirst({ where: { guildId: auth.guild.id, userId: auth.user.id, active: true }, select: { id: true } });
  if (!member) return NextResponse.json({ error: "Your Discord account is not linked to an active guild member." }, { status: 403 });
  const attendance = await syncEventAttendanceAndLeave({ eventId, memberId: member.id, eventDate: event.date, timeZone: event.scheduleTimeZone, status });
  return NextResponse.json({ attendance }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } });
}
