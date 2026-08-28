import { NextResponse } from "next/server";
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
    const { eventId } =
      await context.params;

    const event =
      await prisma.event.findUnique({
        where: {
          id: eventId,
        },

        include: {
          rosters: {
            orderBy: {
              createdAt: "desc",
            },

            take: 1,

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
                  },
                },
              },
            },
          },
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

    // ----------------------------------------------------------
    // Replace existing preferred roster
    // ----------------------------------------------------------

    const preferred =
      await prisma.$transaction(
        async (tx) => {
          const existing =
            await tx.preferredRoster.findUnique({
              where: {
                guildId_type: {
                  guildId:
                    event.guildId,

                  type:
                    event.type,
                },
              },
            });

          if (existing) {
            await tx.preferredRoster.delete({
              where: {
                id: existing.id,
              },
            });
          }

          return tx.preferredRoster.create({
            data: {
              guildId:
                event.guildId,

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
                            (member) => ({
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
                  members: true,
                },
              },
            },
          });
        }
      );

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