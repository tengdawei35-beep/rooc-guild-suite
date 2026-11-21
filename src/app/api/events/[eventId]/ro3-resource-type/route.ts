import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { hasGuildModule, isRoocGuild, RESOURCE_SUITE_MODULE } from "@/lib/auth/modules";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ eventId: string }> };

async function authorize() {
  const auth = await getCurrentAuth();
  if (!auth) return { response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  if (await isRoocGuild(auth.guild.id)) return { response: NextResponse.json({ error: "RO3 event resource linking is only available to RO3 guilds." }, { status: 409 }) };
  if (!(await hasGuildModule(auth.guild.id, RESOURCE_SUITE_MODULE))) return { response: NextResponse.json({ error: "The Resource Suite is not subscribed for this guild." }, { status: 403 }) };
  if (!hasPermission(auth.role, "events.manage")) return { response: NextResponse.json({ error: "You do not have permission to manage events." }, { status: 403 }) };
  return { auth };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const access = await authorize();
    if ("response" in access) return access.response;
    const { eventId } = await context.params;
    const event = await prisma.event.findFirst({
      where: { id: eventId, guildId: access.auth.guild.id },
      select: { id: true, ro3EventTypeId: true, ro3OptInsLockedAt: true, _count: { select: { ro3EventOptIns: true } } },
    });
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    const activeSeason = await prisma.ro3Season.findFirst({
      where: { guildId: access.auth.guild.id, status: "ACTIVE" },
      select: { id: true, name: true, eventTypes: { where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } } },
    });
    return NextResponse.json({
      event: { id: event.id, ro3EventTypeId: event.ro3EventTypeId, locked: event.ro3OptInsLockedAt !== null, hasOptIns: event._count.ro3EventOptIns > 0 },
      season: activeSeason ? { id: activeSeason.id, name: activeSeason.name } : null,
      eventTypes: activeSeason?.eventTypes ?? [],
    });
  } catch (error) {
    console.error("[RO3 EVENT TYPE GET]", error);
    return NextResponse.json({ error: "Failed to load RO3 event types." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await authorize();
    if ("response" in access) return access.response;
    const { eventId } = await context.params;
    const body = await request.json() as { ro3EventTypeId?: unknown };
    const eventTypeId = body.ro3EventTypeId === null ? null : typeof body.ro3EventTypeId === "string" ? body.ro3EventTypeId : undefined;
    if (eventTypeId === undefined) return NextResponse.json({ error: "Select a valid event type." }, { status: 400 });

    const event = await prisma.event.findFirst({
      where: { id: eventId, guildId: access.auth.guild.id },
      select: { id: true, ro3OptInsLockedAt: true, _count: { select: { ro3EventOptIns: true } } },
    });
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (event.ro3OptInsLockedAt || event._count.ro3EventOptIns > 0) {
      return NextResponse.json({ error: "The event type cannot be changed after Event Opt-ins have been locked or submitted." }, { status: 409 });
    }

    if (eventTypeId) {
      const eventType = await prisma.ro3EventType.findFirst({
        where: { id: eventTypeId, guildId: access.auth.guild.id, active: true, season: { is: { guildId: access.auth.guild.id, status: "ACTIVE" } } },
        select: { id: true },
      });
      if (!eventType) return NextResponse.json({ error: "Choose an active event type from the guild's active Resources pool." }, { status: 400 });
    }

    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { ro3EventTypeId: eventTypeId },
      select: { id: true, ro3EventTypeId: true },
    });
    return NextResponse.json({ event: updated });
  } catch (error) {
    console.error("[RO3 EVENT TYPE PATCH]", error);
    return NextResponse.json({ error: "Failed to link the event to its RO3 resource type." }, { status: 500 });
  }
}
