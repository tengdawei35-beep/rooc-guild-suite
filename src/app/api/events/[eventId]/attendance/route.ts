import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ eventId: string }> };
const statuses = ["AVAILABLE", "UNAVAILABLE", "AFK_BUSY"] as const;

export async function GET(_request: Request, context: Context) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { eventId } = await context.params;
  const event = await prisma.event.findFirst({
    where: { id: eventId, guildId: auth.guild.id },
    select: { id: true, date: true, guildId: true, attendance: { where: { member: { is: { active: true } } }, include: { member: { select: { id: true, characterName: true, job: true, userId: true, user: { select: { discordId: true, username: true } } } } }, orderBy: { respondedAt: "asc" } } },
  });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  const ownMember = await prisma.guildMember.findFirst({ where: { guildId: auth.guild.id, userId: auth.user.id }, select: { id: true } });
  const canManage = hasPermission(auth.role, "events.manage");
  const visibleMembers = await prisma.guildMember.findMany({
    where: { guildId: auth.guild.id, active: true, ...(canManage ? {} : { id: ownMember?.id ?? "__none__" }) },
    select: { id: true, characterName: true, job: true, user: { select: { username: true } } },
    orderBy: { characterName: "asc" },
  });
  const attendance = visibleMembers.map(member => {
    const response = event.attendance.find(item => item.memberId === member.id);
    return {
      memberId: member.id,
      characterName: member.characterName,
      job: member.job,
      status: response?.status ?? null,
      respondedAt: response?.respondedAt ?? null,
      discordUsername: canManage ? member.user?.username ?? null : null,
    };
  });
  const totalActiveMembers = await prisma.guildMember.count({ where: { guildId: auth.guild.id, active: true } });
  const counts = {
    available: event.attendance.filter(item => item.status === "AVAILABLE").length,
    unavailable: event.attendance.filter(item => item.status === "UNAVAILABLE").length,
    afkBusy: event.attendance.filter(item => item.status === "AFK_BUSY").length,
    noResponse: Math.max(0, totalActiveMembers - event.attendance.length),
  };
  return NextResponse.json({
    attendance,
    counts,
    ownStatus: ownMember ? event.attendance.find(item => item.memberId === ownMember.id)?.status ?? null : null,
    locked: event.date.getTime() - Date.now() <= 30 * 60 * 1000,
    canManage,
  });
}

export async function POST(request: Request, context: Context) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const status = body.status;
  if (!statuses.includes(status)) return NextResponse.json({ error: "Choose Available, Unavailable, or AFK / Busy." }, { status: 400 });
  const { eventId } = await context.params;
  const event = await prisma.event.findFirst({ where: { id: eventId, guildId: auth.guild.id }, select: { id: true, date: true } });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  if (event.date.getTime() - Date.now() <= 30 * 60 * 1000) return NextResponse.json({ error: "Attendance responses are locked 30 minutes before the event starts." }, { status: 409 });
  const member = await prisma.guildMember.findFirst({ where: { guildId: auth.guild.id, userId: auth.user.id, active: true }, select: { id: true } });
  if (!member) return NextResponse.json({ error: "Your Discord account is not linked to an active guild member." }, { status: 403 });
  const attendance = await prisma.eventAttendance.upsert({
    where: { eventId_memberId: { eventId, memberId: member.id } },
    create: { eventId, memberId: member.id, status },
    update: { status, respondedAt: new Date() },
    select: { status: true, respondedAt: true },
  });
  return NextResponse.json({ attendance });
}
