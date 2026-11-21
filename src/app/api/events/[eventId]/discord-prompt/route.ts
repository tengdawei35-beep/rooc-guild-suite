import { NextResponse } from "next/server";
import { getCurrentAuth, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEventAttendanceMessage } from "@/lib/discord-event-attendance";

type RouteContext = { params: Promise<{ eventId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!hasPermission(auth.role, "events.manage")) {
      return NextResponse.json({ error: "You do not have permission to send event attendance prompts." }, { status: 403 });
    }

    const { eventId } = await context.params;
    const event = await prisma.event.findFirst({
      where: { id: eventId, guildId: auth.guild.id },
      select: { id: true, date: true },
    });
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (event.date.getTime() - Date.now() <= 30 * 60 * 1000) {
      return NextResponse.json({ error: "Attendance is locked within 30 minutes of the event start. The prompt cannot be sent." }, { status: 400 });
    }

    const result = await sendEventAttendanceMessage(event.id, true);
    if (!result.sent) {
      const message = result.reason === "discord_not_configured"
        ? "Discord event channel or bot is not configured."
        : "The attendance prompt could not be sent.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error("[EVENT DISCORD PROMPT]", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to send attendance prompt.",
    }, { status: 500 });
  }
}
