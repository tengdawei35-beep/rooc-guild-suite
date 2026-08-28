import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuth, hasPermission } from "@/lib/auth";

const EVENT_LIMITS = {
  GUILD_LEAGUE: {
    playersPerBattlefield: 40,
    battlefields: 2,
    partiesPerBattlefield: 8,
  },
  EMPERIUM_OVERRUN: {
    playersPerBattlefield: 80,
    battlefields: 1,
    partiesPerBattlefield: 16,
  },
} as const;

type EventType =
  | "GUILD_LEAGUE"
  | "EMPERIUM_OVERRUN";

type GenerationMode =
  | "MANUAL"
  | "AUTOMATIC";

type CreateRosterRequest = {
  eventId?: string;
  name?: string;
  generationMode?: GenerationMode;
};

type CreateEventRequest = {
  type?: EventType;
  date?: string;
};

// =============================================================
// CREATE EVENT
// =============================================================

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as
        | CreateRosterRequest
        | CreateEventRequest;

    const auth = await getCurrentAuth();

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    /*
     * This endpoint accepts event creation when
     * `type` is supplied, and roster creation when
     * `eventId` is supplied.
     *
     * The guild is always taken from the authenticated
     * session; it is never selected from the database by
     * findFirst() or supplied by the client.
     */

    if (
      "type" in body &&
      body.type
    ) {
      if (!hasPermission(auth.role, "events.manage")) {
        return NextResponse.json(
          { error: "You do not have permission to manage events." },
          { status: 403 }
        );
      }

      return createEvent(
        auth.guild.id,
        body as CreateEventRequest
      );
    }

    if (
      "eventId" in body &&
      body.eventId
    ) {
      if (!hasPermission(auth.role, "rosters.edit")) {
        return NextResponse.json(
          { error: "You do not have permission to edit rosters." },
          { status: 403 }
        );
      }

      return createRoster(
        auth.guild.id,
        body as CreateRosterRequest
      );
    }

    return NextResponse.json(
      {
        error:
          "Event type or event ID is required.",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error(
      "[EVENTS] Failed to create:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to create event or roster.",
      },
      { status: 500 }
    );
  }
}

// =============================================================
// CREATE EVENT
// =============================================================

async function createEvent(
  guildId: string,
  body: CreateEventRequest
) {
  if (
    body.type !==
      "GUILD_LEAGUE" &&
    body.type !==
      "EMPERIUM_OVERRUN"
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid event type.",
      },
      { status: 400 }
    );
  }

  if (!body.date) {
    return NextResponse.json(
      {
        error: "Event date is required.",
      },
      { status: 400 }
    );
  }

  const date = new Date(
    `${body.date}T00:00:00.000Z`
  );

  if (Number.isNaN(date.getTime())) {
    return NextResponse.json(
      {
        error: "Invalid event date.",
      },
      { status: 400 }
    );
  }

  const existing =
    await prisma.event.findUnique({
      where: {
        guildId_type_date: {
          guildId,
          type: body.type,
          date,
        },
      },
    });

  if (existing) {
    return NextResponse.json(
      {
        error:
          "An event of this type already exists on this date.",
      },
      { status: 409 }
    );
  }

  const event =
    await prisma.event.create({
      data: {
        guildId,
        type: body.type,
        date,
      },
    });

  return NextResponse.json({
    event,
  });
}

// =============================================================
// CREATE ROSTER
// =============================================================

async function createRoster(
  guildId: string,
  body: CreateRosterRequest
) {
  if (!body.eventId) {
    return NextResponse.json(
      {
        error: "Event ID is required.",
      },
      { status: 400 }
    );
  }

  if (
    body.generationMode !==
      "MANUAL" &&
    body.generationMode !==
      "AUTOMATIC"
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid roster generation mode.",
      },
      { status: 400 }
    );
  }

  const name =
    body.name?.trim();

  if (!name) {
    return NextResponse.json(
      {
        error:
          "Roster name is required.",
      },
      { status: 400 }
    );
  }

  const event =
    await prisma.event.findFirst({
      where: {
        id: body.eventId,
        guildId,
      },
    });

  if (!event) {
    return NextResponse.json(
      {
        error: "Event not found.",
      },
      { status: 404 }
    );
  }

  const roster =
    await prisma.roster.create({
      data: {
        eventId: event.id,
        name,
        generationMode:
          body.generationMode,
      },
    });

  return NextResponse.json({
    roster,
  });
}

// =============================================================
// GET EVENTS / ROSTERS
// =============================================================

export async function GET() {
  try {
    const auth = await getCurrentAuth();

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (!hasPermission(auth.role, "events.view")) {
      return NextResponse.json(
        { error: "You do not have permission to view events." },
        { status: 403 }
      );
    }

    const events =
      await prisma.event.findMany({
        where: {
          guildId: auth.guild.id,
        },

        orderBy: {
          date: "desc",
        },

        include: {
          participations: {
            include: {
              member: {
                select: {
                  id: true,
                  characterName: true,
                  job: true,
                  active: true,
                  eligible: true,
                },
              },
            },
          },

          rosters: {
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

                    include: {
                      member: {
                        select: {
                          id: true,
                          characterName: true,
                          job: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

    return NextResponse.json({
      events,
    });
  } catch (error) {
    console.error(
      "[EVENTS] Failed to fetch:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to fetch events.",
      },
      { status: 500 }
    );
  }
}