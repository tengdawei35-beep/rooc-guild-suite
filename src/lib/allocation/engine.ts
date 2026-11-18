import { prisma } from "@/lib/prisma";

export type AllocationInput = { guildId: string; nonReservedMemberCount: number; eventDate: Date };
export type AllocationAssignment = {
  memberId: string;
  memberName: string | null;
  resourceId: string;
  resourceName: string;
  reservedQuantity: number;
  assignedQuantity: number;
  recoveryQuantity: number;
  normalQuantity: number;
};
export type AllocationResourceResult = {
  resourceId: string;
  resourceName: string;
  type: "FEATHER" | "CARD";
  total: number;
  reserved: number;
  allocated: number;
  overflow: number;
  perPlayerLimit: number;
  hardCap: number;
  selectedMembers: { id: string; characterName: string | null }[];
  assignments: AllocationAssignment[];
};
export type AllocationPreviewResult = {
  guildId: string;
  guildName: string;
  nonReservedMemberCount: number;
  eligibleMembers: { id: string; characterName: string | null }[];
  resources: AllocationResourceResult[];
};
export type AllocationOverride = {
  resourceId: string;
  assignments: { memberId: string; assignedQuantity: number }[];
};

type PendingRecovery = { id: string; memberId: string; resourceId: string; quantity: number };

type AssignmentParts = {
  memberId: string;
  memberName: string | null;
  reservedQuantity: number;
  assignedQuantity: number;
  recoveryQuantity: number;
  normalQuantity: number;
};

async function getPendingRecoveries(guildId: string): Promise<PendingRecovery[]> {
  return prisma.$queryRaw<PendingRecovery[]>`
    SELECT "id", "memberId", "resourceId", "quantity"
    FROM "RotationRecovery"
    WHERE "guildId" = ${guildId} AND "consumedAt" IS NULL AND "quantity" > 0
    ORDER BY "createdAt" ASC, "id" ASC
  `;
}

function assertStockInvariant(resourceName: string, total: number, reserved: number, assigned: number) {
  if (reserved < 0 || assigned < 0) throw new Error(`${resourceName} produced an invalid negative allocation amount.`);
  if (reserved + assigned > total) {
    throw new Error(`${resourceName} allocation exceeds available stock (${reserved + assigned}/${total}).`);
  }
}

