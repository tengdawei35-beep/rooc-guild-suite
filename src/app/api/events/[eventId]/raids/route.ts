import { NextResponse } from "next/server";
import { getCurrentAuth, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ eventId: string }> };

async function getEvent(eventId: string) {
  const auth = await getCurrentAuth();
  if (!auth) return { auth: null, event: null };

  const event = await prisma.event.findFirst({
    where: { id: eventId, guildId: auth.guild.id },
    select: { id: true, guildId: true },
  });

  return { auth, event };
}

function validatePartyIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  return [...new Set(ids)];
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { eventId } = await context.params;
    const { auth, event } = await getEvent(eventId);

    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (!hasPermission(auth.role, "events.view")) return NextResponse.json({ error: "You do not have permission to view events." }, { status: 403 });

    const rosters = await prisma.roster.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
      include: {
        parties: {
          orderBy: [{ battlefield: "asc" }, { partyNumber: "asc" }],
          include: {
            raids: { include: { raid: true } },
          },
        },
      },
    });

    const raids = await prisma.raid.findMany({
      where: { parties: { some: { party: { roster: { eventId } } } } },
      orderBy: { createdAt: "asc" },
      include: {
        parties: {
          include: {
            party: { select: { id: true, rosterId: true, partyNumber: true, battlefield: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json({
      raids: raids.map((raid) => ({
        id: raid.id,
        name: raid.name,
        partyIds: raid.parties.map((entry) => entry.partyId),
      })),
      rosters: rosters.map((roster) => ({
        id: roster.id,
        name: roster.name,
        parties: roster.parties.map((party) => ({
          id: party.id,
          partyNumber: party.partyNumber,
          battlefield: party.battlefield,
          raidId: party.raids[0]?.raidId ?? null,
        })),
      })),
      canEdit: hasPermission(auth.role, "rosters.edit"),
    });
  } catch (error) {
    console.error("[RAIDS GET]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load raids." }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { eventId } = await context.params;
    const { auth, event } = await getEvent(eventId);

    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (!hasPermission(auth.role, "rosters.edit")) return NextResponse.json({ error: "You do not have permission to manage raids." }, { status: 403 });

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const partyIds = validatePartyIds(body.partyIds);

    if (!name) return NextResponse.json({ error: "Raid name is required." }, { status: 400 });
    if (!partyIds) return NextResponse.json({ error: "partyIds must be an array." }, { status: 400 });

    const parties = await prisma.rosterParty.findMany({
      where: { id: { in: partyIds }, roster: { eventId } },
      select: { id: true, raids: { select: { raidId: true } } },
    });

    if (parties.length !== partyIds.length) return NextResponse.json({ error: "One or more selected parties do not belong to this event." }, { status: 400 });
    if (parties.some((party) => party.raids.length > 0)) return NextResponse.json({ error: "A selected party is already assigned to a raid." }, { status: 409 });

    const raid = await prisma.raid.create({
      data: {
        name,
        parties: { create: partyIds.map((partyId) => ({ partyId })) },
      },
      include: { parties: true },
    });

    return NextResponse.json({ raid: { id: raid.id, name: raid.name, partyIds: raid.parties.map((entry) => entry.partyId) } }, { status: 201 });
  } catch (error) {
    console.error("[RAIDS POST]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create raid." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { eventId } = await context.params;
    const { auth, event } = await getEvent(eventId);

    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (!hasPermission(auth.role, "rosters.edit")) return NextResponse.json({ error: "You do not have permission to manage raids." }, { status: 403 });

    const body = await request.json();
    const raidId = typeof body.raidId === "string" ? body.raidId : "";
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const partyIds = body.partyIds === undefined ? undefined : validatePartyIds(body.partyIds);

    if (!raidId) return NextResponse.json({ error: "raidId is required." }, { status: 400 });
    if (name !== undefined && !name) return NextResponse.json({ error: "Raid name cannot be empty." }, { status: 400 });
    if (body.partyIds !== undefined && !partyIds) return NextResponse.json({ error: "partyIds must be an array." }, { status: 400 });

    const raid = await prisma.raid.findFirst({
      where: { id: raidId, parties: { some: { party: { roster: { eventId } } } } },
      select: { id: true },
    });
    if (!raid) return NextResponse.json({ error: "Raid not found." }, { status: 404 });

    if (partyIds !== undefined) {
      const parties = await prisma.rosterParty.findMany({
        where: { id: { in: partyIds }, roster: { eventId } },
        select: { id: true, raids: { select: { raidId: true } } },
      });
      if (parties.length !== partyIds.length) return NextResponse.json({ error: "One or more selected parties do not belong to this event." }, { status: 400 });
      if (parties.some((party) => party.raids.some((entry) => entry.raidId !== raidId))) return NextResponse.json({ error: "A selected party is already assigned to another raid." }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (partyIds !== undefined) {
        await tx.raidParty.deleteMany({ where: { raidId } });
        if (partyIds.length) await tx.raidParty.createMany({ data: partyIds.map((partyId) => ({ raidId, partyId })) });
      }
      return tx.raid.update({ where: { id: raidId }, data: name === undefined ? {} : { name }, include: { parties: true } });
    });

    return NextResponse.json({ raid: { id: updated.id, name: updated.name, partyIds: updated.parties.map((entry) => entry.partyId) } });
  } catch (error) {
    console.error("[RAIDS PATCH]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update raid." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { eventId } = await context.params;
    const { auth, event } = await getEvent(eventId);

    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (!hasPermission(auth.role, "rosters.edit")) return NextResponse.json({ error: "You do not have permission to manage raids." }, { status: 403 });

    const body = await request.json();
    const raidId = typeof body.raidId === "string" ? body.raidId : "";
    if (!raidId) return NextResponse.json({ error: "raidId is required." }, { status: 400 });

    const raid = await prisma.raid.findFirst({ where: { id: raidId, parties: { some: { party: { roster: { eventId } } } } }, select: { id: true } });
    if (!raid) return NextResponse.json({ error: "Raid not found." }, { status: 404 });

    await prisma.raid.delete({ where: { id: raidId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[RAIDS DELETE]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete raid." }, { status: 500 });
  }
}
