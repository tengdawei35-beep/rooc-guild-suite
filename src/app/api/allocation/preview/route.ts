import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import {
  getCurrentAuth,
} from "@/lib/auth";

import {
  hasPermission,
} from "@/lib/permissions";

import {
  hasGuildModule,
  RESOURCE_SUITE_MODULE,
} from "@/lib/auth/modules";

import {
  buildAllocation,
} from "@/lib/allocation/engine";

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

    if (!(await hasGuildModule(auth.guild.id, RESOURCE_SUITE_MODULE))) {
      return NextResponse.json(
        {
          error:
            "The Resource Suite is not subscribed for this guild.",
        },
        {
          status: 403,
        }
      );
    }

    // ==========================================================
    // PERMISSION
    // ==========================================================
    //
    // Previewing an allocation does not persist anything,
    // but it still exposes guild allocation information.
    //
    // Therefore the caller needs allocation.view.
    //
    // ==========================================================

    if (
      !hasPermission(
        auth.role,
        "allocation.view"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to view allocation information.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      await request.json();

    const eventId =
      body.eventId;

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
        {
          status: 400,
        }
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
        {
          status: 400,
        }
      );
    }

    // ==========================================================
    // LOAD EVENT
    // ==========================================================

    const event =
      await prisma.event.findFirst({
        where: {
          id: eventId,
          guildId:
            auth.guild.id,
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
          error:
            "Event not found.",
        },
        {
          status: 404,
        }
      );
    }

    const preview =
      await buildAllocation({
        guildId:
          auth.guild.id,
        nonReservedMemberCount,
        eventDate:
          event.date,
      });

    return NextResponse.json({
      preview,
      event: {
        id:
          event.id,
        guildId:
          event.guildId,
        type:
          event.type,
        date:
          event.date,
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
      {
        status: 500,
      }
    );
  }
}