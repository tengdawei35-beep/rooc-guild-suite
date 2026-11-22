import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "events.view")) return NextResponse.json({ error: "You do not have permission to view event results." }, { status: 403 });
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  if (cursor) {
    const cursorEvent = await prisma.event.findFirst({
      where: { id: cursor, guildId: auth.guild.id, resultImages: { some: {} } },
      select: { id: true },
    });
    if (!cursorEvent) return NextResponse.json({ error: "The results page cursor is no longer available. Refresh the archive." }, { status: 400 });
  }
  const events = await prisma.event.findMany({
    where: { guildId: auth.guild.id, resultImages: { some: {} } },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, type: true, eventTypeName: true, scheduleTimeZone: true, date: true,
      resultImages: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, fileName: true, contentType: true, size: true, createdAt: true },
      },
    },
  });
  const hasMore = events.length > PAGE_SIZE;
  const page = hasMore ? events.slice(0, PAGE_SIZE) : events;
  const results = page.map((event) => ({
    event: {
      id: event.id, type: event.type, eventTypeName: event.eventTypeName,
      scheduleTimeZone: event.scheduleTimeZone, date: event.date,
    },
    images: event.resultImages,
  }));
  return NextResponse.json({
    results,
    hasMore,
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  });
}
