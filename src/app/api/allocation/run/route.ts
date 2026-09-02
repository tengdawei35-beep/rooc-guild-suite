import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyBidComplete } from "@/lib/discord-notifications";
import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { buildAllocation, applyAllocationOverrides, type AllocationOverride } from "@/lib/allocation/engine";
import { hasGuildModule, RESOURCE_SUITE_MODULE } from "@/lib/auth/modules";

type RunRequest = { eventId?: string; nonReservedMemberCount?: number; overrides?: AllocationOverride[] };
type BidSlotData = { memberId: string; resourceId: string };
const SLOTS_PER_PAGE = 4;

export async function POST(request: Request) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!(await hasGuildModule(auth.guild.id, RESOURCE_SUITE_MODULE))) return NextResponse.json({ error: "The Resource Suite is not subscribed for this guild." }, { status: 403 });
    if (!hasPermission(auth.role, "allocation.run")) return NextResponse.json({ error: "You do not have permission to run an allocation." }, { status: 403 });

    const body = (await request.json()) as RunRequest;
    const eventId = body.eventId;
    const nonReservedMemberCount = body.nonReservedMemberCount;
    if (typeof eventId !== "string" || !eventId.trim()) return NextResponse.json({ error: "An event must be selected before running an allocation." }, { status: 400 });
    if (typeof nonReservedMemberCount !== "number" || !Number.isInteger(nonReservedMemberCount) || nonReservedMemberCount < 0) return NextResponse.json({ error: "Number of non-reserved members must be a non-negative integer." }, { status: 400 });
    if (body.overrides !== undefined && !Array.isArray(body.overrides)) return NextResponse.json({ error: "Invalid allocation edits." }, { status: 400 });

    const event = await prisma.event.findFirst({ where: { id: eventId, guildId: auth.guild.id }, select: { id: true, guildId: true, type: true, date: true } });
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

    let preview = await buildAllocation({ guildId: auth.guild.id, nonReservedMemberCount, eventDate: event.date });
    if (body.overrides !== undefined) preview = applyAllocationOverrides(preview, body.overrides);
    if (preview.guildId !== auth.guild.id || preview.guildId !== event.guildId) return NextResponse.json({ error: "Allocation does not belong to the configured guild." }, { status: 403 });

    const eventDateStart = new Date(event.date);
    const eventDateEnd = new Date(eventDateStart.getTime() + 24 * 60 * 60 * 1000);
    const bidSlotsByType: Record<"FEATHER" | "CARD", BidSlotData[]> = { FEATHER: [], CARD: [] };
    for (const resource of preview.resources) for (const assignment of resource.assignments) {
      const quantity = assignment.reservedQuantity + assignment.assignedQuantity;
      for (let i = 0; i < quantity; i++) bidSlotsByType[resource.type].push({ memberId: assignment.memberId, resourceId: assignment.resourceId });
    }

    const result = await prisma.$transaction(async (tx) => {
      const allocationLockKey = `${auth.guild.id}:${event.id}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${allocationLockKey}, 0))`;

      const existingRun = await tx.allocationRun.findFirst({ where: { guildId: auth.guild.id, eventId: event.id }, select: { id: true, status: true } });
      if (existingRun) return { conflict: true as const, runId: existingRun.id, status: existingRun.status };

      const guild = await tx.guild.findUnique({ where: { id: auth.guild.id }, include: { resources: { where: { active: true }, include: { rotationStates: true } } } });
      if (!guild) throw new Error("Guild no longer exists.");

      const rotationBefore: Record<string, number> = {};
      const rotationAfter: Record<string, number> = {};
      const eligibleIds = preview.eligibleMembers.map((m) => m.id);

      for (const resource of guild.resources) {
        const currentIndexRaw = resource.rotationStates[0]?.rotationIndex ?? 0;
        const count = eligibleIds.length;
        const currentIndex = count > 0 ? ((currentIndexRaw % count) + count) % count : 0;
        rotationBefore[resource.id] = currentIndexRaw;
        const resourceResult = preview.resources.find((r) => r.resourceId === resource.id);
        const selectedIds = new Set(resourceResult?.selectedMembers.map((m) => m.id) ?? []);
        let nextIndex = currentIndex;
        if (count > 0) {
          const rotated = [...eligibleIds.slice(currentIndex), ...eligibleIds.slice(0, currentIndex)];
          const nextMember = rotated.find((id) => !selectedIds.has(id));
          if (nextMember) nextIndex = eligibleIds.indexOf(nextMember);
        }
        rotationAfter[resource.id] = nextIndex;
      }

      const run = await tx.allocationRun.create({ data: { guildId: auth.guild.id, eventId: event.id, status: "RUNNING", rotationIndexBefore: rotationBefore } });

      for (const resource of preview.resources) await tx.resourceResult.create({ data: { allocationRunId: run.id, resourceId: resource.resourceId, total: resource.total, reserved: resource.reserved, allocated: resource.allocated, overflow: resource.overflow } });

      for (const resource of preview.resources) for (const assignment of resource.assignments) {
        if (assignment.reservedQuantity === 0 && assignment.assignedQuantity === 0) continue;
        await tx.allocationResult.create({ data: { allocationRunId: run.id, memberId: assignment.memberId, resourceId: assignment.resourceId, reservedQuantity: assignment.reservedQuantity, assignedQuantity: assignment.assignedQuantity } });
      }

      for (const type of ["FEATHER", "CARD"] as const) {
        const slots = bidSlotsByType[type];
        const pageCount = Math.ceil(slots.length / SLOTS_PER_PAGE);
        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
          const pageSlots = slots.slice((pageNumber - 1) * SLOTS_PER_PAGE, pageNumber * SLOTS_PER_PAGE);
          const bidPage = await tx.bidPage.create({ data: { allocationRunId: run.id, type, pageNumber } });
          for (let index = 0; index < pageSlots.length; index++) await tx.bidSlot.create({ data: { bidPageId: bidPage.id, slotNumber: index + 1, resourceId: pageSlots[index].resourceId, memberId: pageSlots[index].memberId } });
        }
      }

      for (const resource of guild.resources) {
        const rotationIndex = rotationAfter[resource.id] ?? 0;
        await tx.rotationState.upsert({ where: { guildId_resourceId: { guildId: auth.guild.id, resourceId: resource.id } }, create: { guildId: auth.guild.id, resourceId: resource.id, rotationIndex }, update: { rotationIndex } });
      }

      const completedRun = await tx.allocationRun.update({ where: { id: run.id }, data: { status: "COMPLETED", rotationIndexAfter: rotationAfter, completedAt: new Date() } });
      return { conflict: false as const, allocationRun: completedRun, rotationBefore, rotationAfter };
    });

    if (result.conflict) return NextResponse.json({ error: "An allocation has already been run for this event.", allocationRun: { id: result.runId, status: result.status, eventId: event.id } }, { status: 409 });
    await notifyBidComplete({ guildId: auth.guild.id, allocationRunId: result.allocationRun.id });

    return NextResponse.json({
      success: true,
      allocationRun: { id: result.allocationRun.id, status: result.allocationRun.status, createdAt: result.allocationRun.createdAt, completedAt: result.allocationRun.completedAt, eventId: event.id },
      event: { id: event.id, type: event.type, date: event.date },
      rotation: { before: result.rotationBefore, after: result.rotationAfter },
      bidPages: { feathers: Math.ceil(bidSlotsByType.FEATHER.length / SLOTS_PER_PAGE), cards: Math.ceil(bidSlotsByType.CARD.length / SLOTS_PER_PAGE), totalSlots: bidSlotsByType.FEATHER.length + bidSlotsByType.CARD.length },
      preview,
    });
  } catch (error) {
    console.error("[ALLOCATION] Failed to run allocation:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to run allocation." }, { status: 500 });
  }
}
