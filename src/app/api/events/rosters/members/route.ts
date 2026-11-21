import { NextResponse } from "next/server";

import {
  getCurrentAuth,
  hasPermission,
} from "@/lib/auth";

import { prisma } from "@/lib/prisma";
import { notifyRosterUpdate } from "@/lib/discord-notifications";
import { localDateKey } from "@/lib/events/attendance-leave-sync";

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
    const auth = await getCurrentAuth();
    if (!auth) return unauthorizedResponse();
    if (!hasPermission(auth.role, "rosters.edit")) return forbiddenResponse();

    const body = (await request.json()) as AddMemberRequest;
    if (!body.partyId) return NextResponse.json({ error: "Party ID is required." }, { status: 400 });
    if (!body.memberId) return NextResponse.json({ error: "Member ID is required." }, { status: 400 });
    if (!isValidSlot(body.slotNumber)) return NextResponse.json({ error: "Slot number must be between 1 and 5." }, { status: 400 });

    // Serialize assignment writes for this roster. The lock is acquired
    // before checking capacity, slot occupancy, or duplicate membership.
    const result = await prisma.$transaction(async (tx) => {
      const lockedRoster = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT r.id
         FROM "Roster" r
         JOIN "Event" e ON e.id = r."eventId"
         WHERE r.id = (
           SELECT rp."rosterId" FROM "RosterParty" rp WHERE rp.id = $1
         )
           AND e."guildId" = $2
         FOR UPDATE OF r`,
        body.partyId,
        auth.guild.id
      );
      if (!lockedRoster.length) return { error: "Party not found.", status: 404 as const };

      const party = await tx.rosterParty.findUnique({
        where: { id: body.partyId! },
        include: { roster: { include: { event: true } }, members: true },
      });
      if (!party || party.roster.event.guildId !== auth.guild.id) {
        return { error: "Party not found.", status: 404 as const };
      }
      if (party.members.length >= PARTY_SIZE) {
        return { error: "A party cannot contain more than 5 members.", status: 400 as const };
      }

      const member = await tx.guildMember.findFirst({
        where: { id: body.memberId!, guildId: auth.guild.id },
      });
      if (!member) return { error: "Guild member not found.", status: 404 as const };
      if (!member.active) return { error: "Inactive members cannot be assigned to a roster.", status: 400 as const };

      const eventDate = new Date(`${localDateKey(party.roster.event.date, party.roster.event.scheduleTimeZone)}T00:00:00.000Z`);
      const leave = await tx.memberLeave.findUnique({
        where: { memberId_date: { memberId: member.id, date: eventDate } },
      });
      if (leave) return { error: "This member is unavailable on the event date.", status: 400 as const };

      const participation = await tx.eventParticipation.findUnique({
        where: { eventId_memberId: { eventId: party.roster.event.id, memberId: member.id } },
      });
      if (party.roster.event.type !== "RO3_CUSTOM" && participation && !participation.available) {
        return { error: "This member is marked unavailable for this event.", status: 400 as const };
      }
      const attendance = await tx.eventAttendance.findUnique({
        where: { eventId_memberId: { eventId: party.roster.event.id, memberId: member.id } },
        select: { status: true },
      });
      if (party.roster.event.type === "RO3_CUSTOM" && attendance && attendance.status !== "AVAILABLE") {
        return { error: "Members who selected Unavailable or AFK / Busy cannot be assigned to an active RO3 party.", status: 400 as const };
      }
      if (party.roster.event.type !== "RO3_CUSTOM" && attendance && attendance.status !== "AVAILABLE") {
        return { error: "This member is not Available for this event.", status: 400 as const };
      }

      const existingAssignment = await tx.rosterMember.findFirst({
        where: { memberId: member.id, party: { rosterId: party.roster.id } },
      });
      if (existingAssignment) {
        return { error: "This member is already assigned to this roster.", status: 409 as const };
      }

      if (party.members.some((assignment) => assignment.slotNumber === body.slotNumber)) {
        return { error: "This slot is already occupied.", status: 409 as const };
      }

      const previousAssignment = await tx.rosterMember.findFirst({
        where: {
          memberId: member.id,
          party: { roster: { event: { guildId: auth.guild.id } } },
        },
        orderBy: { createdAt: "desc" },
        select: {
          guildPercentile: true,
          tankScore: true,
          tankPercentile: true,
          dpsScore: true,
          dpsPercentile: true,
          pvpScore: true,
          pvpPercentile: true,
        },
      });

      const assignment = await tx.rosterMember.create({
        data: {
          partyId: party.id,
          memberId: member.id,
          slotNumber: body.slotNumber!,
          guildPercentile: previousAssignment?.guildPercentile ?? 0,
          tankScore: previousAssignment?.tankScore ?? 0,
          tankPercentile: previousAssignment?.tankPercentile ?? 0,
          dpsScore: previousAssignment?.dpsScore ?? 0,
          dpsPercentile: previousAssignment?.dpsPercentile ?? 0,
          pvpScore: previousAssignment?.pvpScore ?? 0,
          pvpPercentile: previousAssignment?.pvpPercentile ?? 0,
        },
        include: {
          member: { select: { id: true, characterName: true, job: true, priority: true } },
        },
      });

      return { assignment, eventId: party.roster.event.id, rosterId: party.roster.id };
    }, { isolationLevel: "Serializable" });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await notifyRosterUpdate({
      guildId: auth.guild.id,
      eventId: result.eventId,
      rosterId: result.rosterId,
    });

    return NextResponse.json({ success: true, assignment: result.assignment });
  } catch (error) {
    console.error("[ROSTER MEMBERS] Failed to add member:", error);
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
    if (code === "P2002" || code === "P2034") {
      return NextResponse.json(
        { error: "The roster changed while this assignment was being saved. Refresh and try again." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add member to roster." },
      { status: 500 }
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

    if (source.party.roster.event.type === "RO3_CUSTOM") {
      const attendance = await prisma.eventAttendance.findUnique({
        where: { eventId_memberId: { eventId: source.party.roster.event.id, memberId: source.memberId } },
        select: { status: true },
      });
      if (attendance && attendance.status !== "AVAILABLE") {
        return NextResponse.json({ error: "Members who selected Unavailable or AFK / Busy cannot be assigned to an active RO3 party." }, { status: 400 });
      }
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