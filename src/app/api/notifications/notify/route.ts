import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { notifyBidComplete, notifyRosterUpdate } from "@/lib/discord-notifications";

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json() as {
      type?: "roster" | "bid";
      eventId?: string;
      rosterId?: string | null;
      allocationRunId?: string;
    };

    if (body.type === "roster") {
      if (!hasPermission(auth.role, "rosters.edit")) {
        return NextResponse.json(
          { error: "You do not have permission to trigger roster notifications." },
          { status: 403 }
        );
      }

      if (!body.eventId) {
        return NextResponse.json(
          { error: "Event ID is required for roster notifications." },
          { status: 400 }
        );
      }

      const event = await prisma.event.findFirst({
        where: {
          id: body.eventId,
          guildId: auth.guild.id,
        },
        select: { id: true },
      });

      if (!event) {
        return NextResponse.json(
          { error: "Event not found." },
          { status: 404 }
        );
      }

      await notifyRosterUpdate({
        guildId: auth.guild.id,
        eventId: event.id,
        rosterId: body.rosterId,
      });

      return NextResponse.json({ success: true });
    }

    if (body.type === "bid") {
      if (!hasPermission(auth.role, "allocation.run")) {
        return NextResponse.json(
          { error: "You do not have permission to trigger bidding notifications." },
          { status: 403 }
        );
      }

      if (!body.allocationRunId) {
        return NextResponse.json(
          { error: "Allocation run ID is required for bidding notifications." },
          { status: 400 }
        );
      }

      const allocationRun = await prisma.allocationRun.findFirst({
        where: {
          id: body.allocationRunId,
          guildId: auth.guild.id,
          status: "COMPLETED",
        },
        select: { id: true },
      });

      if (!allocationRun) {
        return NextResponse.json(
          { error: "Completed allocation run not found." },
          { status: 404 }
        );
      }

      await notifyBidComplete({
        guildId: auth.guild.id,
        allocationRunId: allocationRun.id,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid notification request." },
      { status: 400 }
    );
  } catch (error) {
    console.error("[DISCORD] Notification dispatch failed:", error);
    return NextResponse.json(
      { error: "Failed to dispatch notification." },
      { status: 500 }
    );
  }
}
