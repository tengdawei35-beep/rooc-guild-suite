import { NextResponse } from "next/server";

import {
  getCurrentAuth,
  hasPermission,
} from "@/lib/auth";

import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

// =============================================================
// GET EVENT
// =============================================================

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const auth =
      await getCurrentAuth();

    if (!auth) {
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

    if (
      !hasPermission(
        auth.role,
        "events.view"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to view events.",
        },
        {
          status: 403,
        }
      );
    }

    const { eventId } =
      await context.params;

    console.log(
      "[EVENT DETAIL] Requested event:",
      eventId
    );

    const canEditRosters = hasPermission(
      auth.role,
      "rosters.edit"
    );

    // ==========================================================
    // LOAD EVENT
    // ==========================================================

    const event =
      await prisma.event.findFirst({
        where: {
          id: eventId,
          guildId: auth.guild.id,
        },

        include: {
          guild: {
            select: {
              id: true,
              name: true,
            },
          },

          participations: {
            include: {
              member: {
                select: {
                  id: true,
                  userId: true,
                  characterName: true,
                  job: true,
                  active: true,
                  eligible: true,
                  priority: true,
                  remarks: true,

                  leaveDates: {
                    orderBy: {
                      date: "asc",
                    },
                  },
                },
              },
            },
          },

          rosters: {
            include: {
              parties: {
                orderBy: [
                  {
                    battlefield: "asc",
                  },
                  {
                    partyNumber: "asc",
                  },
                ],

                include: {
                  members: {
                    orderBy: {
                      slotNumber: "asc",
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
                  },
                },
              },
            },

            orderBy: {
              createdAt: "desc",
            },
          },

          allocationRuns: {
            select: {
              id: true,
              status: true,
              createdAt: true,
              completedAt: true,
            },

            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

    if (!event) {
      return NextResponse.json(
        {
          error:
            "Event not found.",
        },
        {
          status: 404,
        }
      );
    }

    // ==========================================================
    // LOAD ALL ACTIVE GUILD MEMBERS
    // ==========================================================

    const members =
      await prisma.guildMember.findMany({
        where: {
          guildId:
            auth.guild.id,
          active: true,
        },

        select: {
          id: true,
          userId: true,
          characterName: true,
          job: true,
          active: true,
          eligible: true,
          priority: true,
          remarks: true,

          leaveDates: {
            orderBy: {
              date: "asc",
            },
          },
        },

        orderBy: [
          {
            priority: "asc",
          },
          {
            characterName: "asc",
          },
        ],
      });

    // ==========================================================
    // EVENT DATE RANGE
    // ==========================================================

    const eventDateStart =
      new Date(event.date);

    const eventDateEnd =
      new Date(
        eventDateStart.getTime() +
          24 * 60 * 60 * 1000
      );

    // ==========================================================
    // BUILD PARTICIPANT LIST
    // ==========================================================

    const participationMap =
      new Map(
        event.participations.map(
          (participation) => [
            participation.memberId,
            participation,
          ]
        )
      );

    const participants =
      members.map((member) => {
        const participation =
          participationMap.get(
            member.id
          );

        const leaveEntry =
          member.leaveDates.find(
            (leave) =>
              leave.date >=
                eventDateStart &&
              leave.date <
                eventDateEnd
          );

        const onLeave =
          Boolean(leaveEntry);

        return {
          id: member.id,
          userId: member.userId,
          characterName:
            member.characterName,
          job: member.job,
          priority: member.priority,
          remarks: member.remarks,
          available:
            onLeave
              ? false
              : participation?.available ??
                true,
          onLeave,
          leaveReason:
            leaveEntry?.reason ??
            null,
          hasParticipationRecord:
            Boolean(participation),
        };
      });

    // ==========================================================
    // ROSTER VISIBILITY
    // ==========================================================
    // Roster managers need every generated roster so they can
    // compare and finalize one. Everyone else must only see the
    // explicitly finalized roster. No final roster means no
    // roster is displayed.
    // ==========================================================

    const visibleRosters =
      canEditRosters
        ? event.rosters
        : event.finalRosterId
          ? event.rosters.filter(
              (roster) =>
                roster.id ===
                event.finalRosterId
            )
          : [];

    return NextResponse.json({
      event: {
        id: event.id,
        guildId: event.guildId,
        type: event.type,
        date: event.date,
        finalRosterId:
          event.finalRosterId,
        guild: event.guild,
      },

      participants,

      permissions: {
        canManageEvents:
          hasPermission(
            auth.role,
            "events.manage"
          ),

        canEditRosters,
      },

      rosters:
        visibleRosters.map(
          (roster) => ({
            id: roster.id,
            name: roster.name,
            generationMode:
              roster.generationMode,
            partyCount:
              roster.parties.length,
            memberCount:
              roster.parties.reduce(
                (sum, party) =>
                  sum +
                  party.members.length,
                0
              ),
            createdAt:
              roster.createdAt,
            updatedAt:
              roster.updatedAt,
            parties:
              roster.parties.map(
                (party) => ({
                  id: party.id,
                  partyNumber:
                    party.partyNumber,
                  battlefield:
                    party.battlefield,
                  members:
                    party.members.map(
                      (assignment) => ({
                        id:
                          assignment.id,
                        slotNumber:
                          assignment.slotNumber,
                        member: {
                          id:
                            assignment.member.id,
                          characterName:
                            assignment.member
                              .characterName,
                          job:
                            assignment.member.job,
                          priority:
                            assignment.member
                              .priority,
                        },
                      })
                    ),
                })
              ),
          })
        ),

      allocationRuns:
        event.allocationRuns,

      stats: {
        totalMembers:
          members.length,
        availableMembers:
          participants.filter(
            (member) =>
              member.available
          ).length,
        unavailableMembers:
          participants.filter(
            (member) =>
              !member.available
          ).length,
        onLeaveMembers:
          participants.filter(
            (member) =>
              member.onLeave
          ).length,
        rosterCount:
          event.rosters.length,
        allocationRunCount:
          event.allocationRuns.length,
      },
    });
  } catch (error) {
    console.error(
      "[EVENT DETAIL GET]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load event.",
      },
      {
        status: 500,
      }
    );
  }
}

// =============================================================
// UPDATE EVENT PARTICIPATION
// =============================================================

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const auth =
      await getCurrentAuth();

    if (!auth) {
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

    if (
      !hasPermission(
        auth.role,
        "events.view"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to update event participation.",
        },
        {
          status: 403,
        }
      );
    }

    const { eventId } =
      await context.params;

    const event =
      await prisma.event.findFirst({
        where: {
          id: eventId,
          guildId: auth.guild.id,
        },
        select: {
          id: true,
          guildId: true,
        },
      });

    if (!event) {
      return NextResponse.json(
        {
          error: "Event not found.",
        },
        {
          status: 404,
        }
      );
    }

    const body =
      await request.json();

    const memberId =
      typeof body.memberId ===
      "string"
        ? body.memberId
        : "";

    const available =
      typeof body.available ===
      "boolean"
        ? body.available
        : null;

    if (!memberId || available === null) {
      return NextResponse.json(
        {
          error:
            "memberId and available are required.",
        },
        {
          status: 400,
        }
      );
    }

    const member =
      await prisma.guildMember.findFirst({
        where: {
          id: memberId,
          guildId: auth.guild.id,
          active: true,
        },
        select: {
          id: true,
        },
      });

    if (!member) {
      return NextResponse.json(
        {
          error:
            "Member not found.",
        },
        {
          status: 404,
        }
      );
    }

    await prisma.eventParticipation.upsert({
      where: {
        eventId_memberId: {
          eventId: event.id,
          memberId: member.id,
        },
      },
      create: {
        eventId: event.id,
        memberId: member.id,
        available,
      },
      update: {
        available,
      },
    });

    return NextResponse.json({
      success: true,
      eventId: event.id,
      memberId: member.id,
      available,
    });
  } catch (error) {
    console.error(
      "[EVENT DETAIL PATCH]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update event participation.",
      },
      {
        status: 500,
      }
    );
  }
}
