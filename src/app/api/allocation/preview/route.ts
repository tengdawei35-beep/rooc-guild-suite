import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildAllocation } from "@/lib/allocation/engine";

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const eventId = body.eventId;

    const nonReservedMemberCount =
      Number(
        body.nonReservedMemberCount
      );

    // ==========================================================
    // VALIDATE EVENT
    // ==========================================================

    if (
      typeof eventId !== "string" ||
      eventId.trim().length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "An event must be selected before generating an allocation preview.",
        },
        { status: 400 }
      );
    }

    // ==========================================================
    // VALIDATE MEMBER COUNT
    // ==========================================================

    if (
      !Number.isInteger(
        nonReservedMemberCount
      ) ||
      nonReservedMemberCount < 0
    ) {
      return NextResponse.json(
        {
          error:
            "nonReservedMemberCount must be a non-negative integer.",
        },
        { status: 400 }
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
          type: true,
          date: true,
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

    // ==========================================================
    // BUILD ALLOCATION PREVIEW
    // ==========================================================
    //
    // The event date is passed into the allocation engine.
    //
    // This means members with a MemberLeave entry matching
    // this event date are excluded from the bidding pool.
    //
    // ==========================================================

    const preview =
      await buildAllocation({
        nonReservedMemberCount,

        eventDate: event.date,
      });

    // ==========================================================
    // VERIFY EVENT / GUILD
    // ==========================================================

    if (
      preview.guildId !== event.guildId
    ) {
      return NextResponse.json(
        {
          error:
            "Event does not belong to the configured guild.",
        },
        { status: 400 }
      );
    }

    // ==========================================================
    // RESPONSE
    // ==========================================================

    return NextResponse.json({
      preview,

      event: {
        id: event.id,
        guildId: event.guildId,
        type: event.type,
        date: event.date,
      },
    });
  } catch (error) {
    console.error(
      "[ALLOCATION PREVIEW]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to build allocation preview.",
      },
      { status: 500 }
    );
  }
}