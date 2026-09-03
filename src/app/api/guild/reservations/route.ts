import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type ReservationRequest = { id?: string; memberId?: string; resourceId?: string; quantity?: number };
function validateQuantity(quantity: unknown) { if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) return "Quantity must be a positive integer."; return null; }

export async function GET() {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!hasPermission(auth.role, "allocation.view")) return NextResponse.json({ error: "You do not have permission to view reservations." }, { status: 403 });
    const guild = await prisma.guild.findUnique({ where: { id: auth.guild.id }, include: { members: { where: { active: true }, orderBy: { characterName: "asc" }, select: { id: true, characterName: true, eligible: true } }, resources: { where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true, total: true, hardCap: true, perPlayerLimit: true } }, reservedAllocations: { include: { member: { select: { characterName: true } }, resource: { select: { name: true, type: true, total: true } } }, orderBy: { member: { characterName: "asc" } } } } });
    if (!guild) return NextResponse.json({ error: "Guild not found." }, { status: 404 });
    return NextResponse.json({ members: guild.members, resources: guild.resources, reservations: guild.reservedAllocations.map((r) => ({ id: r.id, memberId: r.memberId, resourceId: r.resourceId, quantity: r.quantity, memberName: r.member.characterName, resourceName: r.resource.name, resourceType: r.resource.type, resourceTotal: r.resource.total })) });
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

export async function POST(request: Request) {
  try { const auth = await getCurrentAuth(); if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 }); if (!hasPermission(auth.role, "allocation.run")) return NextResponse.json({ error: "You do not have permission to manage reservations." }, { status: 403 }); const body = await request.json() as ReservationRequest; const data = await getReservationData(auth.guild.id, body); if ("error" in data) return NextResponse.json(data, { status: 400 }); const existing = await prisma.reservedAllocation.findUnique({ where: { guildId_memberId_resourceId: { guildId: auth.guild.id, memberId: data.member.id, resourceId: data.resource.id } } }); if (existing) return NextResponse.json({ error: "A reservation already exists for this member and resource. Edit the existing reservation instead." }, { status: 409 }); const reservation = await prisma.reservedAllocation.create({ data: { guildId: auth.guild.id, memberId: data.member.id, resourceId: data.resource.id, quantity: data.quantity }, include: { member: true, resource: true } }); return NextResponse.json({ reservation: { id: reservation.id, memberId: reservation.memberId, resourceId: reservation.resourceId, quantity: reservation.quantity, memberName: reservation.member.characterName, resourceName: reservation.resource.name, resourceType: reservation.resource.type, resourceTotal: reservation.resource.total } }); } catch (error) { console.error("[RESERVATIONS] Failed to create reservation:", error); return NextResponse.json({ error: "Failed to create reservation." }, { status: 500 }); }
}

export async function PUT(request: Request) {
  try { const auth = await getCurrentAuth(); if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 }); if (!hasPermission(auth.role, "allocation.run")) return NextResponse.json({ error: "You do not have permission to manage reservations." }, { status: 403 }); const body = await request.json() as ReservationRequest; if (!body.id) return NextResponse.json({ error: "Reservation ID is required." }, { status: 400 }); const existing = await prisma.reservedAllocation.findFirst({ where: { id: body.id, guildId: auth.guild.id } }); if (!existing) return NextResponse.json({ error: "Reservation not found." }, { status: 404 }); const data = await getReservationData(auth.guild.id, body); if ("error" in data) return NextResponse.json(data, { status: 400 }); const duplicate = await prisma.reservedAllocation.findFirst({ where: { guildId: auth.guild.id, memberId: data.member.id, resourceId: data.resource.id, NOT: { id: body.id } } }); if (duplicate) return NextResponse.json({ error: "A reservation already exists for this member and resource." }, { status: 409 }); const reservation = await prisma.reservedAllocation.update({ where: { id: body.id }, data: { memberId: data.member.id, resourceId: data.resource.id, quantity: data.quantity }, include: { member: true, resource: true } }); return NextResponse.json({ reservation: { id: reservation.id, memberId: reservation.memberId, resourceId: reservation.resourceId, quantity: reservation.quantity, memberName: reservation.member.characterName, resourceName: reservation.resource.name, resourceType: reservation.resource.type, resourceTotal: reservation.resource.total } }); } catch (error) { console.error("[RESERVATIONS] Failed to update reservation:", error); return NextResponse.json({ error: "Failed to update reservation." }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try { const auth = await getCurrentAuth(); if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 }); if (!hasPermission(auth.role, "allocation.run")) return NextResponse.json({ error: "You do not have permission to manage reservations." }, { status: 403 }); const id = new URL(request.url).searchParams.get("id"); if (!id) return NextResponse.json({ error: "Reservation ID is required." }, { status: 400 }); const existing = await prisma.reservedAllocation.findFirst({ where: { id, guildId: auth.guild.id } }); if (!existing) return NextResponse.json({ error: "Reservation not found." }, { status: 404 }); await prisma.reservedAllocation.delete({ where: { id } }); return NextResponse.json({ success: true }); } catch (error) { console.error("[RESERVATIONS] Failed to delete reservation:", error); return NextResponse.json({ error: "Failed to delete reservation." }, { status: 500 }); }
}
