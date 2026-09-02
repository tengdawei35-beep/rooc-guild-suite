import { prisma } from "@/lib/prisma";

export type AllocationInput = { guildId: string; nonReservedMemberCount: number; eventDate: Date };
export type AllocationAssignment = { memberId: string; memberName: string | null; resourceId: string; resourceName: string; reservedQuantity: number; assignedQuantity: number };
export type AllocationResourceResult = {
  resourceId: string; resourceName: string; type: "FEATHER" | "CARD";
  total: number; reserved: number; allocated: number; overflow: number;
  selectedMembers: { id: string; characterName: string | null }[];
  assignments: AllocationAssignment[];
};
export type AllocationPreviewResult = {
  guildId: string; guildName: string; nonReservedMemberCount: number;
  eligibleMembers: { id: string; characterName: string | null }[];
  resources: AllocationResourceResult[];
};

export async function buildAllocation(input: AllocationInput): Promise<AllocationPreviewResult> {
  if (!input.guildId) throw new Error("Guild ID is required.");
  if (!Number.isInteger(input.nonReservedMemberCount) || input.nonReservedMemberCount < 0) throw new Error("Number of non-reserved members must be a non-negative integer.");
  if (!(input.eventDate instanceof Date) || Number.isNaN(input.eventDate.getTime())) throw new Error("A valid event date is required.");

  const eventDateStart = new Date(input.eventDate);
  const eventDateEnd = new Date(eventDateStart.getTime() + 24 * 60 * 60 * 1000);
  const guild = await prisma.guild.findUnique({
    where: { id: input.guildId },
    include: {
      members: {
        where: { active: true, eligible: true, leaveDates: { none: { date: { gte: eventDateStart, lt: eventDateEnd } } } },
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

  const reservedMemberIds = new Set<string>();
  for (const resource of guild.resources) for (const reservation of resource.reservations) reservedMemberIds.add(reservation.memberId);
  const nonReservedMembers = guild.members.filter((member) => !reservedMemberIds.has(member.id));
  const requestedCount = Math.min(input.nonReservedMemberCount, nonReservedMembers.length);

  const resources: AllocationResourceResult[] = [];
  for (const resource of guild.resources) {
    const rotationIndex = resource.rotationStates[0]?.rotationIndex ?? 0;
    const orderedMembers = getRotatedMembers(nonReservedMembers, rotationIndex);
    const selectedMembers = orderedMembers.slice(0, requestedCount);

    const reservationAssignments = resource.reservations
      .filter((reservation) => reservation.member.active && reservation.member.eligible)
      .map((reservation) => ({
        memberId: reservation.memberId,
        memberName: reservation.member.characterName,
        resourceId: resource.id,
        resourceName: resource.name,
        reservedQuantity: Math.min(reservation.quantity, resource.hardCap),
        assignedQuantity: 0,
      }));

    const reserved = reservationAssignments.reduce((sum, a) => sum + a.reservedQuantity, 0);
    const availablePool = Math.max(resource.total - reserved, 0);
    let remaining = availablePool;
    const normalAssignments: AllocationAssignment[] = [];

    if (selectedMembers.length > 0 && remaining > 0) {
      const fairShare = Math.floor(remaining / selectedMembers.length);
      const normalAmount = Math.min(fairShare, resource.perPlayerLimit);
      if (normalAmount > 0) {
        for (const member of selectedMembers) {
          normalAssignments.push({ memberId: member.id, memberName: member.characterName, resourceId: resource.id, resourceName: resource.name, reservedQuantity: 0, assignedQuantity: normalAmount });
          remaining -= normalAmount;
        }
      }
    }

    if (remaining > 0 && reservationAssignments.length > 0) {
      distributeOverflowToReservations({ assignments: reservationAssignments, resourceHardCap: resource.hardCap, remainingRef: { value: remaining } });
    }

    const normalAllocated = normalAssignments.reduce((sum, a) => sum + a.assignedQuantity, 0);
    const reservationOverflowAllocated = reservationAssignments.reduce((sum, a) => sum + a.assignedQuantity, 0);
    const totalAdditionalAllocated = normalAllocated + reservationOverflowAllocated;
    remaining = Math.max(availablePool - totalAdditionalAllocated, 0);

    resources.push({
      resourceId: resource.id,
      resourceName: resource.name,
      type: resource.type,
      total: resource.total,
      reserved,
      allocated: reserved + totalAdditionalAllocated,
      overflow: remaining,
      selectedMembers: selectedMembers.map((member) => ({ id: member.id, characterName: member.characterName })),
      assignments: [...reservationAssignments, ...normalAssignments],
    });
  }

  return {
    guildId: guild.id,
    guildName: guild.name,
    nonReservedMemberCount: requestedCount,
    eligibleMembers: nonReservedMembers.map((member) => ({ id: member.id, characterName: member.characterName })),
    resources,
  };
}

function distributeOverflowToReservations({ assignments, resourceHardCap, remainingRef }: { assignments: AllocationAssignment[]; resourceHardCap: number; remainingRef: { value: number } }) {
  while (remainingRef.value > 0) {
    const eligible = assignments.filter((a) => a.reservedQuantity + a.assignedQuantity < resourceHardCap);
    if (eligible.length === 0) break;
    const fairShare = Math.floor(remainingRef.value / eligible.length);
    if (fairShare === 0) {
      for (const assignment of eligible) {
        if (remainingRef.value <= 0) break;
        const capacity = resourceHardCap - assignment.reservedQuantity - assignment.assignedQuantity;
        if (capacity <= 0) continue;
        assignment.assignedQuantity += 1;
        remainingRef.value -= 1;
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
