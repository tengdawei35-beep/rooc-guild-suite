import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const { eventId } =
      await context.params;

    console.log(
      "[EVENT DETAIL] Requested event:",
      eventId
    );

    // ==========================================================
    // LOAD EVENT
    // ==========================================================

    const event =
      await prisma.event.findUnique({
        where: {
          id: eventId,
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
                  displayName: true,
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

          // ======================================================
          // ROSTERS
          // ======================================================

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
                          displayName: true,
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

          // ======================================================
          // ALLOCATION RUNS
          // ======================================================

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

    // ==========================================================
    // EVENT NOT FOUND
    // ==========================================================

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

    // ==========================================================
    // LOAD ALL ACTIVE GUILD MEMBERS
    // ==========================================================

    const members =
      await prisma.guildMember.findMany({
        where: {
          guildId: event.guildId,
          active: true,
        },

        select: {
          id: true,
          displayName: true,
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
            displayName: "asc",
          },
        ],
      });

    // ==========================================================
    // EVENT DATE RANGE
    // ==========================================================
    //
    // Event dates are stored as UTC+7 midnight.
    //
    // Example:
    //
    // Tuesday 00:00 UTC+7
    // =
    // Monday 17:00 UTC
    //
    // event.date is therefore already the beginning of the
    // UTC+7 event day when interpreted as a database timestamp.
    //
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

        // Leave is checked against the same event date range.
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

          displayName:
            member.displayName,

          characterName:
            member.characterName,

          job: member.job,

          priority:
            member.priority,

          remarks:
            member.remarks,

          // Leave always takes precedence over availability.
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
    // RETURN EVENT
    // ==========================================================

    return NextResponse.json({
      event: {
        id: event.id,

        guildId:
          event.guildId,

        type: event.type,

        date: event.date,

        guild: event.guild,
      },

      // ========================================================
      // PARTICIPANTS
      // ========================================================

      participants,

      // ========================================================
      // ROSTERS
      // ========================================================

      rosters:
        event.rosters.map(
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
                            assignment
                              .member
                              .id,

                          displayName:
                            assignment
                              .member
                              .displayName,

                          characterName:
                            assignment
                              .member
                              .characterName,

                          job:
                            assignment
                              .member
                              .job,

                          priority:
                            assignment
                              .member
                              .priority,
                        },
                      })
                    ),
                })
              ),
          })
        ),

      // ========================================================
      // ALLOCATION RUNS
      // ========================================================

      allocationRuns:
        event.allocationRuns,

      // ========================================================
      // STATS
      // ========================================================

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
// PATCH EVENT PARTICIPATION
// =============================================================

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const { eventId } =
      await context.params;

    const body =
      await request.json();

    // ==========================================================
    // VALIDATE MEMBER ID
    // ==========================================================

    if (
      typeof body.memberId !==
      "string"
    ) {
      return NextResponse.json(
        {
          error:
            "memberId is required.",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================================
    // VALIDATE AVAILABILITY
    // ==========================================================

    if (
      typeof body.available !==
      "boolean"
    ) {
      return NextResponse.json(
        {
          error:
            "available must be a boolean.",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================================
    // LOAD EVENT
    // ==========================================================

    const event =
      await prisma.event.findUnique({
        where: {
          id: eventId,
        },

        select: {
          id: true,
          guildId: true,
          date: true,
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

    // ==========================================================
    // LOAD MEMBER
    // ==========================================================

    const member =
      await prisma.guildMember.findFirst({
        where: {
          id: body.memberId,

          guildId:
            event.guildId,

          active: true,
        },

        select: {
          id: true,

          leaveDates: {
            orderBy: {
              date: "asc",
            },
          },
        },
      });

    if (!member) {
      return NextResponse.json(
        {
          error:
            "Active guild member not found.",
        },
        {
          status: 404,
        }
      );
    }

    // ==========================================================
    // CHECK EVENT-DATE LEAVE
    // ==========================================================

    const eventDateStart =
      new Date(event.date);

    const eventDateEnd =
      new Date(
        eventDateStart.getTime() +
          24 * 60 * 60 * 1000
      );

    const onLeave =
      member.leaveDates.some(
        (leave) =>
          leave.date >=
            eventDateStart &&
          leave.date <
            eventDateEnd
      );

    // ==========================================================
    // LEAVE OVERRIDES AVAILABILITY
    // ==========================================================

    if (onLeave) {
      return NextResponse.json(
        {
          error:
            "This member is on leave for the event date and cannot be marked available.",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================================
    // SAVE PARTICIPATION
    // ==========================================================

    const participation =
      await prisma.eventParticipation.upsert(
        {
          where: {
            eventId_memberId: {
              eventId,

              memberId:
                body.memberId,
            },
          },

          create: {
            eventId,

            memberId:
              body.memberId,

            available:
              body.available,
          },

          update: {
            available:
              body.available,
          },
        }
      );

    return NextResponse.json({
      participation,
    });
  } catch (error) {
    console.error(
      "[EVENT PARTICIPATION PATCH]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update participation.",
      },
      {
        status: 500,
      }
    );
  }
}