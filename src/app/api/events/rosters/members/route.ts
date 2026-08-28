import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type AddMemberRequest = {
  partyId?: string;
  memberId?: string;
  slotNumber?: number;
};

type MoveMemberRequest = {
  assignmentId?: string;
  targetPartyId?: string;
  targetSlotNumber?: number;
};

// =============================================================
// HELPERS
// =============================================================

const PARTY_SIZE = 5;

function isValidSlot(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= PARTY_SIZE
  );
}

// =============================================================
// ADD MEMBER
// =============================================================

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as AddMemberRequest;

    if (!body.partyId) {
      return NextResponse.json(
        {
          error:
            "Party ID is required.",
        },
        { status: 400 }
      );
    }

    if (!body.memberId) {
      return NextResponse.json(
        {
          error:
            "Member ID is required.",
        },
        { status: 400 }
      );
    }

    if (
      !isValidSlot(
        body.slotNumber
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Slot number must be between 1 and 5.",
        },
        { status: 400 }
      );
    }

    // =========================================================
    // LOAD PARTY
    // =========================================================

    const party =
      await prisma.rosterParty.findUnique({
        where: {
          id: body.partyId,
        },

        include: {
          roster: {
            include: {
              event: true,
            },
          },

          members: true,
        },
      });

    if (!party) {
      return NextResponse.json(
        {
          error:
            "Party not found.",
        },
        { status: 404 }
      );
    }

    if (
      party.members.length >=
      PARTY_SIZE
    ) {
      return NextResponse.json(
        {
          error:
            "A party cannot contain more than 5 members.",
        },
        { status: 400 }
      );
    }

    // =========================================================
    // CHECK MEMBER
    // =========================================================

    const member =
      await prisma.guildMember.findFirst({
        where: {
          id: body.memberId,

          guildId:
            party.roster.event.guildId,
        },
      });

    if (!member) {
      return NextResponse.json(
        {
          error:
            "Guild member not found.",
        },
        { status: 404 }
      );
    }

    if (!member.active) {
      return NextResponse.json(
        {
          error:
            "Inactive members cannot be assigned to a roster.",
        },
        { status: 400 }
      );
    }

    // =========================================================
    // CHECK LEAVE DATE
    // =========================================================

    const eventDate =
      new Date(
        party.roster.event.date
      );

    const eventDateEnd =
      new Date(
        eventDate.getTime() +
          24 *
            60 *
            60 *
            1000
      );

    const leave =
      await prisma.memberLeave.findFirst({
        where: {
          memberId:
            member.id,

          date: {
            gte: eventDate,
            lt: eventDateEnd,
          },
        },
      });

    if (leave) {
      return NextResponse.json(
        {
          error:
            "This member is unavailable on the event date.",
        },
        { status: 400 }
      );
    }

    // =========================================================
    // CHECK EVENT PARTICIPATION
    // =========================================================

    const participation =
      await prisma.eventParticipation.findUnique(
        {
          where: {
            eventId_memberId: {
              eventId:
                party.roster.event.id,

              memberId:
                member.id,
            },
          },
        }
      );

    if (
      participation &&
      !participation.available
    ) {
      return NextResponse.json(
        {
          error:
            "This member is marked unavailable for this event.",
        },
        { status: 400 }
      );
    }

    // =========================================================
    // CHECK EXISTING ROSTER ASSIGNMENT
    // =========================================================

    const existingAssignment =
      await prisma.rosterMember.findFirst(
        {
          where: {
            memberId:
              member.id,

            party: {
              rosterId:
                party.roster.id,
            },
          },
        }
      );

    if (existingAssignment) {
      return NextResponse.json(
        {
          error:
            "This member is already assigned to this roster.",
        },
        { status: 409 }
      );
    }

    // =========================================================
    // CHECK SLOT
    // =========================================================

    const existingSlot =
      party.members.find(
        (assignment) =>
          assignment.slotNumber ===
          body.slotNumber
      );

    if (existingSlot) {
      return NextResponse.json(
        {
          error:
            "This slot is already occupied.",
        },
        { status: 409 }
      );
    }

    // =========================================================
    // LOAD PREVIOUS RANKING SNAPSHOT
    // =========================================================
    //
    // Manual additions need a historical ranking snapshot.
    //
    // If this member has previously appeared in a roster,
    // preserve their most recent scores and percentiles.
    //
    // If this is their first roster appearance, use zero as
    // the initial baseline.
    //
    // =========================================================

    const previousAssignment =
      await prisma.rosterMember.findFirst({
        where: {
          memberId:
            member.id,
        },

        orderBy: {
          createdAt:
            "desc",
        },

        select: {
          guildPercentile:
            true,

          tankScore:
            true,

          tankPercentile:
            true,

          dpsScore:
            true,

          dpsPercentile:
            true,

          pvpScore:
            true,

          pvpPercentile:
            true,
        },
      });

    // =========================================================
    // CREATE ASSIGNMENT
    // =========================================================

    const assignment =
      await prisma.rosterMember.create({
        data: {
          partyId:
            party.id,

          memberId:
            member.id,

          slotNumber:
            body.slotNumber,

          // ---------------------------------------------------
          // Overall
          // ---------------------------------------------------

          guildPercentile:
            previousAssignment
              ?.guildPercentile ??
            0,

          // ---------------------------------------------------
          // Tank
          // ---------------------------------------------------

          tankScore:
            previousAssignment
              ?.tankScore ??
            0,

          tankPercentile:
            previousAssignment
              ?.tankPercentile ??
            0,

          // ---------------------------------------------------
          // DPS
          // ---------------------------------------------------

          dpsScore:
            previousAssignment
              ?.dpsScore ??
            0,

          dpsPercentile:
            previousAssignment
              ?.dpsPercentile ??
            0,

          // ---------------------------------------------------
          // PvP
          // ---------------------------------------------------

          pvpScore:
            previousAssignment
              ?.pvpScore ??
            0,

          pvpPercentile:
            previousAssignment
              ?.pvpPercentile ??
            0,
        },

        include: {
          member: {
            select: {
              id: true,

              displayName:
                true,

              characterName:
                true,

              job: true,

              priority:
                true,
            },
          },
        },
      });

    return NextResponse.json({
      success: true,

      assignment,
    });
  } catch (error) {
    console.error(
      "[ROSTER MEMBERS] Failed to add member:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to add member to roster.",
      },
      { status: 500 }
    );
  }
}

