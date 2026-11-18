import { NextResponse } from "next/server";

import {
  getCurrentAuth,
  hasPermission,
} from "@/lib/auth";

import { prisma } from "@/lib/prisma";
import { notifyRosterUpdate } from "@/lib/discord-notifications";

const PARTY_SIZE = 5;
const TEMP_SLOT_BASE = 1_000_000;

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

function unauthorizedResponse() {
  return NextResponse.json(
    {
      error:
        "Authentication required.",
    },
    {
      status: 401,
    }
  );
}

function forbiddenResponse() {
  return NextResponse.json(
    {
      error:
        "You do not have permission to edit rosters.",
    },
    {
      status: 403,
    }
  );
}

// =============================================================
// ADD MEMBER TO ROSTER
// =============================================================

export async function POST(
  request: Request
) {
  try {
    const auth =
      await getCurrentAuth();

    if (!auth) {
      return unauthorizedResponse();
    }

    if (
      !hasPermission(
        auth.role,
        "rosters.edit"
      )
    ) {
      return forbiddenResponse();
    }

    const body =
      (await request.json()) as AddMemberRequest;

    if (!body.partyId) {
      return NextResponse.json(
        {
          error:
            "Party ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!body.memberId) {
      return NextResponse.json(
        {
          error:
            "Member ID is required.",
        },
        {
          status: 400,
        }
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
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------
    // LOAD PARTY + ROSTER + EVENT
    // ---------------------------------------------------------

    const party =
      await prisma.rosterParty.findUnique(
        {
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
        }
      );

    if (!party) {
      return NextResponse.json(
        {
          error:
            "Party not found.",
        },
        {
          status: 404,
        }
      );
    }

    // Critical guild isolation check.
    if (
      party.roster.event.guildId !==
      auth.guild.id
    ) {
      return NextResponse.json(
        {
          error:
            "Party not found.",
        },
        {
          status: 404,
        }
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
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------
    // LOAD MEMBER
    // ---------------------------------------------------------

    const member =
      await prisma.guildMember.findFirst(
        {
          where: {
            id: body.memberId,

            guildId:
              auth.guild.id,
          },
        }
      );

    if (!member) {
      return NextResponse.json(
        {
          error:
            "Guild member not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (!member.active) {
      return NextResponse.json(
        {
          error:
            "Inactive members cannot be assigned to a roster.",
        },
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------
    // CHECK LEAVE DATE
    // ---------------------------------------------------------

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
      await prisma.memberLeave.findFirst(
        {
          where: {
            memberId:
              member.id,

            date: {
              gte: eventDate,
              lt: eventDateEnd,
            },
          },
        }
      );

    if (leave) {
      return NextResponse.json(
        {
          error:
            "This member is unavailable on the event date.",
        },
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------
    // CHECK EVENT PARTICIPATION
    // ---------------------------------------------------------

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
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------
    // CHECK EXISTING ASSIGNMENT
    // ---------------------------------------------------------

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
        {
          status: 409,
        }
      );
    }

    // ---------------------------------------------------------
    // CHECK DESTINATION SLOT
    // ---------------------------------------------------------

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
        {
          status: 409,
        }
      );
    }

    // ---------------------------------------------------------
    // PRESERVE PREVIOUS RANKING SNAPSHOT
    // ---------------------------------------------------------

    const previousAssignment =
      await prisma.rosterMember.findFirst(
        {
          where: {
            memberId:
              member.id,

            party: {
              roster: {
                event: {
                  guildId:
                    auth.guild.id,
                },
              },
            },
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
        }
      );

    // ---------------------------------------------------------
    // CREATE ASSIGNMENT
    // ---------------------------------------------------------

    const assignment =
      await prisma.rosterMember.create(
        {
          data: {
            partyId:
              party.id,

            memberId:
              member.id,

            slotNumber:
              body.slotNumber,

            guildPercentile:
              previousAssignment
                ?.guildPercentile ??
              0,

            tankScore:
              previousAssignment
                ?.tankScore ??
              0,

            tankPercentile:
              previousAssignment
                ?.tankPercentile ??
              0,

            dpsScore:
              previousAssignment
                ?.dpsScore ??
              0,

            dpsPercentile:
              previousAssignment
                ?.dpsPercentile ??
              0,

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
                characterName: true,
                job: true,
                priority: true,
              },
            },
          },
        }
      );

    await notifyRosterUpdate({
      guildId: auth.guild.id,
      eventId: party.roster.event.id,
      rosterId: party.roster.id,
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
      {
        status: 500,
      }
    );
  }
}

// =============================================================
// MOVE / SWAP MEMBER
// =============================================================

export async function PATCH(
  request: Request
) {
  try {
    const auth =
      await getCurrentAuth();

    if (!auth) {
      return unauthorizedResponse();
    }

    if (
      !hasPermission(
        auth.role,
        "rosters.edit"
      )
    ) {
      return forbiddenResponse();
    }

    const body =
      (await request.json()) as MoveMemberRequest;

    if (!body.assignmentId) {
      return NextResponse.json(
        {
          error:
            "Assignment ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!body.targetPartyId) {
      return NextResponse.json(
        {
          error:
            "Target party ID is required.",
        },
        {
          status: 400,
        }
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
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------
    // LOAD SOURCE ASSIGNMENT
    // ---------------------------------------------------------

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
        {
          status: 404,
        }
      );
    }

    // Critical guild isolation check.
    if (
      source.party.roster.event.guildId !==
      auth.guild.id
    ) {
      return NextResponse.json(
        {
          error:
            "Roster assignment not found.",
        },
        {
          status: 404,
        }
      );
    }

    // ---------------------------------------------------------
    // LOAD TARGET PARTY
    // ---------------------------------------------------------

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
        {
          status: 404,
        }
      );
    }

    // Target party must also belong to the
    // authenticated guild.
    if (
      targetParty.roster.id !==
      source.party.roster.id
    ) {
      return NextResponse.json(
        {
          error:
            "Members can only be moved within the same roster.",
        },
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------
    // SAME POSITION
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // FIND DESTINATION
    // ---------------------------------------------------------

    const destination =
      targetParty.members.find(
        (assignment) =>
          assignment.slotNumber ===
          body.targetSlotNumber
      );

    // ---------------------------------------------------------
    // MOVE INTO EMPTY SLOT
    // ---------------------------------------------------------

    if (!destination) {
      const updated =
        await prisma.$transaction(
          async (tx) => {
            await tx.rosterMember.update({
              where: {
                id:
                  source.id,
              },

              data: {
                slotNumber:
                  TEMP_SLOT_BASE,
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
                    characterName: true,
                    job: true,
                    priority: true,
                  },
                },
              },
            });
          }
        );

      await notifyRosterUpdate({
        guildId: auth.guild.id,
        eventId: source.party.roster.event.id,
        rosterId: source.party.roster.id,
      });

      return NextResponse.json({
        success: true,
        action: "moved",
        assignment: updated,
      });
    }

    // ---------------------------------------------------------
    // SWAP
    // ---------------------------------------------------------

    const swapped =
      await prisma.$transaction(
        async (tx) => {
          const sourceTemp =
            TEMP_SLOT_BASE;

          const destinationTemp =
            TEMP_SLOT_BASE + 1;

          // Temporarily move both assignments
          // to avoid unique constraint collisions.

          await tx.rosterMember.update({
            where: {
              id:
                source.id,
            },

            data: {
              slotNumber:
                sourceTemp,
            },
          });

          await tx.rosterMember.update({
            where: {
              id:
                destination.id,
            },

            data: {
              slotNumber:
                destinationTemp,
            },
          });

          // Source takes destination position.

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

          // Destination takes source position.

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
                  characterName: true,
                  job: true,
                  priority: true,
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

    await notifyRosterUpdate({
      guildId: auth.guild.id,
      eventId: source.party.roster.event.id,
      rosterId: source.party.roster.id,
    });

    return NextResponse.json({
      success: true,
      action: "swapped",
      assignments: swapped,
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
      {
        status: 500,
      }
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
    const auth =
      await getCurrentAuth();

    if (!auth) {
      return unauthorizedResponse();
    }

    if (
      !hasPermission(
        auth.role,
        "rosters.edit"
      )
    ) {
      return forbiddenResponse();
    }

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
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------
    // LOAD ASSIGNMENT
    // ---------------------------------------------------------

    const assignment =
      await prisma.rosterMember.findUnique(
        {
          where: {
            id,
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

    if (!assignment) {
      return NextResponse.json(
        {
          error:
            "Roster assignment not found.",
        },
        {
          status: 404,
        }
      );
    }

    // Critical guild isolation check.
    if (
      assignment.party.roster.event.guildId !==
      auth.guild.id
    ) {
      return NextResponse.json(
        {
          error:
            "Roster assignment not found.",
        },
        {
          status: 404,
        }
      );
    }

    // ---------------------------------------------------------
    // DELETE
    // ---------------------------------------------------------

    await prisma.rosterMember.delete({
      where: {
        id,
      },
    });

    // ---------------------------------------------------------
    // COMPACT REMAINING SLOTS
    // ---------------------------------------------------------

    const remaining =
      await prisma.rosterMember.findMany(
        {
          where: {
            partyId:
              assignment.partyId,
          },

          orderBy: {
            slotNumber:
              "asc",
          },
        }
      );

    if (remaining.length > 0) {
      // First move all remaining assignments
      // to temporary slots.

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
                  TEMP_SLOT_BASE +
                  index,
              },
            })
        )
      );

      // Then assign compact slots 1..N.

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

    await notifyRosterUpdate({
      guildId: auth.guild.id,
      eventId: assignment.party.roster.event.id,
      rosterId: assignment.party.roster.id,
    });

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
      {
        status: 500,
      }
    );
  }
}