export async function buildAllocation(input: AllocationInput): Promise<AllocationPreviewResult> {
  if (!input.guildId) throw new Error("Guild ID is required.");
  if (!Number.isInteger(input.nonReservedMemberCount) || input.nonReservedMemberCount < 0) {
    throw new Error("Number of members per allocation must be a non-negative integer.");
  }
  if (!(input.eventDate instanceof Date) || Number.isNaN(input.eventDate.getTime())) {
    throw new Error("A valid event date is required.");
  }

  const eventDateStart = new Date(input.eventDate);
  const eventDateEnd = new Date(eventDateStart.getTime() + 24 * 60 * 60 * 1000);
  const guild = await prisma.guild.findUnique({
    where: { id: input.guildId },
    include: {
      members: {
        where: {
          active: true,
          eligible: true,
          leaveDates: { none: { date: { gte: eventDateStart, lt: eventDateEnd } } },
        },
        orderBy: { characterName: "asc" },
      },
      resources: {
        where: { active: true },
        orderBy: { name: "asc" },
        include: {
          reservations: {
            where: { guildId: input.guildId, member: { guildId: input.guildId } },
            include: { member: { select: { id: true, characterName: true, active: true, eligible: true } } },
            orderBy: { member: { characterName: "asc" } },
          },
          rotationStates: { where: { guildId: input.guildId } },
        },
      },
    },
  });
  if (!guild) throw new Error("Guild not found.");

  const pendingRecoveries = await getPendingRecoveries(input.guildId);
  const rotationMembers = guild.members;
  const eligibleIds = new Set(rotationMembers.map((member) => member.id));
  const requestedCount = Math.min(input.nonReservedMemberCount, rotationMembers.length);
  const resources: AllocationResourceResult[] = [];

  for (const resource of guild.resources) {
    const rotationIndex = resource.rotationStates[0]?.rotationIndex ?? 0;
    const rotatedMembers = getRotatedMembers(rotationMembers, rotationIndex);
    const selectedMembers = rotatedMembers.slice(0, requestedCount);

    const reservationParts = resource.reservations
      .filter((reservation) => reservation.member.active && reservation.member.eligible && eligibleIds.has(reservation.memberId))
      .map((reservation): AssignmentParts => ({
        memberId: reservation.memberId,
        memberName: reservation.member.characterName,
        reservedQuantity: Math.min(Math.max(reservation.quantity, 0), resource.hardCap),
        assignedQuantity: 0,
        recoveryQuantity: 0,
        normalQuantity: 0,
      }));

    const partsByMember = new Map<string, AssignmentParts>();
    for (const reservation of reservationParts) partsByMember.set(reservation.memberId, reservation);

    const reserved = reservationParts.reduce((sum, assignment) => sum + assignment.reservedQuantity, 0);
    if (reserved > resource.total) {
      throw new Error(`${resource.name} reservations require ${reserved}, but only ${resource.total} exist.`);
    }
    let remaining = resource.total - reserved;

    const recoveryEntitlementByMember = new Map<string, number>();
    for (const recovery of pendingRecoveries) {
      if (recovery.resourceId !== resource.id || !eligibleIds.has(recovery.memberId)) continue;
      const reservedQuantity = partsByMember.get(recovery.memberId)?.reservedQuantity ?? 0;
      const currentEntitlement = recoveryEntitlementByMember.get(recovery.memberId) ?? 0;
      const capacity = Math.max(resource.hardCap - reservedQuantity - currentEntitlement, 0);
      const recoveryEntitlement = Math.min(Math.max(recovery.quantity, 0), capacity);
      if (recoveryEntitlement > 0) recoveryEntitlementByMember.set(recovery.memberId, currentEntitlement + recoveryEntitlement);
    }

    const normalAmount = selectedMembers.length > 0
      ? Math.min(resource.perPlayerLimit, Math.floor(remaining / selectedMembers.length))
      : 0;

    if (normalAmount > 0) {
      for (const member of selectedMembers) {
        const existing = partsByMember.get(member.id) ?? {
          memberId: member.id,
          memberName: member.characterName,
          reservedQuantity: 0,
          assignedQuantity: 0,
          recoveryQuantity: 0,
          normalQuantity: 0,
        };
        const recoveryEntitlement = recoveryEntitlementByMember.get(member.id) ?? 0;
        const capacity = Math.max(resource.hardCap - existing.reservedQuantity - recoveryEntitlement, 0);
        const amount = Math.min(normalAmount, capacity, remaining);
        if (amount <= 0) continue;
        existing.assignedQuantity += amount;
        existing.normalQuantity += amount;
        partsByMember.set(member.id, existing);
        remaining -= amount;
      }
    }

    for (const recovery of pendingRecoveries) {
      if (recovery.resourceId !== resource.id || !eligibleIds.has(recovery.memberId)) continue;
      const entitlement = recoveryEntitlementByMember.get(recovery.memberId) ?? 0;
      if (entitlement <= 0 || remaining <= 0) continue;

      const existing = partsByMember.get(recovery.memberId) ?? {
        memberId: recovery.memberId,
        memberName: rotationMembers.find((member) => member.id === recovery.memberId)?.characterName ?? null,
        reservedQuantity: 0,
        assignedQuantity: 0,
        recoveryQuantity: 0,
        normalQuantity: 0,
      };
      const recoveryRemaining = Math.max(entitlement - existing.recoveryQuantity, 0);
      const capacity = Math.max(resource.hardCap - existing.reservedQuantity - existing.assignedQuantity, 0);
      const amount = Math.min(recoveryRemaining, capacity, remaining);
      if (amount <= 0) continue;
      existing.assignedQuantity += amount;
      existing.recoveryQuantity += amount;
      partsByMember.set(recovery.memberId, existing);
      remaining -= amount;
    }

    // Overflow must operate on the same live ledger used by normal/recovery.
    // The previous implementation copied the reservation rows at their original
    // assignedQuantity=0, distributed the remaining stock into those copies,
    // then added that amount on top of normal allocations already in the ledger.
    // That double-counted reserved members' normal turns and could exceed total.
    if (remaining > 0 && reservationParts.length > 0) {
      const liveReservedAssignments = reservationParts
        .map((reservation) => partsByMember.get(reservation.memberId))
        .filter((assignment): assignment is AssignmentParts => Boolean(assignment));
      const remainingRef = { value: remaining };
      distributeOverflowToReservations({
        assignments: liveReservedAssignments,
        resourceHardCap: resource.hardCap,
        remainingRef,
      });
      remaining = remainingRef.value;
    }

    const assignments: AllocationAssignment[] = [...partsByMember.values()]
      .filter((assignment) => assignment.reservedQuantity > 0 || assignment.assignedQuantity > 0)
      .map((assignment) => ({ ...assignment, resourceId: resource.id, resourceName: resource.name }));

    const assigned = assignments.reduce((sum, assignment) => sum + assignment.assignedQuantity, 0);
    assertStockInvariant(resource.name, resource.total, reserved, assigned);
    const allocated = reserved + assigned;
    if (allocated + remaining !== resource.total) {
      throw new Error(`${resource.name} allocation ledger is inconsistent (${allocated} allocated + ${remaining} remaining != ${resource.total} total).`);
    }

    resources.push({
      resourceId: resource.id,
      resourceName: resource.name,
      type: resource.type,
      total: resource.total,
      reserved,
      allocated,
      overflow: remaining,
      perPlayerLimit: resource.perPlayerLimit,
      hardCap: resource.hardCap,
      selectedMembers: selectedMembers.map((member) => ({ id: member.id, characterName: member.characterName })),
      assignments,
    });
  }

  return {
    guildId: guild.id,
    guildName: guild.name,
    nonReservedMemberCount: requestedCount,
    eligibleMembers: rotationMembers.map((member) => ({ id: member.id, characterName: member.characterName })),
    resources,
  };
}

