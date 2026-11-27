import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { isRoocGuild } from "@/lib/auth/modules";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type ReservationRequest = { id?: string; memberId?: string; resourceId?: string; quantity?: number };
function validateQuantity(quantity: unknown) { if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) return "Quantity must be a positive integer."; return null; }

function roocOnlyError() {
  return NextResponse.json(
    { error: "The legacy resource allocation system is currently available to ROOC guilds only." },
    { status: 409 }
  );
}

async function requireRoocGuild(guildId: string) {
  return (await isRoocGuild(guildId)) ? null : roocOnlyError();
}

export async function GET() {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const gameGuard = await requireRoocGuild(auth.guild.id);
    if (gameGuard) return gameGuard;
    if (!hasPermission(auth.originalRole, "allocation.view")) return NextResponse.json({ error: "You do not have permission to view reservations." }, { status: 403 });
    const guild = await prisma.guild.findUnique({ where: { id: auth.guild.id }, include: { members: { where: { active: true }, orderBy: { characterName: "asc" }, select: { id: true, characterName: true, eligible: true } }, resources: { where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true, total: true, hardCap: true, perPlayerLimit: true } }, reservedAllocations: { include: { member: { select: { characterName: true } }, resource: { select: { name: true, type: true, total: true } } }, orderBy: { member: { characterName: "asc" } } } } });
    if (!guild) return NextResponse.json({ error: "Guild not found." }, { status: 404 });
    return NextResponse.json({ canEdit: hasPermission(auth.role, "allocation.run"), members: guild.members, resources: guild.resources, reservations: guild.reservedAllocations.map((r) => ({ id: r.id, memberId: r.memberId, resourceId: r.resourceId, quantity: r.quantity, memberName: r.member.characterName, resourceName: r.resource.name, resourceType: r.resource.type, resourceTotal: r.resource.total })) });
  } catch (error) { console.error("[RESERVATIONS] Failed to load reservations:", error); return NextResponse.json({ error: "Failed to load reservations." }, { status: 500 }); }
}

async function getReservationData(guildId: string, body: ReservationRequest) {
  if (!body.memberId) return { error: "Member is required." };
  if (!body.resourceId) return { error: "Resource is required." };
  const quantityError = validateQuantity(body.quantity);
  if (quantityError) return { error: quantityError };
  const member = await prisma.guildMember.findFirst({ where: { id: body.memberId, guildId } });
  if (!member) return { error: "Member not found." };
  const resource = await prisma.resource.findFirst({ where: { id: body.resourceId, guildId } });
  if (!resource) return { error: "Resource not found." };
  if (!resource.active) return { error: "This resource is inactive." };
  if (body.quantity! > resource.hardCap) return { error: `Reservation cannot exceed the hardCap of ${resource.hardCap} for this resource.` };
  if (body.quantity! > resource.total) return { error: "Reservation cannot exceed the resource total." };
  return { member, resource, quantity: body.quantity! };
}


async function saveReservation(guildId: string, body: ReservationRequest, reservationId?: string) {
  const data = await getReservationData(guildId, body);
  if ("error" in data) return { error: data.error, status: 400 as const };

  return prisma.$transaction(async (tx) => {
    // Coordinate reservation changes with allocation runs and rotation resets.
    const lockKey = `guild-allocation:${guildId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

    const existing = reservationId
      ? await tx.reservedAllocation.findFirst({ where: { id: reservationId, guildId } })
      : null;
    if (reservationId && !existing) return { error: "Reservation not found.", status: 404 as const };

    const duplicate = await tx.reservedAllocation.findFirst({
      where: {
        guildId,
        memberId: data.member.id,
        resourceId: data.resource.id,
        ...(reservationId ? { NOT: { id: reservationId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) return { error: "A reservation already exists for this member and resource. Edit the existing reservation instead.", status: 409 as const };

    const totals = await tx.reservedAllocation.aggregate({
      where: {
        guildId,
        resourceId: data.resource.id,
        ...(reservationId ? { NOT: { id: reservationId } } : {}),
      },
      _sum: { quantity: true },
    });
    const alreadyReserved = totals._sum.quantity ?? 0;
    if (alreadyReserved + data.quantity > data.resource.total) {
      return {
        error: `This reservation would exceed available stock. ${alreadyReserved} of ${data.resource.total} ${data.resource.name} are already reserved.`,
        status: 409 as const,
      };
    }

    const reservation = reservationId
      ? await tx.reservedAllocation.update({
          where: { id: reservationId },
          data: { memberId: data.member.id, resourceId: data.resource.id, quantity: data.quantity },
          include: { member: true, resource: true },
        })
      : await tx.reservedAllocation.create({
          data: { guildId, memberId: data.member.id, resourceId: data.resource.id, quantity: data.quantity },
          include: { member: true, resource: true },
        });

    return {
      reservation: {
        id: reservation.id,
        memberId: reservation.memberId,
        resourceId: reservation.resourceId,
        quantity: reservation.quantity,
        memberName: reservation.member.characterName,
        resourceName: reservation.resource.name,
        resourceType: reservation.resource.type,
        resourceTotal: reservation.resource.total,
      },
    };
  }, { isolationLevel: "Serializable" });
}

function transactionConflict(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && String(error.code) === "P2034");
}

export async function POST(request: Request) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const gameGuard = await requireRoocGuild(auth.guild.id);
    if (gameGuard) return gameGuard;
    if (!hasPermission(auth.role, "allocation.run")) return NextResponse.json({ error: "You do not have permission to manage reservations." }, { status: 403 });

    const body = await request.json() as ReservationRequest;
    const result = await saveReservation(auth.guild.id, body);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ reservation: result.reservation });
  } catch (error) {
    if (transactionConflict(error)) return NextResponse.json({ error: "Reservation capacity changed while this request was being processed. Refresh and try again." }, { status: 409 });
    console.error("[RESERVATIONS] Failed to create reservation:", error);
    return NextResponse.json({ error: "Failed to create reservation." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const gameGuard = await requireRoocGuild(auth.guild.id);
    if (gameGuard) return gameGuard;
    if (!hasPermission(auth.role, "allocation.run")) return NextResponse.json({ error: "You do not have permission to manage reservations." }, { status: 403 });

    const body = await request.json() as ReservationRequest;
    if (!body.id) return NextResponse.json({ error: "Reservation ID is required." }, { status: 400 });
    const result = await saveReservation(auth.guild.id, body, body.id);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ reservation: result.reservation });
  } catch (error) {
    if (transactionConflict(error)) return NextResponse.json({ error: "Reservation capacity changed while this request was being processed. Refresh and try again." }, { status: 409 });
    console.error("[RESERVATIONS] Failed to update reservation:", error);
    return NextResponse.json({ error: "Failed to update reservation." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const gameGuard = await requireRoocGuild(auth.guild.id);
    if (gameGuard) return gameGuard;
    if (!hasPermission(auth.role, "allocation.run")) return NextResponse.json({ error: "You do not have permission to manage reservations." }, { status: 403 });

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Reservation ID is required." }, { status: 400 });
    const deleted = await prisma.$transaction(async (tx) => {
      const lockKey = `guild-allocation:${auth.guild.id}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const existing = await tx.reservedAllocation.findFirst({ where: { id, guildId: auth.guild.id }, select: { id: true } });
      if (!existing) return false;
      await tx.reservedAllocation.delete({ where: { id: existing.id } });
      return true;
    });
    if (!deleted) return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[RESERVATIONS] Failed to delete reservation:", error);
    return NextResponse.json({ error: "Failed to delete reservation." }, { status: 500 });
  }
}
