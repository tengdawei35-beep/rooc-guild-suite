import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { hasGuildModule, RESOURCE_SUITE_MODULE } from "@/lib/auth/modules";

type IndexMap = Record<string, number>;

type AuditResource = {
  resourceId: string;
  resourceName: string;
  currentIndex: number;
  currentNextMember: string | null;
  reconstructedIndex: number | null;
  reconstructedNextMember: string | null;
  indexMismatch: boolean;
  runsAudited: number;
  skippedMembers: { memberId: string; memberName: string | null; runId: string; eventDate: string | null }[];
  latestRun: { id: string; createdAt: string; eventDate: string | null; rotationIndexBefore: number | null; rotationIndexAfter: number | null } | null;
};

// a1d1220 is the commit that completed the rotation-pool fix. Runs before
// that commit are the historical runs that this audit is intended to inspect.
const OLD_IMPLEMENTATION_CUTOFF = new Date("2026-09-08T14:18:07.000Z");

function asIndexMap(value: unknown): IndexMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: IndexMap = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "number" && Number.isInteger(raw)) result[key] = raw;
  }
  return result;
}

function rotate<T>(items: T[], index: number) {
  if (!items.length) return [];
  const normalized = ((index % items.length) + items.length) % items.length;
  return [...items.slice(normalized), ...items.slice(0, normalized)];
}

