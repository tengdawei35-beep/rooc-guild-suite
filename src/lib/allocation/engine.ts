import { prisma } from "@/lib/prisma";

export type AllocationInput = {
  nonReservedMemberCount: number;
  eventDate: Date;
};

export type AllocationAssignment = {
  memberId: string;
  memberName: string;
  resourceId: string;
  resourceName: string;
  reservedQuantity: number;
  assignedQuantity: number;
};

export type AllocationResourceResult = {
  resourceId: string;
  resourceName: string;
  type: "FEATHER" | "CARD";

  total: number;
  reserved: number;
  allocated: number;
  overflow: number;

  selectedMembers: {
    id: string;
    displayName: string;
  }[];

  assignments: AllocationAssignment[];
};

export type AllocationPreviewResult = {
  guildId: string;
  guildName: string;
  nonReservedMemberCount: number;
  resources: AllocationResourceResult[];
};

export async function buildAllocation(
  input: AllocationInput
): Promise<AllocationPreviewResult> {
  if (
    !Number.isInteger(input.nonReservedMemberCount) ||
    input.nonReservedMemberCount < 0
  ) {
    throw new Error(
      "Number of non-reserved members must be a non-negative integer."
    );
  }

  // ------------------------------------------------------------
  // EVENT DATE RANGE
  // ------------------------------------------------------------
  //
  // MemberLeave is a DateTime, but leave is date-based.
  // Compare the entire UTC calendar day.
  //
  // ------------------------------------------------------------

    const eventDateStart = new Date(input.eventDate);

    const eventDateEnd = new Date(
      eventDateStart.getTime() +
        24 * 60 * 60 * 1000
    );

  // ------------------------------------------------------------
  // LOAD GUILD
  // ------------------------------------------------------------

  const guild = await prisma.guild.findFirst({
    include: {
      members: {
        where: {
          active: true,
          eligible: true,

          // --------------------------------------------------
          // LEAVE CHECK
          // --------------------------------------------------
          //
          // Eligible is still required for bidding.
          // A member on leave for this event is excluded.
          //
          leaveDates: {
            none: {
              date: {
                gte: eventDateStart,
                lt: eventDateEnd,
              },
            },
          },
        },

        orderBy: {
          displayName: "asc",
        },
      },

      resources: {
        where: {
          active: true,
        },

        orderBy: {
          name: "asc",
        },

        include: {
          reservations: {
            include: {
              member: {
                select: {
                  id: true,
                  displayName: true,
                  active: true,
                  eligible: true,
                },
              },
            },

            orderBy: {
              member: {
                displayName: "asc",
              },
            },
          },

          rotationStates: true,
        },
      },
    },
  });

  if (!guild) {
    throw new Error("No guild has been configured.");
  }

  // ------------------------------------------------------------
  // IDENTIFY RESERVED-POOL MEMBERS
  // ------------------------------------------------------------

  const reservedMemberIds = new Set<string>();

  for (const resource of guild.resources) {
    for (const reservation of resource.reservations) {
      reservedMemberIds.add(reservation.memberId);
    }
  }

  // ------------------------------------------------------------
  // BUILD NORMAL ALLOCATION POOL
  // ------------------------------------------------------------

  const nonReservedMembers = guild.members.filter(
    (member) => !reservedMemberIds.has(member.id)
  );

  const requestedCount = Math.min(
    input.nonReservedMemberCount,
    nonReservedMembers.length
  );

  // ------------------------------------------------------------
  // ALLOCATE EACH RESOURCE
  // ------------------------------------------------------------

  const resources: AllocationResourceResult[] = [];

  for (const resource of guild.resources) {
    const rotationState = resource.rotationStates[0];

    const rotationIndex =
      rotationState?.rotationIndex ?? 0;

    const orderedMembers = getRotatedMembers(
      nonReservedMembers,
      rotationIndex
    );

    const selectedMembers = orderedMembers.slice(
      0,
      requestedCount
    );

    // ----------------------------------------------------------
    // RESERVATIONS
    // ----------------------------------------------------------

    const reservationAssignments: AllocationAssignment[] =
      resource.reservations
        .filter(
          (reservation) =>
            reservation.member.active &&
            reservation.member.eligible
        )
        .map((reservation) => {
          const reservedQuantity = Math.min(
            reservation.quantity,
            resource.hardCap
          );

          return {
            memberId: reservation.memberId,
            memberName:
              reservation.member.displayName,
            resourceId: resource.id,
            resourceName: resource.name,
            reservedQuantity,
            assignedQuantity: 0,
          };
        });

    const reserved =
      reservationAssignments.reduce(
        (sum, assignment) =>
          sum + assignment.reservedQuantity,
        0
      );

    const availablePool = Math.max(
      resource.total - reserved,
      0
    );

    let remaining = availablePool;

    // ----------------------------------------------------------
    // NORMAL ALLOCATION
    // ----------------------------------------------------------

    const normalAssignments: AllocationAssignment[] = [];

    if (
      selectedMembers.length > 0 &&
      remaining > 0
    ) {
      const fairShare = Math.floor(
        remaining / selectedMembers.length
      );

      const normalAmount = Math.min(
        fairShare,
        resource.perPlayerLimit
      );

      if (normalAmount > 0) {
        for (const member of selectedMembers) {
          normalAssignments.push({
            memberId: member.id,
            memberName: member.displayName,
            resourceId: resource.id,
            resourceName: resource.name,
            reservedQuantity: 0,
            assignedQuantity: normalAmount,
          });

          remaining -= normalAmount;
        }
      }
    }

    // ----------------------------------------------------------
    // OVERFLOW → RESERVATION HOLDERS
    // ----------------------------------------------------------

    if (
      remaining > 0 &&
      reservationAssignments.length > 0
    ) {
      distributeOverflowToReservations({
        assignments: reservationAssignments,
        resourceHardCap: resource.hardCap,
        remainingRef: {
          value: remaining,
        },
      });
    }

    const normalAllocated =
      normalAssignments.reduce(
        (sum, assignment) =>
          sum + assignment.assignedQuantity,
        0
      );

    const reservationOverflowAllocated =
      reservationAssignments.reduce(
        (sum, assignment) =>
          sum + assignment.assignedQuantity,
        0
      );

    const totalAdditionalAllocated =
      normalAllocated +
      reservationOverflowAllocated;

    remaining = Math.max(
      availablePool - totalAdditionalAllocated,
      0
    );

    const overflow = remaining;

    const allocated =
      reserved +
      totalAdditionalAllocated;

    resources.push({
      resourceId: resource.id,
      resourceName: resource.name,
      type: resource.type,
      total: resource.total,
      reserved,
      allocated,
      overflow,

      selectedMembers: selectedMembers.map(
        (member) => ({
          id: member.id,
          displayName: member.displayName,
        })
      ),

      assignments: [
        ...reservationAssignments,
        ...normalAssignments,
      ],
    });
  }

  return {
    guildId: guild.id,
    guildName: guild.name,
    nonReservedMemberCount: requestedCount,
    resources,
  };
}

