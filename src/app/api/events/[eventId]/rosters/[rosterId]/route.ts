import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuth, hasPermission } from "@/lib/auth";

type RouteContext = {
  params: Promise<{
    eventId: string;
    rosterId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!hasPermission(auth.role, "rosters.edit")) {
      return NextResponse.json({ error: "You do not have permission to edit rosters." }, { status: 403 });
    }

    const { eventId, rosterId } = await context.params;
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Roster name is required." }, { status: 400 });
    }

    if (name.length > 80) {
      return NextResponse.json({ error: "Roster name must be 80 characters or fewer." }, { status: 400 });
    }

    const roster = await prisma.roster.findFirst({
      where: {
        id: rosterId,
        eventId,
        event: {
          guildId: auth.guild.id,
        },
      },
      select: { id: true },
    });

    if (!roster) {
      return NextResponse.json({ error: "Roster not found." }, { status: 404 });
    }

    const updated = await prisma.roster.update({
      where: { id: roster.id },
      data: { name },
      select: {
        id: true,
        name: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ roster: updated });
  } catch (error) {
    console.error("[ROSTER NAME PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to rename roster." },
      { status: 500 }
    );
  }
}
