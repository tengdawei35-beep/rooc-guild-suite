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

export async function POST(
  _request: Request,
  context: RouteContext
) {
  try {
    // =========================================================
    // AUTHENTICATION
    // =========================================================

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

    // =========================================================
    // PERMISSION
    // =========================================================
    //
    // Saving a preferred roster changes guild configuration.
    // Only roles with rosters.edit may perform this action.
    //
    // Current role mapping:
    //
    // ADMIN   -> allowed
    // MANAGER -> allowed
    // OFFICER -> allowed
    // MEMBER  -> denied
    //
    // =========================================================

    if (
      !hasPermission(
        auth.role,
        "rosters.edit"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to manage preferred rosters.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      eventId,
    } = await context.params;

    // =========================================================
    // LOAD EVENT
    // =========================================================
    //
    // IMPORTANT:
    // Restrict the lookup to the authenticated guild.
    // This prevents a user from saving a preferred roster
    // against an event belonging to another guild.
    //
    // =========================================================

    const event =
      await prisma.event.findFirst({
        where: {
          id: eventId,

          guildId:
            auth.guild.id,
        },

        include: {
          rosters: {
            orderBy: {
              createdAt:
                "desc",
            },

            take: 1,

            include: {
              parties: {
                orderBy: [
                  {
                    battlefield:
                      "asc",
                  },
                  {
                    partyNumber:
                      "asc",
                  },
                ],

                include: {
                  members: {
                    orderBy: {
                      slotNumber:
                        "asc",
                    },
                  },
                },
              },
            },
          },
        },
      });

    // =========================================================
    // EVENT NOT FOUND
    // =========================================================

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

    // =========================================================
    // FIND LATEST ROSTER
    // =========================================================

    const roster =
      event.rosters[0];

    if (!roster) {
      return NextResponse.json(
        {
          error:
            "This event does not have a roster to save.",
        },
        {
          status: 400,
        }
      );
    }

    // =========================================================
    // VALIDATE ROSTER MEMBERS
    // =========================================================
    //
    // The roster should already be guild-scoped through its
    // event, but validate the member IDs before copying them
    // into the preferred roster as an additional integrity
    // check.
    //
    // =========================================================

    const memberIds =
      roster.parties.flatMap(
        (party) =>
          party.members.map(
            (member) =>
              member.memberId
          )
      );

    if (
      memberIds.length > 0
    ) {
      const uniqueMemberIds =
        Array.from(
          new Set(memberIds)
        );

      const guildMembers =
        await prisma.guildMember.findMany(
          {
            where: {
              id: {
                in:
                  uniqueMemberIds,
              },

              guildId:
                auth.guild.id,
            },

            select: {
              id: true,
            },
          }
        );

      const validMemberIds =
        new Set(
          guildMembers.map(
            (member) =>
              member.id
          )
        );

      const hasInvalidMember =
        uniqueMemberIds.some(
          (memberId) =>
            !validMemberIds.has(
              memberId
            )
        );

      if (hasInvalidMember) {
        return NextResponse.json(
          {
            error:
              "The roster contains a member that does not belong to this guild.",
          },
          {
            status: 400,
          }
        );
      }
    }

    // =========================================================
    // REPLACE EXISTING PREFERRED ROSTER
    // =========================================================

    const preferred =
      await prisma.$transaction(
        async (tx) => {
          // ---------------------------------------------------
          // DELETE EXISTING PREFERRED ROSTER
          // ---------------------------------------------------

          const existing =
            await tx.preferredRoster.findUnique(
              {
                where: {
                  guildId_type: {
                    guildId:
                      auth.guild.id,

                    type:
                      event.type,
                  },
                },
              }
            );

          if (existing) {
            await tx.preferredRoster.delete(
              {
                where: {
                  id:
                    existing.id,
                },
              }
            );
          }

          // ---------------------------------------------------
          // CREATE NEW PREFERRED ROSTER
          // ---------------------------------------------------

          return tx.preferredRoster.create(
            {
              data: {
                guildId:
                  auth.guild.id,

                type:
                  event.type,

                parties: {
                  create:
                    roster.parties.map(
                      (party) => ({
                        battlefield:
                          party.battlefield,

                        partyNumber:
                          party.partyNumber,

                        members: {
                          create:
                            party.members.map(
                              (
                                member
                              ) => ({
                                memberId:
                                  member.memberId,

                                slotNumber:
                                  member.slotNumber,
                              })
                            ),
                        },
                      })
                    ),
                },
              },

              include: {
                parties: {
                  include: {
                    members:
                      true,
                  },
                },
              },
            }
          );
        }
      );

    // =========================================================
    // SUCCESS
    // =========================================================

    return NextResponse.json({
      success: true,

      preferredRoster:
        preferred,
    });
  } catch (error) {
    console.error(
      "[PREFERRED ROSTER] Failed to save:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save preferred roster.",
      },
      {
        status: 500,
      }
    );
  }
}