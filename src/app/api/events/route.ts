import {
  NextResponse,
} from "next/server";

import {
  getCurrentAuth,
} from "@/lib/auth";

import {
  hasGuildModule,
  isRoocGuild,
  RESOURCE_SUITE_MODULE,
} from "@/lib/auth/modules";

import {
  hasPermission,
} from "@/lib/permissions";

import {
  prisma,
} from "@/lib/prisma";

import { sendEventAttendanceMessage } from "@/lib/discord-event-attendance";

type EventType =
  | "GUILD_LEAGUE"
  | "EMPERIUM_OVERRUN"
  | "RO3_CUSTOM";

// =============================================================
// DATE NORMALIZATION
// =============================================================

function normalizeDate(
  value: string
): Date | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return null;
  }

  const [
    year,
    month,
    day,
  ] =
    value
      .split("-")
      .map(Number);

  // Event dates are calendar dates in UTC+7.
  //
  // 2026-09-01 00:00 UTC+7
  // = 2026-08-31 17:00 UTC

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        -7
      )
    );

  // Validate the supplied calendar date.

  const check =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    check.getUTCFullYear() !==
      year ||
    check.getUTCMonth() !==
      month - 1 ||
    check.getUTCDate() !==
      day
  ) {
    return null;
  }

  return date;
}


function localDateTimeToUtc(dateValue: string, timeValue: string, timeZone: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)) return null;
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (calendarCheck.getUTCFullYear() !== year || calendarCheck.getUTCMonth() !== month - 1 || calendarCheck.getUTCDate() !== day) return null;
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    });
    for (let i = 0; i < 3; i++) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type, part.value]));
      const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
      guess += target - represented;
    }
    const finalParts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type, part.value]));
    if (Number(finalParts.year) !== year || Number(finalParts.month) !== month || Number(finalParts.day) !== day || Number(finalParts.hour) !== hour || Number(finalParts.minute) !== minute) return null;
    return new Date(guess);
  } catch {
    return null;
  }
}

// =============================================================
// EVENT RULES
// =============================================================