export async function GET() {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!(await hasGuildModule(auth.guild.id, RESOURCE_SUITE_MODULE))) return NextResponse.json({ error: "The Resource Suite is not subscribed for this guild." }, { status: 403 });
    if (!hasPermission(auth.role, "allocation.run")) return NextResponse.json({ error: "You do not have permission to audit allocations." }, { status: 403 });

    const guild = await prisma.guild.findUnique({
      where: { id: auth.guild.id },
      include: {
        members: {
          where: { active: true, eligible: true },
          orderBy: { characterName: "asc" },
          select: { id: true, characterName: true },
        },
        resources: { where: { active: true }, orderBy: { name: "asc" }, include: { rotationStates: true } },
        allocationRuns: {
          where: { status: "COMPLETED", createdAt: { lt: OLD_IMPLEMENTATION_CUTOFF } },
          orderBy: { createdAt: "asc" },
          include: {
            event: { select: { date: true } },
            allocationResults: {
              select: { memberId: true, resourceId: true, reservedQuantity: true, assignedQuantity: true },
            },
          },
        },
      },
    });
    if (!guild) return NextResponse.json({ error: "Guild not found." }, { status: 404 });

    // Historical runs stored rotation indexes against the legacy pool, which
    // excluded reserved members. The current member list is used as the
    // reconstruction pool; the audit intentionally remains read-only.
    const fullPool = guild.members;
    const audit: AuditResource[] = [];

    for (const resource of guild.resources) {
      const state = resource.rotationStates.find((item) => item.guildId === guild.id);
      const currentRaw = state?.rotationIndex ?? 0;
      const currentIndex = fullPool.length ? ((currentRaw % fullPool.length) + fullPool.length) % fullPool.length : 0;
      let reconstructedIndex: number | null = null;
      let lastRun: AuditResource["latestRun"] = null;
      let runsAudited = 0;
      const skippedMembers: AuditResource["skippedMembers"] = [];

      for (const run of guild.allocationRuns) {
        const results = run.allocationResults.filter((result) => result.resourceId === resource.id);
        if (!results.length) continue;
        runsAudited += 1;

        const beforeMap = asIndexMap(run.rotationIndexBefore);
        const afterMap = asIndexMap(run.rotationIndexAfter);
        const oldBefore = beforeMap[resource.id];
        const oldAfter = afterMap[resource.id];
        lastRun = {
          id: run.id,
          createdAt: run.createdAt.toISOString(),
          eventDate: run.event?.date.toISOString() ?? null,
          rotationIndexBefore: typeof oldBefore === "number" ? oldBefore : null,
          rotationIndexAfter: typeof oldAfter === "number" ? oldAfter : null,
        };

        if (!fullPool.length || typeof oldBefore !== "number") continue;

        // Reserved status must be determined for this resource only. A member
        // reserved for another resource was still part of this resource's
        // legacy rotation pool.
        const reservedMemberIds = new Set(
          results.filter((result) => result.reservedQuantity > 0).map((result) => result.memberId),
        );
        const oldPool = fullPool.filter((member) => !reservedMemberIds.has(member.id));
        if (!oldPool.length) continue;

        const normalizedOldBefore = ((oldBefore % oldPool.length) + oldPool.length) % oldPool.length;
        const oldRotated = rotate(oldPool, normalizedOldBefore);
        const normalSelectedIds = new Set(
          results.filter((result) => result.reservedQuantity === 0 && result.assignedQuantity > 0).map((result) => result.memberId),
        );
        if (!normalSelectedIds.size) continue;

        // AllocationResult rows do not encode selection order. The legacy
        // rotated pool gives us the exact order in which normal turns occurred.
        let lastSelectedId: string | null = null;
        for (const member of oldRotated) {
          if (normalSelectedIds.has(member.id)) lastSelectedId = member.id;
        }
        if (!lastSelectedId) continue;

        const oldStartMember = oldRotated[0];
        const fullStartPosition = fullPool.findIndex((member) => member.id === oldStartMember.id);
        if (fullStartPosition < 0) continue;
        const fullRotated = rotate(fullPool, fullStartPosition);
        const lastSelectedFullPosition = fullRotated.findIndex((member) => member.id === lastSelectedId);
        if (lastSelectedFullPosition < 0) continue;

        // Every reserved member encountered before a normal selection was a
        // skipped turn under the legacy implementation. This includes reserved
        // members between normal selections, not just those before the first.
        for (let position = 0; position <= lastSelectedFullPosition; position++) {
          const member = fullRotated[position];
          if (reservedMemberIds.has(member.id)) {
            skippedMembers.push({
              memberId: member.id,
              memberName: member.characterName,
              runId: run.id,
              eventDate: run.event?.date.toISOString() ?? null,
            });
          }
        }

        // The fixed implementation rotates across the complete eligible pool.
        // Therefore the next turn is the immediate next member in the full
        // pool, including a reserved member if that member was skipped before.
        reconstructedIndex = (fullPool.findIndex((member) => member.id === lastSelectedId) + 1) % fullPool.length;
      }

      const reconstructedNext = reconstructedIndex !== null && fullPool.length ? fullPool[reconstructedIndex] : null;
      const currentNext = fullPool.length ? fullPool[currentIndex] : null;
      audit.push({
        resourceId: resource.id,
        resourceName: resource.name,
        currentIndex: currentRaw,
        currentNextMember: currentNext?.characterName ?? null,
        reconstructedIndex,
        reconstructedNextMember: reconstructedNext?.characterName ?? null,
        indexMismatch: reconstructedIndex !== null && currentIndex !== reconstructedIndex,
        runsAudited,
        skippedMembers,
        latestRun: lastRun,
      });
    }

    return NextResponse.json({
      guild: { id: guild.id, name: guild.name },
      generatedAt: new Date().toISOString(),
      auditCutoff: OLD_IMPLEMENTATION_CUTOFF.toISOString(),
      eligibleMemberCount: fullPool.length,
      eligibleMembers: fullPool.map((member) => ({ id: member.id, characterName: member.characterName })),
      resources: audit,
      summary: {
        resourcesWithMismatch: audit.filter((item) => item.indexMismatch).length,
        skippedTurnCount: new Set(audit.flatMap((item) => item.skippedMembers.map((member) => `${member.runId}:${member.memberId}`))).size,
      },
    });
  } catch (error) {
    console.error("[ALLOCATION AUDIT] Failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to audit allocation rotation." }, { status: 500 });
  }
}
