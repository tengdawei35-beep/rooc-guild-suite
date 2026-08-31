import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuth, hasPermission } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

async function getEvent(eventId: string, guildId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, guildId },
    select: { id: true, guildId: true, title: true, startAt: true, guild: { select: { name: true, callsWebhookUrl: true } } },
  });
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!hasPermission(auth.role, "rosters.edit")) return NextResponse.json({ error: "You do not have permission to finalize rosters." }, { status: 403 });

    const { eventId } = await context.params;
    const event = await getEvent(eventId, auth.guild.id);
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

    const body = await request.json();
    const rosterId = typeof body.rosterId === "string" ? body.rosterId : "";
    if (!rosterId) return NextResponse.json({ error: "rosterId is required." }, { status: 400 });

    const roster = await prisma.roster.findFirst({
      where: { id: rosterId, eventId: event.id },
      select: { id: true, name: true },
    });
    if (!roster) return NextResponse.json({ error: "Roster not found for this event." }, { status: 404 });

    const current = await prisma.event.findUnique({ where: { id: event.id }, select: { finalRosterId: true } });
    await prisma.$executeRawUnsafe(
      'UPDATE "Event" SET "finalRosterId" = $1, "updatedAt" = NOW() WHERE "id" = $2 AND "guildId" = $3',
      roster.id, event.id, auth.guild.id
    );

    // Publishing is the only roster action that sends a Discord notification.
    // Re-publishing the already-final roster is intentionally silent.
    if (current?.finalRosterId !== roster.id && event.guild.callsWebhookUrl) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";
      const rosterUrl = `${baseUrl.replace(/\/$/, "")}/events/${event.id}?roster=${encodeURIComponent(roster.id)}`;
      const start = event.startAt ? new Date(event.startAt) : null;
      const dateText = start ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", dateStyle: "medium" }).format(start) : "TBC";
      const timeText = start ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", timeStyle: "short", hour12: false }).format(start) : "TBC";

      const response = await fetch(event.guild.callsWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: "📋 Roster Published",
            description: `**${event.title}**\n**${roster.name}**`,
            fields: [
              { name: "📅 Date", value: dateText, inline: true },
              { name: "🕐 Time", value: `${timeText} (Server Time · UTC+7)`, inline: true },
            ],
            url: rosterUrl,
            footer: { text: `${event.guild.name} · ROOC Guild Suite` },
            timestamp: new Date().toISOString(),
          }],
        }),
      });
      if (!response.ok) console.error("[ROSTER DISCORD WEBHOOK] failed", response.status, await response.text().catch(() => ""));
    }

    return NextResponse.json({ finalRosterId: roster.id });
  } catch (error) {
    console.error("[EVENT FINAL ROSTER PUT]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to finalize roster." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!hasPermission(auth.role, "rosters.edit")) return NextResponse.json({ error: "You do not have permission to manage the final roster." }, { status: 403 });

    const { eventId } = await context.params;
    const event = await getEvent(eventId, auth.guild.id);
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

    await prisma.$executeRawUnsafe(
      'UPDATE "Event" SET "finalRosterId" = NULL, "updatedAt" = NOW() WHERE "id" = $1 AND "guildId" = $2',
      event.id, auth.guild.id
    );
    return NextResponse.json({ finalRosterId: null });
  } catch (error) {
    console.error("[EVENT FINAL ROSTER DELETE]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to unpublish roster." }, { status: 500 });
  }
}
