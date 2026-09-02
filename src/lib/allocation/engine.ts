import { prisma } from "@/lib/prisma";

export type AllocationInput = { guildId: string; nonReservedMemberCount: number; eventDate: Date };
export type AllocationAssignment = { memberId: string; memberName: string | null; resourceId: string; resourceName: string; reservedQuantity: number; assignedQuantity: number };
export type AllocationResourceResult = {
  resourceId: string; resourceName: string; type: "FEATHER" | "CARD";
  total: number; reserved: number; allocated: number; overflow: number;
  perPlayerLimit: number; hardCap: number;
  selectedMembers: { id: string; characterName: string | null }[];
  assignments: AllocationAssignment[];
};
export type AllocationPreviewResult = {
  guildId: string; guildName: string; nonReservedMemberCount: number;
  eligibleMembers: { id: string; characterName: string | null }[];
  resources: AllocationResourceResult[];
};
export type AllocationOverride = { resourceId: string; assignments: { memberId: string; assignedQuantity: number }[] };

export async function buildAllocation(input: AllocationInput): Promise<AllocationPreviewResult> {
  if (!input.guildId) throw new Error("Guild ID is required.");
  if (!Number.isInteger(input.nonReservedMemberCount) || input.nonReservedMemberCount < 0) throw new Error("Number of non-reserved members must be a non-negative integer.");
  if (!(input.eventDate instanceof Date) || Number.isNaN(input.eventDate.getTime())) throw new Error("A valid event date is required.");
  const eventDateStart = new Date(input.eventDate);
  const eventDateEnd = new Date(eventDateStart.getTime() + 24 * 60 * 60 * 1000);
  const guild = await prisma.guild.findUnique({
    where: { id: input.guildId },
    include: {
      members: { where: { active: true, eligible: true, leaveDates: { none: { date: { gte: eventDateStart, lt: eventDateEnd } } } }, orderBy: { characterName: "asc" } },
      resources: { where: { active: true }, orderBy: { name: "asc" }, include: {
        reservations: { where: { guildId: input.guildId, member: { guildId: input.guildId } }, include: { member: { select: { id: true, characterName: true, active: true, eligible: true } } }, orderBy: { member: { characterName: "asc" } } },
        rotationStates: { where: { guildId: input.guildId } },
      } },
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
    const selectedMembers = getRotatedMembers(nonReservedMembers, rotationIndex).slice(0, requestedCount);
    const reservationAssignments = resource.reservations.filter((r) => r.member.active && r.member.eligible).map((r) => ({ memberId: r.memberId, memberName: r.member.characterName, resourceId: resource.id, resourceName: resource.name, reservedQuantity: Math.min(r.quantity, resource.hardCap), assignedQuantity: 0 }));
    const reserved = reservationAssignments.reduce((sum, a) => sum + a.reservedQuantity, 0);
    const availablePool = Math.max(resource.total - reserved, 0);
    let remaining = availablePool;
    const normalAssignments: AllocationAssignment[] = [];
    if (selectedMembers.length > 0 && remaining > 0) {
      const normalAmount = Math.min(Math.floor(remaining / selectedMembers.length), resource.perPlayerLimit);
      if (normalAmount > 0) for (const member of selectedMembers) {
        normalAssignments.push({ memberId: member.id, memberName: member.characterName, resourceId: resource.id, resourceName: resource.name, reservedQuantity: 0, assignedQuantity: normalAmount });
        remaining -= normalAmount;
      }
    }
    if (remaining > 0 && reservationAssignments.length > 0) distributeOverflowToReservations({ assignments: reservationAssignments, resourceHardCap: resource.hardCap, remainingRef: { value: remaining } });
    const normalAllocated = normalAssignments.reduce((sum, a) => sum + a.assignedQuantity, 0);
    const reservationOverflowAllocated = reservationAssignments.reduce((sum, a) => sum + a.assignedQuantity, 0);
    const allocated = reserved + normalAllocated + reservationOverflowAllocated;
    resources.push({ resourceId: resource.id, resourceName: resource.name, type: resource.type, total: resource.total, reserved, allocated, overflow: Math.max(availablePool - normalAllocated - reservationOverflowAllocated, 0), perPlayerLimit: resource.perPlayerLimit, hardCap: resource.hardCap, selectedMembers: selectedMembers.map((m) => ({ id: m.id, characterName: m.characterName })), assignments: [...reservationAssignments, ...normalAssignments] });
  }
  return { guildId: guild.id, guildName: guild.name, nonReservedMemberCount: requestedCount, eligibleMembers: nonReservedMembers.map((m) => ({ id: m.id, characterName: m.characterName })), resources };
}

export function applyAllocationOverrides(preview: AllocationPreviewResult, overrides: AllocationOverride[]): AllocationPreviewResult {
  const overrideMap = new Map(overrides.map((o) => [o.resourceId, o]));
  const resources = preview.resources.map((resource) => {
    const override = overrideMap.get(resource.resourceId);
    if (!override) return resource;
    const seen = new Set<string>();
    const normalAssignments: AllocationAssignment[] = [];
    for (const item of override.assignments) {
      if (!Number.isInteger(item.assignedQuantity) || item.assignedQuantity < 0) throw new Error(`Invalid allocation amount for ${item.memberId}.`);
      if (item.assignedQuantity === 0) continue;
      if (seen.has(item.memberId)) throw new Error(`A member cannot be assigned more than once to ${resource.resourceName}.`);
      seen.add(item.memberId);
      const member = preview.eligibleMembers.find((m) => m.id === item.memberId);
      if (!member) throw new Error(`Member is not eligible for ${resource.resourceName}.`);
      if (item.assignedQuantity > resource.perPlayerLimit) throw new Error(`${member.characterName ?? "Member"} exceeds the per-player limit for ${resource.resourceName}.`);
      normalAssignments.push({ memberId: item.memberId, memberName: member.characterName, resourceId: resource.resourceId, resourceName: resource.resourceName, reservedQuantity: 0, assignedQuantity: item.assignedQuantity });
    }
    const reservations = resource.assignments.filter((a) => a.reservedQuantity > 0).map((a) => ({ ...a, assignedQuantity: 0 }));
    const reserved = reservations.reduce((sum, a) => sum + a.reservedQuantity, 0);
    const availablePool = Math.max(resource.total - reserved, 0);
    const normalTotal = normalAssignments.reduce((sum, a) => sum + a.assignedQuantity, 0);
    if (normalTotal > availablePool) throw new Error(`${resource.resourceName} does not have enough unreserved stock for the edited allocation.`);
    const remainingRef = { value: availablePool - normalTotal };
    if (remainingRef.value > 0 && reservations.length > 0) distributeOverflowToReservations({ assignments: reservations, resourceHardCap: resource.hardCap, remainingRef });
    const reservationOverflow = reservations.reduce((sum, a) => sum + a.assignedQuantity, 0);
    const allocated = reserved + normalTotal + reservationOverflow;
    return { ...resource, reserved, allocated, overflow: Math.max(availablePool - normalTotal - reservationOverflow, 0), selectedMembers: normalAssignments.map((a) => ({ id: a.memberId, characterName: a.memberName })), assignments: [...reservations, ...normalAssignments] };
  });
  return { ...preview, resources };
}

function distributeOverflowToReservations({ assignments, resourceHardCap, remainingRef }: { assignments: AllocationAssignment[]; resourceHardCap: number; remainingRef: { value: number } }) {
  while (remainingRef.value > 0) {
    const eligible = assignments.filter((a) => a.reservedQuantity + a.assignedQuantity < resourceHardCap);
    if (eligible.length === 0) break;
    const fairShare = Math.floor(remainingRef.value / eligible.length);
    if (fairShare === 0) {
      for (const assignment of eligible) { if (remainingRef.value <= 0) break; const capacity = resourceHardCap - assignment.reservedQuantity - assignment.assignedQuantity; if (capacity <= 0) continue; assignment.assignedQuantity += 1; remainingRef.value -= 1; }
      continue;
    }
    let distributedThisRound = 0;
    for (const assignment of eligible) { if (remainingRef.value <= 0) break; const capacity = resourceHardCap - assignment.reservedQuantity - assignment.assignedQuantity; const amount = Math.min(fairShare, capacity, remainingRef.value); if (amount <= 0) continue; assignment.assignedQuantity += amount; remainingRef.value -= amount; distributedThisRound += amount; }
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
