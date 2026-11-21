import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { isRoocGuild } from "@/lib/auth/modules";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function validTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 80) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return true; } catch { return false; }
}

function validateConfig(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const battlefieldCount = Number(body.battlefieldCount);
  const partiesPerBattlefield = Number(body.partiesPerBattlefield);
  const weekdays = body.weekdays;
  const startTime = typeof body.startTime === "string" ? body.startTime : "";
  const timeZone = body.timeZone;
  if (!name || name.length > 80) return "Event type name must be between 1 and 80 characters.";
  if (!Number.isInteger(battlefieldCount) || battlefieldCount < 1 || battlefieldCount > 20) return "Battlefield count must be between 1 and 20.";
  if (!Number.isInteger(partiesPerBattlefield) || partiesPerBattlefield < 1 || partiesPerBattlefield > 20) return "Parties per battlefield must be between 1 and 20.";
  if (!Array.isArray(weekdays) || weekdays.length < 1 || weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) return "Select at least one recurring weekday.";
  if (!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(startTime)) return "Enter a valid event start time.";
  if (!validTimeZone(timeZone)) return "Select a valid IANA timezone.";
  return null;
}

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "events.view")) return NextResponse.json({ error: "You do not have permission to view events." }, { status: 403 });
  if (await isRoocGuild(auth.guild.id)) return NextResponse.json({ eventTypes: [], timeZone: auth.guild.timeZone ?? null });
  const eventTypes = await prisma.guildEventType.findMany({
    where: { guildId: auth.guild.id },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  const activeSeason = await prisma.ro3Season.findFirst({
    where: { guildId: auth.guild.id, status: "ACTIVE" },
    select: { id: true },
  });
  const resourceEventTypes = activeSeason
    ? await prisma.ro3EventType.findMany({
        where: { guildId: auth.guild.id, seasonId: activeSeason.id, active: true, guildEventTypeId: { not: null } },
        select: { id: true, name: true, guildEventTypeId: true, guildEventType: { select: { name: true } } },
        orderBy: { name: "asc" },
      })
    : [];
  return NextResponse.json({ eventTypes, resourceEventTypes: resourceEventTypes.map(item => ({ id: item.id, name: item.guildEventType?.name ?? item.name, guildEventTypeId: item.guildEventTypeId })), isRo3: true, timeZone: auth.guild.timeZone ?? null });
}

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "events.manage")) return NextResponse.json({ error: "You do not have permission to manage event types." }, { status: 403 });
  if (await isRoocGuild(auth.guild.id)) return NextResponse.json({ error: "Custom event types are only available to RO3 guilds." }, { status: 409 });
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "setTimeZone") {
      const timeZone = body.timeZone;
      if (!validTimeZone(timeZone)) return NextResponse.json({ error: "A valid IANA timezone is required." }, { status: 400 });
      const guild = await prisma.guild.update({ where: { id: auth.guild.id }, data: { timeZone }, select: { timeZone: true } });
      return NextResponse.json({ timeZone: guild.timeZone });
    }
    const timeZone = validTimeZone(body.timeZone) ? body.timeZone : auth.guild.timeZone;
    if (!timeZone) return NextResponse.json({ error: "Detect your computer timezone or configure one before creating an event type." }, { status: 400 });
    const error = validateConfig({ ...body, timeZone });
    if (error) return NextResponse.json({ error }, { status: 400 });
    const eventType = await prisma.guildEventType.create({
      data: {
        guildId: auth.guild.id,
        name: (body.name as string).trim(),
        battlefieldCount: Number(body.battlefieldCount),
        partiesPerBattlefield: Number(body.partiesPerBattlefield),
        weekdays: body.weekdays as number[],
        startTime: body.startTime as string,
        timeZone,
      },
    });
    if (!auth.guild.timeZone) await prisma.guild.update({ where: { id: auth.guild.id }, data: { timeZone } });
    return NextResponse.json({ eventType }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "An event type with that name already exists." }, { status: 409 });
    console.error("[EVENT TYPES POST]", error);
    return NextResponse.json({ error: "Failed to create event type." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "events.manage")) return NextResponse.json({ error: "You do not have permission to manage event types." }, { status: 403 });
  if (await isRoocGuild(auth.guild.id)) return NextResponse.json({ error: "Custom event types are only available to RO3 guilds." }, { status: 409 });
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "setTimeZone") {
      if (!validTimeZone(body.timeZone)) return NextResponse.json({ error: "A valid IANA timezone is required." }, { status: 400 });
      const result = await prisma.guild.update({ where: { id: auth.guild.id }, data: { timeZone: body.timeZone }, select: { timeZone: true } });
      return NextResponse.json({ timeZone: result.timeZone });
    }
    const id = typeof body.id === "string" ? body.id : "";
    const existing = await prisma.guildEventType.findFirst({ where: { id, guildId: auth.guild.id } });
    if (!existing) return NextResponse.json({ error: "Event type not found." }, { status: 404 });
    if (typeof body.active === "boolean" && Object.keys(body).length <= 2) {
      const eventType = await prisma.guildEventType.update({ where: { id }, data: { active: body.active } });
      return NextResponse.json({ eventType });
    }
    const error = validateConfig({ ...body, timeZone: validTimeZone(body.timeZone) ? body.timeZone : existing.timeZone });
    if (error) return NextResponse.json({ error }, { status: 400 });
    const eventType = await prisma.guildEventType.update({
      where: { id },
      data: {
        name: (body.name as string).trim(),
        battlefieldCount: Number(body.battlefieldCount),
        partiesPerBattlefield: Number(body.partiesPerBattlefield),
        weekdays: body.weekdays as number[],
        startTime: body.startTime as string,
        timeZone: validTimeZone(body.timeZone) ? body.timeZone : existing.timeZone,
      },
    });
    return NextResponse.json({ eventType });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "An event type with that name already exists." }, { status: 409 });
    console.error("[EVENT TYPES PATCH]", error);
    return NextResponse.json({ error: "Failed to update event type." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "events.manage")) return NextResponse.json({ error: "You do not have permission to manage event types." }, { status: 403 });
  if (await isRoocGuild(auth.guild.id)) return NextResponse.json({ error: "Custom event types are only available to RO3 guilds." }, { status: 409 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "";
  const existing = await prisma.guildEventType.findFirst({ where: { id, guildId: auth.guild.id } });
  if (!existing) return NextResponse.json({ error: "Event type not found." }, { status: 404 });
  // Archive instead of hard deletion so historical events and resource rewards remain intact.
  const eventType = await prisma.guildEventType.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ eventType, archived: true });
}
