import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { hasGuildModule, RESOURCE_SUITE_MODULE } from "@/lib/auth/modules";

type IndexMap = Record<string, number>;

type HistoricalRun = {
  runId: string;
  createdAt: string;
  eventDate: string | null;
  legacyIndexBefore: number | null;
  legacyIndexAfter: number | null;
  legacyStartMember: string | null;
  normalSelectedMembers: string[];
  skippedMembers: string[];
  correctedNextIndex: number | null;
  correctedNextMember: string | null;
};

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
  historicalRuns: HistoricalRun[];
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

function normalizeIndex(index: number, count: number) {
  return count ? ((index % count) + count) % count : 0;
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
      const currentIndex = normalizeIndex(currentRaw, fullPool.length);
      let reconstructedIndex: number | null = null;
      let lastRun: AuditResource["latestRun"] = null;
      let runsAudited = 0;
      const skippedMembers: AuditResource["skippedMembers"] = [];
      const historicalRuns: HistoricalRun[] = [];

      for (const run of guild.allocationRuns) {
        const results = run.allocationResults.filter((result) => result.resourceId === resource.id);
        if (!results.length) continue;
        runsAudited += 1;

        const beforeMap = asIndexMap(run.rotationIndexBefore);
        const afterMap = asIndexMap(run.rotationIndexAfter);
        const legacyIndexBefore = beforeMap[resource.id];
        const legacyIndexAfter = afterMap[resource.id];
        lastRun = {
          id: run.id,
          createdAt: run.createdAt.toISOString(),
          eventDate: run.event?.date.toISOString() ?? null,
          rotationIndexBefore: typeof legacyIndexBefore === "number" ? legacyIndexBefore : null,
          rotationIndexAfter: typeof legacyIndexAfter === "number" ? legacyIndexAfter : null,
        };

        if (!fullPool.length || typeof legacyIndexBefore !== "number") {
          historicalRuns.push({
            runId: run.id,
            createdAt: run.createdAt.toISOString(),
            eventDate: run.event?.date.toISOString() ?? null,
            legacyIndexBefore: typeof legacyIndexBefore === "number" ? legacyIndexBefore : null,
            legacyIndexAfter: typeof legacyIndexAfter === "number" ? legacyIndexAfter : null,
            legacyStartMember: null,
            normalSelectedMembers: [],
            skippedMembers: [],
            correctedNextIndex: null,
            correctedNextMember: null,
          });
          continue;
        }

        // Reserved status is resource-specific. A member reserved for another
        // resource remained in this resource's legacy rotation pool.
        const reservedMemberIds = new Set(
          results.filter((result) => result.reservedQuantity > 0).map((result) => result.memberId),
        );
        const oldPool = fullPool.filter((member) => !reservedMemberIds.has(member.id));
        const normalSelectedIds = new Set(
          results.filter((result) => result.reservedQuantity === 0 && result.assignedQuantity > 0).map((result) => result.memberId),
        );
        const oldBefore = normalizeIndex(legacyIndexBefore, oldPool.length);
        const oldRotated = rotate(oldPool, oldBefore);
        const legacyStartMember = oldRotated[0]?.characterName ?? null;
        const normalSelectedMembers = oldRotated.filter((member) => normalSelectedIds.has(member.id)).map((member) => member.characterName ?? "Unnamed member");

        if (!oldPool.length || !normalSelectedIds.size) {
          historicalRuns.push({
            runId: run.id,
            createdAt: run.createdAt.toISOString(),
            eventDate: run.event?.date.toISOString() ?? null,
            legacyIndexBefore,
            legacyIndexAfter: typeof legacyIndexAfter === "number" ? legacyIndexAfter : null,
            legacyStartMember,
            normalSelectedMembers,
            skippedMembers: [],
            correctedNextIndex: null,
            correctedNextMember: null,
          });
          continue;
        }

        // The old implementation selected normal members from oldRotated.
        // Find the last selected normal member in that exact legacy order.
        let lastSelectedId: string | null = null;
        for (const member of oldRotated) {
          if (normalSelectedIds.has(member.id)) lastSelectedId = member.id;
        }
        if (!lastSelectedId) continue;

        // Start the corrected full-pool sequence at the same member where the
        // legacy sequence started. This preserves the historical starting point
        // while reinserting reserved members that the old implementation skipped.
        const fullStartPosition = fullPool.findIndex((member) => member.id === oldRotated[0]?.id);
        const fullRotated = fullStartPosition >= 0 ? rotate(fullPool, fullStartPosition) : [];
        const lastSelectedFullPosition = fullRotated.findIndex((member) => member.id === lastSelectedId);
        if (lastSelectedFullPosition < 0) continue;

        const runSkipped: string[] = [];
        for (let position = 0; position <= lastSelectedFullPosition; position++) {
          const member = fullRotated[position];
          if (reservedMemberIds.has(member.id)) {
            runSkipped.push(member.characterName ?? "Unnamed member");
            skippedMembers.push({
              memberId: member.id,
              memberName: member.characterName,
              runId: run.id,
              eventDate: run.event?.date.toISOString() ?? null,
            });
          }
        }

        const lastSelectedFullPoolIndex = fullPool.findIndex((member) => member.id === lastSelectedId);
        const correctedNextIndex = (lastSelectedFullPoolIndex + 1) % fullPool.length;
        reconstructedIndex = correctedNextIndex;
        historicalRuns.push({
          runId: run.id,
          createdAt: run.createdAt.toISOString(),
          eventDate: run.event?.date.toISOString() ?? null,
          legacyIndexBefore,
          legacyIndexAfter: typeof legacyIndexAfter === "number" ? legacyIndexAfter : null,
          legacyStartMember,
          normalSelectedMembers,
          skippedMembers: runSkipped,
          correctedNextIndex,
          correctedNextMember: fullPool[correctedNextIndex]?.characterName ?? null,
        });
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
        historicalRuns,
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
