import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { notifyBidComplete, notifyRosterUpdate } from "@/lib/discord-notifications";

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const body = await request.json() as {
      type?: "roster" | "bid";
      eventId?: string;
      rosterId?: string | null;
      allocationRunId?: string;
    };

    if (body.type === "roster" && body.eventId) {
      await notifyRosterUpdate({ guildId: auth.guild.id, eventId: body.eventId, rosterId: body.rosterId });
      return NextResponse.json({ success: true });
    }

    if (body.type === "bid" && body.allocationRunId) {
      await notifyBidComplete({ guildId: auth.guild.id, allocationRunId: body.allocationRunId });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid notification request." }, { status: 400 });
  } catch (error) {
    console.error("[DISCORD] Notification dispatch failed:", error);
    return NextResponse.json({ error: "Failed to dispatch notification." }, { status: 500 });
  }
}