// =============================================================
// MOVE / SWAP MEMBER
// =============================================================
//
// PATCH behavior:
//
// assignmentId       = member being moved
// targetPartyId      = destination party
// targetSlotNumber   = destination slot
//
// If destination slot is empty:
//     move member.
//
// If destination slot is occupied:
//     swap the two assignments.
//
// =============================================================

export async function PATCH(
  request: Request
) {
  try {
    const body =
      (await request.json()) as MoveMemberRequest;

    if (!body.assignmentId) {
      return NextResponse.json(
        {
          error:
            "Assignment ID is required.",
        },
        { status: 400 }
      );
    }

    if (!body.targetPartyId) {
      return NextResponse.json(
        {
          error:
            "Target party ID is required.",
        },
        { status: 400 }
      );
    }

    if (
      !isValidSlot(
        body.targetSlotNumber
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Target slot must be between 1 and 5.",
        },
        { status: 400 }
      );
    }

    // =========================================================
    // LOAD SOURCE ASSIGNMENT
    // =========================================================

    const source =
      await prisma.rosterMember.findUnique(
        {
          where: {
            id:
              body.assignmentId,
          },

          include: {
            party: {
              include: {
                roster: {
                  include: {
                    event: true,
                  },
                },
              },
            },
          },
        }
      );

    if (!source) {
      return NextResponse.json(
        {
          error:
            "Roster assignment not found.",
        },
        { status: 404 }
      );
    }

    // =========================================================
    // LOAD TARGET PARTY
    // =========================================================

    const targetParty =
      await prisma.rosterParty.findUnique(
        {
          where: {
            id:
              body.targetPartyId,
          },

          include: {
            roster: true,

            members: {
              orderBy: {
                slotNumber:
                  "asc",
              },
            },
          },
        }
      );

    if (!targetParty) {
      return NextResponse.json(
        {
          error:
            "Target party not found.",
        },
        { status: 404 }
      );
    }

    // =========================================================
    // SAME ROSTER CHECK
    // =========================================================

    if (
      targetParty.rosterId !==
      source.party.rosterId
    ) {
      return NextResponse.json(
        {
          error:
            "Members can only be moved within the same roster.",
        },
        { status: 400 }
      );
    }

    // =========================================================
    // SAME POSITION
    // =========================================================

    if (
      source.partyId ===
        targetParty.id &&
      source.slotNumber ===
        body.targetSlotNumber
    ) {
      return NextResponse.json({
        success: true,
        action: "unchanged",
      });
    }

    // =========================================================
    // FIND DESTINATION
    // =========================================================

    const destination =
      targetParty.members.find(
        (assignment) =>
          assignment.slotNumber ===
          body.targetSlotNumber
      );

    // =========================================================
    // MOVE INTO EMPTY SLOT
    // =========================================================

    if (!destination) {
      const updated =
        await prisma.$transaction(
          async (tx) => {
            /*
             * Temporarily move source to an impossible slot.
             *
             * This avoids the unique constraint collision when
             * source and destination are in the same party.
             */

            const temporarySlot =
              1000000;

            await tx.rosterMember.update({
              where: {
                id:
                  source.id,
              },

              data: {
                slotNumber:
                  temporarySlot,
              },
            });

            return tx.rosterMember.update({
              where: {
                id:
                  source.id,
              },

              data: {
                partyId:
                  targetParty.id,

                slotNumber:
                  body.targetSlotNumber,
              },

              include: {
                member: {
                  select: {
                    id: true,

                    displayName:
                      true,

                    characterName:
                      true,

                    job: true,

                    priority:
                      true,
                  },
                },
              },
            });
          }
        );

      return NextResponse.json({
        success: true,

        action: "moved",

        assignment:
          updated,
      });
    }

    // =========================================================
    // SWAP
    // =========================================================

    const swapped =
      await prisma.$transaction(
        async (tx) => {
          const temporarySourceSlot =
            1000000;

          const temporaryDestinationSlot =
            1000001;

          // ---------------------------------------------------
          // Move both assignments temporarily.
          // ---------------------------------------------------

          await tx.rosterMember.update({
            where: {
              id:
                source.id,
            },

            data: {
              slotNumber:
                temporarySourceSlot,
            },
          });

          await tx.rosterMember.update({
            where: {
              id:
                destination.id,
            },

            data: {
              slotNumber:
                temporaryDestinationSlot,
            },
          });

          // ---------------------------------------------------
          // Source takes destination position.
          // ---------------------------------------------------

          await tx.rosterMember.update({
            where: {
              id:
                source.id,
            },

            data: {
              partyId:
                targetParty.id,

              slotNumber:
                body.targetSlotNumber,
            },
          });

          // ---------------------------------------------------
          // Destination takes source position.
          // ---------------------------------------------------

          await tx.rosterMember.update({
            where: {
              id:
                destination.id,
            },

            data: {
              partyId:
                source.partyId,

              slotNumber:
                source.slotNumber,
            },
          });

          return tx.rosterMember.findMany({
            where: {
              id: {
                in: [
                  source.id,
                  destination.id,
                ],
              },
            },

            include: {
              member: {
                select: {
                  id: true,

                  displayName:
                    true,

                  characterName:
                    true,

                  job: true,

                  priority:
                    true,
                },
              },
            },

            orderBy: {
              slotNumber:
                "asc",
            },
          });
        }
      );

    return NextResponse.json({
      success: true,

      action: "swapped",

      assignments:
        swapped,
    });
  } catch (error) {
    console.error(
      "[ROSTER MEMBERS] Failed to move member:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to move roster member.",
      },
      { status: 500 }
    );
  }
}

