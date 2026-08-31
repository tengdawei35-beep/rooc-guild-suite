import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuth, hasPermission } from "@/lib/auth";

type RouteContext = { params: Promise<{ eventId: string }> };

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` :
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
}

function serverTime(value: Date) {
  return value.toLocaleString("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

async function getEvent(eventId: string, guildId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, guildId },
    select: {
      id: true,
      guildId: true,
      type: true,
      date: true,
      finalRosterId: true,
      guild: { select: { name: true } },
    },
  });
}

async function getWebhookForGuild(guildId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ webhook_url: string | null }>>(
    `SELECT webhook_url FROM "guild_call_webhooks" WHERE guild_id = $1 LIMIT 1`,
    guildId,
  );
  return rows[0]?.webhook_url ?? null;
}

function eventLabel(type: string) {
  if (type === "GUILD_LEAGUE") return "Guild League";
  if (type === "EMPORIUM_OVERRUN") return "Emperium Overrun";
  return type.replaceAll("_", " ");
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

    const current = event.finalRosterId;
    await prisma.$executeRawUnsafe(
      'UPDATE "Event" SET "finalRosterId" = $1, "updatedAt" = NOW() WHERE "id" = $2 AND "guildId" = $3',
      roster.id, event.id, auth.guild.id,
    );

    // Publishing is the only roster action that sends a Discord notification.
    // Re-publishing the already-final roster is intentionally silent.
    if (current !== roster.id) {
      const webhook = await getWebhookForGuild(auth.guild.id);
      if (webhook) {
        const url = `${appUrl().replace(/\/$/, "")}/events/${encodeURIComponent(event.id)}?roster=${encodeURIComponent(roster.id)}`;
        const typeText = eventLabel(event.type);
        const when = serverTime(new Date(event.date));

        const response = await fetch(webhook, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            embeds: [{
              title: `📋  ROSTER PUBLISHED  •  ${typeText}`,
              description: `**${roster.name}** has been published as the final roster for this event.`,
              color: 5793266,
              fields: [
                { name: "📅  DATE & TIME", value: `${when}\nUTC+7 Server Time`, inline: true },
                { name: "📋  ROSTER", value: roster.name, inline: true },
                { name: "🔗  ROSTER DETAILS", value: `[Open Published Roster →](${url})`, inline: false },
              ],
              footer: { text: `${event.guild.name} • ROOC Guild Suite` },
              timestamp: new Date().toISOString(),
              url,
            }],
            allowed_mentions: { parse: [] },
          }),
          cache: "no-store",
        });
        if (!response.ok) console.error("[ROSTER DISCORD WEBHOOK] failed", response.status, await response.text().catch(() => ""));
      }
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
      event.id, auth.guild.id,
    );
    return NextResponse.json({ finalRosterId: null });
  } catch (error) {
    console.error("[EVENT FINAL ROSTER DELETE]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to unpublish roster." }, { status: 500 });
  }
}
