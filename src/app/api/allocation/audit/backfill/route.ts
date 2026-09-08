import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { hasGuildModule, RESOURCE_SUITE_MODULE } from "@/lib/auth/modules";

const OLD_IMPLEMENTATION_CUTOFF = new Date("2026-09-08T14:18:07.000Z");
const BACKFILL_MARKER = "ROTATION_BACKFILL";

type IndexMap = Record<string, number>;
function asIndexMap(value: unknown): IndexMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: IndexMap = {};
  for (const [key, raw] of Object.entries(value)) if (typeof raw === "number" && Number.isInteger(raw)) result[key] = raw;
  return result;
}
function rotate<T>(items: T[], index: number) {
  if (!items.length) return [];
  const normalized = ((index % items.length) + items.length) % items.length;
  return [...items.slice(normalized), ...items.slice(0, normalized)];
}
function normalizeIndex(index: number, count: number) { return count ? ((index % count) + count) % count : 0; }

export async function POST(request: Request) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!(await hasGuildModule(auth.guild.id, RESOURCE_SUITE_MODULE))) return NextResponse.json({ error: "The Resource Suite is not subscribed for this guild." }, { status: 403 });
    if (!hasPermission(auth.role, "allocation.run")) return NextResponse.json({ error: "You do not have permission to apply allocation backfills." }, { status: 403 });

    const body = (await request.json().catch(() => ({}))) as { apply?: boolean };
    const apply = body.apply === true;

    const guild = await prisma.guild.findUnique({
      where: { id: auth.guild.id },
      include: {
        members: { where: { active: true, eligible: true }, orderBy: { characterName: "asc" }, select: { id: true, characterName: true } },
        resources: { where: { active: true }, orderBy: { name: "asc" }, include: { rotationStates: true } },
        allocationRuns: {
          where: { status: "COMPLETED", createdAt: { lt: OLD_IMPLEMENTATION_CUTOFF } },
          orderBy: { createdAt: "asc" },
          include: {
            event: { select: { id: true, date: true } },
            allocationResults: { select: { memberId: true, resourceId: true, reservedQuantity: true, assignedQuantity: true } },
            resourceResults: { select: { resourceId: true, total: true, reserved: true, allocated: true, overflow: true } },
          },
        },
      },
    });
    if (!guild) return NextResponse.json({ error: "Guild not found." }, { status: 404 });

    const fullPool = guild.members;
    const plans: { sourceRunId: string; eventId: string; eventDate: string; resourceId: string; resourceName: string; quantity: number; members: { id: string; name: string | null }[] }[] = [];

    for (const run of guild.allocationRuns) {
      if (!run.event) continue;
      const existingBackfill = await prisma.allocationRun.findFirst({ where: { guildId: guild.id, eventId: run.event.id, status: "COMPLETED", errorMessage: BACKFILL_MARKER }, select: { id: true } });
      if (existingBackfill) continue;

      for (const resource of guild.resources) {
        const results = run.allocationResults.filter((r) => r.resourceId === resource.id);
        if (!results.length) continue;
        const before = asIndexMap(run.rotationIndexBefore)[resource.id];
        if (typeof before !== "number") continue;
        const reservedIds = new Set(results.filter((r) => r.reservedQuantity > 0).map((r) => r.memberId));
        const oldPool = fullPool.filter((m) => !reservedIds.has(m.id));
        const selectedIds = new Set(results.filter((r) => r.reservedQuantity === 0 && r.assignedQuantity > 0).map((r) => r.memberId));
        if (!oldPool.length || !selectedIds.size) continue;
        const oldRotated = rotate(oldPool, normalizeIndex(before, oldPool.length));
        let lastSelectedId: string | null = null;
        for (const member of oldRotated) if (selectedIds.has(member.id)) lastSelectedId = member.id;
        if (!lastSelectedId) continue;
        const fullStart = fullPool.findIndex((m) => m.id === oldRotated[0]?.id);
        if (fullStart < 0) continue;
        const fullRotated = rotate(fullPool, fullStart);
        const lastPosition = fullRotated.findIndex((m) => m.id === lastSelectedId);
        if (lastPosition < 0) continue;
        const skipped = fullRotated.slice(0, lastPosition + 1).filter((m) => reservedIds.has(m.id));
        if (!skipped.length) continue;

        const sourceNormal = results.filter((r) => r.reservedQuantity === 0 && r.assignedQuantity > 0).map((r) => r.assignedQuantity);
        const quantity = Math.min(resource.perPlayerLimit, sourceNormal.length ? Math.max(...sourceNormal) : resource.perPlayerLimit);
        if (quantity <= 0) continue;
        plans.push({ sourceRunId: run.id, eventId: run.event.id, eventDate: run.event.date.toISOString(), resourceId: resource.id, resourceName: resource.name, quantity, members: skipped.map((m) => ({ id: m.id, name: m.characterName })) });
      }
    }

    if (!apply) return NextResponse.json({ preview: true, plans, totalAllocations: plans.reduce((sum, p) => sum + p.members.length, 0) });

    const createdRuns: { sourceRunId: string; backfillRunId: string; allocations: number }[] = [];
    for (const sourceRunId of [...new Set(plans.map((p) => p.sourceRunId))]) {
      const sourcePlans = plans.filter((p) => p.sourceRunId === sourceRunId);
      const eventId = sourcePlans[0].eventId;
      const existing = await prisma.allocationRun.findFirst({ where: { guildId: guild.id, eventId, status: "COMPLETED", errorMessage: BACKFILL_MARKER }, select: { id: true } });
      if (existing) continue;
      await prisma.$transaction(async (tx) => {
        const backfill = await tx.allocationRun.create({ data: { guildId: guild.id, eventId, status: "COMPLETED", rotationIndexBefore: Prisma.JsonNull, rotationIndexAfter: Prisma.JsonNull, errorMessage: BACKFILL_MARKER, completedAt: new Date() } });
        let allocationCount = 0;
        for (const plan of sourcePlans) {
          const sourceResult = await tx.resourceResult.findUnique({ where: { allocationRunId_resourceId: { allocationRunId: sourceRunId, resourceId: plan.resourceId } } });
          if (!sourceResult) continue;
          for (const member of plan.members) {
            await tx.allocationResult.create({ data: { allocationRunId: backfill.id, memberId: member.id, resourceId: plan.resourceId, reservedQuantity: 0, assignedQuantity: plan.quantity } });
            allocationCount += 1;
          }
          await tx.resourceResult.create({ data: { allocationRunId: backfill.id, resourceId: plan.resourceId, total: sourceResult.total, reserved: 0, allocated: plan.quantity * plan.members.length, overflow: 0 } });
        }
        createdRuns.push({ sourceRunId, backfillRunId: backfill.id, allocations: allocationCount });
      });
    }

    return NextResponse.json({ success: true, createdRuns, totalAllocations: createdRuns.reduce((sum, r) => sum + r.allocations, 0) });
  } catch (error) {
    console.error("[ALLOCATION BACKFILL] Failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to apply allocation backfill." }, { status: 500 });
  }
}