// =============================================================
// REMOVE MEMBER
// =============================================================

export async function DELETE(
  request: Request
) {
  try {
    const url =
      new URL(request.url);

    const id =
      url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Assignment ID is required.",
        },
        { status: 400 }
      );
    }

    // =========================================================
    // LOAD ASSIGNMENT
    // =========================================================

    const assignment =
      await prisma.rosterMember.findUnique({
        where: {
          id,
        },

        include: {
          party: {
            include: {
              roster: true,
            },
          },
        },
      });

    if (!assignment) {
      return NextResponse.json(
        {
          error:
            "Roster assignment not found.",
        },
        { status: 404 }
      );
    }

    // =========================================================
    // DELETE ASSIGNMENT
    // =========================================================

    await prisma.rosterMember.delete({
      where: {
        id,
      },
    });

    // =========================================================
    // COMPACT REMAINING SLOTS
    // =========================================================
    //
    // Example:
    //
    // 1 A
    // 2 B
    // 3 C
    //
    // Remove B
    //
    // becomes:
    //
    // 1 A
    // 2 C
    //
    // =========================================================

    const remaining =
      await prisma.rosterMember.findMany({
        where: {
          partyId:
            assignment.partyId,
        },

        orderBy: {
          slotNumber:
            "asc",
        },
      });

    // ---------------------------------------------------------
    // First move everything to temporary slots.
    // ---------------------------------------------------------

    if (remaining.length > 0) {
      await prisma.$transaction(
        remaining.map(
          (entry, index) =>
            prisma.rosterMember.update({
              where: {
                id:
                  entry.id,
              },

              data: {
                slotNumber:
                  1000000 +
                  index,
              },
            })
        )
      );

      // -------------------------------------------------------
      // Then assign compact slots.
      // -------------------------------------------------------

      await prisma.$transaction(
        remaining.map(
          (entry, index) =>
            prisma.rosterMember.update({
              where: {
                id:
                  entry.id,
              },

              data: {
                slotNumber:
                  index + 1,
              },
            })
        )
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "[ROSTER MEMBERS] Failed to remove member:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to remove roster member.",
      },
      { status: 500 }
    );
  }
}