import { NextResponse } from "next/server";

import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { notifyRosterUpdate } from "@/lib/discord-notifications";

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
    const auth = await getCurrentAuth();

    if (!auth?.guild?.id) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (!hasPermission(auth.role, "rosters.edit")) {
      return NextResponse.json(
        { error: "You do not have permission to save rosters." },
        { status: 403 }
      );
    }

    const { eventId } = await context.params;

    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        guildId: auth.guild.id,
      },
      select: {
        id: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found." },
        { status: 404 }
      );
    }

    const roster = await prisma.roster.findFirst({
      where: {
        eventId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
      },
    });

    if (!roster) {
      return NextResponse.json(
        { error: "No roster found for this event." },
        { status: 404 }
      );
    }

    const eventUrl = new URL(`/events/${eventId}`, _request.url).toString();

    await notifyRosterUpdate({
      guildId: auth.guild.id,
      eventId,
      rosterId: roster.id,
      saved: true,
      eventUrl,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ROSTER SAVE] Failed to notify roster save:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save roster notification.",
      },
      { status: 500 }
    );
  }
}
