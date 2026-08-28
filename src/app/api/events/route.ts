import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type EventType =
  | "GUILD_LEAGUE"
  | "EMPERIUM_OVERRUN";

function normalizeDate(
  value: string
): Date | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }

  const [year, month, day] =
    value.split("-").map(Number);

  // Event dates are calendar dates in UTC+7.
  //
  // 2026-09-01 00:00 UTC+7
  // = 2026-08-31 17:00 UTC
  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      -7
    )
  );

  // Validate the supplied calendar date.
  const check = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !==
      month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function getEventRule(
  type: EventType
) {
  if (
    type ===
    "GUILD_LEAGUE"
  ) {
    return {
      allowedDays: [2, 4],
      label: "Guild League",
    };
  }

  return {
    allowedDays: [0],
    label: "Emperium Overrun",
  };
}

function validateEventDate(
  type: EventType,
  date: Date
): string | null {
  const rule =
    getEventRule(type);

  // Event dates are stored at 00:00 UTC+7.
  // Convert the stored timestamp back
  // into UTC+7 before determining the
  // calendar weekday.
  const utcPlus7Date =
    new Date(
      date.getTime() +
        7 * 60 * 60 * 1000
    );

  const day =
    utcPlus7Date.getUTCDay();

  if (
    !rule.allowedDays.includes(
      day
    )
  ) {
    if (
      type ===
      "GUILD_LEAGUE"
    ) {
      return "Guild League events can only be created on Tuesdays or Thursdays.";
    }

    return "Emperium Overrun events can only be created on Sundays.";
  }

  return null;
}

// =============================================================
// GET EVENTS + PREFERRED ROSTERS
// =============================================================

export async function GET() {
  try {
    const guild =
      await prisma.guild.findFirst({
        select: {
          id: true,
        },
      });

    if (!guild) {
      return NextResponse.json(
        {
          error:
            "No guild has been configured.",
        },
        { status: 404 }
      );
    }

    // ---------------------------------------------------------
    // EVENTS
    // ---------------------------------------------------------

    const events =
      await prisma.event.findMany({
        where: {
          guildId: guild.id,
        },

        orderBy: [
          {
            date: "desc",
          },
          {
            createdAt: "desc",
          },
        ],

        include: {
          _count: {
            select: {
              participations: true,
              rosters: true,
              allocationRuns: true,
            },
          },
        },
      });

    // ---------------------------------------------------------
    // PREFERRED ROSTERS
    //
    // These belong to the guild and event type,
    // not to an individual event.
    // ---------------------------------------------------------

    const preferredRosters =
      await prisma.preferredRoster.findMany(
        {
          where: {
            guildId: guild.id,
          },

          select: {
            id: true,
            guildId: true,
            type: true,
            createdAt: true,
            updatedAt: true,

            _count: {
              select: {
                parties: true,
              },
            },
          },

          orderBy: {
            type: "asc",
          },
        }
      );

    return NextResponse.json({
      events: events.map(
        (event) => ({
          id: event.id,
          guildId:
            event.guildId,
          type: event.type,
          date: event.date,

          participationCount:
            event._count
              .participations,

          rosterCount:
            event._count
              .rosters,

          allocationRunCount:
            event._count
              .allocationRuns,
        })
      ),

      preferredRosters:
        preferredRosters.map(
          (preferred) => ({
            id:
              preferred.id,

            guildId:
              preferred.guildId,

            type:
              preferred.type,

            partyCount:
              preferred._count
                .parties,

            createdAt:
              preferred.createdAt,

            updatedAt:
              preferred.updatedAt,
          })
        ),
    });
  } catch (error) {
    console.error(
      "[EVENTS GET]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load events.",
      },
      { status: 500 }
    );
  }
}

// =============================================================
// CREATE EVENT
// =============================================================

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const type =
      body.type as EventType;

    const date =
      normalizeDate(
        body.date
      );

    // ---------------------------------------------------------
    // VALIDATE TYPE
    // ---------------------------------------------------------

    if (
      type !==
        "GUILD_LEAGUE" &&
      type !==
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

    // ---------------------------------------------------------
    // VALIDATE DATE
    // ---------------------------------------------------------

    if (!date) {
      return NextResponse.json(
        {
          error:
            "A valid event date is required.",
        },
        { status: 400 }
      );
    }

    const dateError =
      validateEventDate(
        type,
        date
      );

    if (dateError) {
      return NextResponse.json(
        {
          error: dateError,
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // GUILD
    // ---------------------------------------------------------

    const guild =
      await prisma.guild.findFirst({
        select: {
          id: true,
        },
      });

    if (!guild) {
      return NextResponse.json(
        {
          error:
            "No guild has been configured.",
        },
        { status: 404 }
      );
    }

    // ---------------------------------------------------------
    // DUPLICATE EVENT
    // ---------------------------------------------------------

    const existing =
      await prisma.event.findUnique({
        where: {
          guildId_type_date: {
            guildId:
              guild.id,

            type,

            date,
          },
        },
      });

    if (existing) {
      return NextResponse.json(
        {
          error:
            "An event of this type already exists for this date.",
        },
        { status: 409 }
      );
    }

    // ---------------------------------------------------------
    // CREATE
    // ---------------------------------------------------------

    const event =
      await prisma.event.create({
        data: {
          guildId:
            guild.id,

          type,

          date,
        },
      });

    return NextResponse.json(
      {
        event: {
          id: event.id,
          guildId:
            event.guildId,
          type:
            event.type,
          date:
            event.date,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "[EVENTS POST]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create event.",
      },
      { status: 500 }
    );
  }
}