export function applyAllocationOverrides(preview: AllocationPreviewResult, overrides: AllocationOverride[]): AllocationPreviewResult {
  const overrideMap = new Map(overrides.map((override) => [override.resourceId, override]));
  const resources = preview.resources.map((resource) => {
    const override = overrideMap.get(resource.resourceId);
    if (!override) return resource;

    const assignmentByMember = new Map<string, AllocationAssignment>();
    for (const assignment of resource.assignments) assignmentByMember.set(assignment.memberId, { ...assignment });

    const recoveryByMember = new Map(resource.assignments.map((assignment) => [assignment.memberId, assignment.recoveryQuantity]));
    const overriddenMembers = new Set<string>();

    for (const item of override.assignments) {
      if (!Number.isInteger(item.assignedQuantity) || item.assignedQuantity < 0) throw new Error(`Invalid allocation amount for ${item.memberId}.`);
      if (overriddenMembers.has(item.memberId)) throw new Error(`A member cannot be assigned more than once to ${resource.resourceName}.`);
      overriddenMembers.add(item.memberId);

      const member = preview.eligibleMembers.find((candidate) => candidate.id === item.memberId);
      if (!member) throw new Error(`Member is not eligible for ${resource.resourceName}.`);

      const recoveryRequired = recoveryByMember.get(item.memberId) ?? 0;
      if (item.assignedQuantity < recoveryRequired) throw new Error(`${member.characterName ?? "Member"} must receive at least ${recoveryRequired} recovery units for ${resource.resourceName}.`);

      const normalPortion = item.assignedQuantity - recoveryRequired;
      if (normalPortion > resource.perPlayerLimit) throw new Error(`${member.characterName ?? "Member"} exceeds the per-player limit for ${resource.resourceName}.`);

      const reservedQuantity = assignmentByMember.get(item.memberId)?.reservedQuantity ?? 0;
      if (reservedQuantity + item.assignedQuantity > resource.hardCap) throw new Error(`${member.characterName ?? "Member"} exceeds the hard cap for ${resource.resourceName}.`);

      assignmentByMember.set(item.memberId, {
        memberId: item.memberId,
        memberName: member.characterName,
        resourceId: resource.resourceId,
        resourceName: resource.resourceName,
        reservedQuantity,
        assignedQuantity: item.assignedQuantity,
        recoveryQuantity: recoveryRequired,
        normalQuantity: normalPortion,
      });
    }

    const reserved = resource.assignments.reduce((sum, assignment) => sum + assignment.reservedQuantity, 0);
    const assigned = [...assignmentByMember.values()].reduce((sum, assignment) => sum + assignment.assignedQuantity, 0);
    assertStockInvariant(resource.resourceName, resource.total, reserved, assigned);
    const allocated = reserved + assigned;

    return {
      ...resource,
      reserved,
      allocated,
      overflow: resource.total - allocated,
      assignments: [...assignmentByMember.values()].filter((assignment) => assignment.reservedQuantity > 0 || assignment.assignedQuantity > 0),
    };
  });

  return { ...preview, resources };
}

function distributeOverflowToReservations({ assignments, resourceHardCap, remainingRef }: { assignments: AssignmentParts[]; resourceHardCap: number; remainingRef: { value: number } }) {
  while (remainingRef.value > 0) {
    const eligible = assignments.filter((assignment) => assignment.reservedQuantity + assignment.assignedQuantity < resourceHardCap);
    if (eligible.length === 0) break;

    const fairShare = Math.floor(remainingRef.value / eligible.length);
    if (fairShare === 0) {
      for (const assignment of eligible) {
        if (remainingRef.value <= 0) break;
        const capacity = resourceHardCap - assignment.reservedQuantity - assignment.assignedQuantity;
        const amount = Math.min(1, capacity, remainingRef.value);
        if (amount <= 0) continue;
        assignment.assignedQuantity += amount;
        remainingRef.value -= amount;
      }
      continue;
    }

    let distributedThisRound = 0;
    for (const assignment of eligible) {
      if (remainingRef.value <= 0) break;
      const capacity = resourceHardCap - assignment.reservedQuantity - assignment.assignedQuantity;
      const amount = Math.min(fairShare, capacity, remainingRef.value);
      if (amount <= 0) continue;
      assignment.assignedQuantity += amount;
      remainingRef.value -= amount;
      distributedThisRound += amount;
    }
    if (distributedThisRound === 0) break;
  }
}

function getRotatedMembers<T extends { id: string }>(members: T[], rotationIndex: number): T[] {
  if (members.length === 0) return [];
  const normalizedIndex = ((rotationIndex % members.length) + members.length) % members.length;
  return [...members.slice(normalizedIndex), ...members.slice(0, normalizedIndex)];
}

export async function buildAllocationPreview(guildId: string, eventDate: Date) {
  return buildAllocation({ guildId, nonReservedMemberCount: 0, eventDate });
}