// ================================================================
// OVERFLOW DISTRIBUTION
// ================================================================

function distributeOverflowToReservations({
  assignments,
  resourceHardCap,
  remainingRef,
}: {
  assignments: AllocationAssignment[];
  resourceHardCap: number;
  remainingRef: {
    value: number;
  };
}) {
  while (remainingRef.value > 0) {
    const eligible = assignments.filter(
      (assignment) =>
        assignment.reservedQuantity +
          assignment.assignedQuantity <
        resourceHardCap
    );

    if (eligible.length === 0) {
      break;
    }

    const fairShare = Math.floor(
      remainingRef.value / eligible.length
    );

    if (fairShare === 0) {
      for (const assignment of eligible) {
        if (remainingRef.value <= 0) {
          break;
        }

        const capacity =
          resourceHardCap -
          assignment.reservedQuantity -
          assignment.assignedQuantity;

        if (capacity <= 0) {
          continue;
        }

        assignment.assignedQuantity += 1;
        remainingRef.value -= 1;
      }

      continue;
    }

    let distributedThisRound = 0;

    for (const assignment of eligible) {
      if (remainingRef.value <= 0) {
        break;
      }

      const capacity =
        resourceHardCap -
        assignment.reservedQuantity -
        assignment.assignedQuantity;

      const amount = Math.min(
        fairShare,
        capacity,
        remainingRef.value
      );

      if (amount <= 0) {
        continue;
      }

      assignment.assignedQuantity += amount;
      remainingRef.value -= amount;
      distributedThisRound += amount;
    }

    if (distributedThisRound === 0) {
      break;
    }
  }
}

// ================================================================
// ROTATION
// ================================================================

function getRotatedMembers<
  T extends { id: string }
>(
  members: T[],
  rotationIndex: number
): T[] {
  if (members.length === 0) {
    return [];
  }

  const normalizedIndex =
    ((rotationIndex % members.length) +
      members.length) %
    members.length;

  return [
    ...members.slice(normalizedIndex),
    ...members.slice(0, normalizedIndex),
  ];
}

// ================================================================
// PREVIEW COMPATIBILITY WRAPPER
// ================================================================

export async function buildAllocationPreview(
  eventDate: Date
) {
  const guild = await prisma.guild.findFirst({
    select: {
      id: true,
    },
  });

  if (!guild) {
    throw new Error(
      "No guild has been configured."
    );
  }

  return buildAllocation({
    nonReservedMemberCount: 0,
    eventDate,
  });
}