function getEventRule(
  type: EventType
) {
  if (
    type ===
    "GUILD_LEAGUE"
  ) {
    return {
      allowedDays: [
        2,
        4,
      ],

      label:
        "Guild League",
    };
  }

  return {
    allowedDays: [0],

    label:
      "Emperium Overrun",
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
        7 *
          60 *
          60 *
          1000
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

export async function GET(request: Request) {
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

    const canViewEvents =
      hasPermission(
        auth.role,
        "events.view"
      );

    const canViewRosters =
      hasPermission(
        auth.role,
        "rosters.view"
      );

    if (
      !canViewEvents &&
      !canViewRosters
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

    // ---------------------------------------------------------
    // EVENTS
    // ---------------------------------------------------------

    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const pageSize = 30;
    const cursorEvent = cursor && canViewEvents
      ? await prisma.event.findFirst({
          where: { id: cursor, guildId: auth.guild.id },
          select: { id: true, date: true, createdAt: true },
        })
      : null;
    if (cursor && canViewEvents && !cursorEvent) {
      return NextResponse.json({ error: "The event list changed. Refresh the page and try again." }, { status: 400 });
    }

    const eventRows = canViewEvents
      ? await prisma.event.findMany({
          where: {
            guildId: auth.guild.id,
            ...(cursorEvent ? {
              OR: [
                { date: { lt: cursorEvent.date } },
                { date: cursorEvent.date, createdAt: { lt: cursorEvent.createdAt } },
                { date: cursorEvent.date, createdAt: cursorEvent.createdAt, id: { lt: cursorEvent.id } },
              ],
            } : {}),
          },
          take: pageSize + 1,
          orderBy: [
            { date: "desc" },
            { createdAt: "desc" },
            { id: "desc" },
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
        })
      : [];
    const hasMoreEvents = eventRows.length > pageSize;
    const events = eventRows.slice(0, pageSize);
    const nextCursor = hasMoreEvents ? events[events.length - 1]?.id ?? null : null;

    const preferredRosters =
      !cursor && canViewRosters
        ? await prisma.preferredRoster.findMany(
            {
              where: {
                guildId:
                  auth.guild.id,
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
          )
        : [];

    return NextResponse.json({
      nextCursor,
      events:
        events.map(
          (event) => ({
            id:
              event.id,

            guildId:
              event.guildId,

            type:
              event.type,

            eventTypeName: event.eventTypeName,
            guildEventTypeId: event.guildEventTypeId,
            scheduleTimeZone: event.scheduleTimeZone,

            date:
              event.date,

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

      preferredRosters: cursor ? undefined :
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
      {
        status: 500,
      }
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
        "events.manage"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to create events.",
        },
        {
          status: 403,
        }
      );
    }

    const body = await request.json();
    const isRo3 = !(await isRoocGuild(auth.guild.id));
    let date = normalizeDate(body.date);
    if (!date) return NextResponse.json({ error: "A valid event date is required." }, { status: 400 });
    let type: EventType = body.type as EventType;
    let guildEventTypeId: string | null = null;
    let eventTypeName: string | null = null;
    let battlefieldCount: number | null = null;
    let partiesPerBattlefield: number | null = null;
    let scheduleTimeZone: string | null = null;
    let ro3EventTypeId: string | null = null;
    if (isRo3) {
      guildEventTypeId = typeof body.guildEventTypeId === "string" ? body.guildEventTypeId : "";
      if (!guildEventTypeId) return NextResponse.json({ error: "Select a configured event type." }, { status: 400 });
      const configured = await prisma.guildEventType.findFirst({ where: { id: guildEventTypeId, guildId: auth.guild.id, active: true } });
      if (!configured) return NextResponse.json({ error: "That event type is no longer active." }, { status: 400 });
      const [year, month, day] = (body.date as string).split("-").map(Number);
      const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      if (!configured.weekdays.includes(weekday)) return NextResponse.json({ error: "This event type is not scheduled for the selected weekday." }, { status: 400 });
      const scheduledDate = localDateTimeToUtc(body.date, configured.startTime, configured.timeZone);
      if (!scheduledDate) return NextResponse.json({ error: "The selected local date/time is invalid in this event type timezone." }, { status: 400 });
      date = scheduledDate;
      type = "RO3_CUSTOM";
      eventTypeName = configured.name;
      battlefieldCount = configured.battlefieldCount;
      partiesPerBattlefield = configured.partiesPerBattlefield;
      scheduleTimeZone = configured.timeZone;
      const requestedResourceTypeId = typeof body.ro3EventTypeId === "string" && body.ro3EventTypeId ? body.ro3EventTypeId : null;
      if (requestedResourceTypeId) {
        if (!(await hasGuildModule(auth.guild.id, RESOURCE_SUITE_MODULE))) return NextResponse.json({ error: "The Resource Suite is not subscribed for this guild." }, { status: 403 });
        const rewardType = await prisma.ro3EventType.findFirst({ where: { id: requestedResourceTypeId, guildId: auth.guild.id, active: true, guildEventTypeId, season: { is: { guildId: auth.guild.id, status: "ACTIVE" } } }, select: { id: true } });
        if (!rewardType) return NextResponse.json({ error: "The selected resource reward configuration does not match this event type in the active Resources pool." }, { status: 400 });
        ro3EventTypeId = requestedResourceTypeId;
      }
    } else {
      if (body.type !== "GUILD_LEAGUE" && body.type !== "EMPERIUM_OVERRUN") return NextResponse.json({ error: "Invalid event type." }, { status: 400 });
      type = body.type as EventType;
      const dateError = validateEventDate(type, date);
      if (dateError) return NextResponse.json({ error: dateError }, { status: 400 });
    }

    // ---------------------------------------------------------
    // DUPLICATE EVENT
    // ---------------------------------------------------------

    const existing =
      await prisma.event.findFirst({
        where: {
          guildId: auth.guild.id,
          type,
          date,
          ...(isRo3 ? { guildEventTypeId } : { ro3EventTypeId: null }),
        },
      });

    if (existing) {
      return NextResponse.json(
        {
          error:
            "An event of this type already exists for this date.",
        },
        {
          status: 409,
        }
      );
    }

    // ---------------------------------------------------------
    // CREATE
    // ---------------------------------------------------------

    const event =
      await prisma.event.create(
        {
          data: {
            guildId:
              auth.guild.id,

            type,

            date,

            ro3EventTypeId,
            guildEventTypeId,
            eventTypeName,
            battlefieldCount,
            partiesPerBattlefield,
            scheduleTimeZone,
          },
        }
      );

    try { await sendEventAttendanceMessage(event.id); }
    catch (discordError) { console.error("[EVENTS] Discord attendance message could not be posted:", discordError); }

    return NextResponse.json(
      {
        event: {
          id:
            event.id,

          guildId:
            event.guildId,

          type:
            event.type,

          date:
            event.date,
          eventTypeName: event.eventTypeName,
          guildEventTypeId: event.guildEventTypeId,
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
      {
        status: 500,
      }
    );
  }
}