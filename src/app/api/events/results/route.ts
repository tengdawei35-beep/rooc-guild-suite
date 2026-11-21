import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "events.view")) return NextResponse.json({ error: "You do not have permission to view event results." }, { status: 403 });
  const results = await prisma.eventResultImage.findMany({
    where: { guildId: auth.guild.id },
    orderBy: [{ event: { date: "desc" } }, { createdAt: "asc" }],
    select: {
      id: true, fileName: true, contentType: true, size: true, createdAt: true,
      event: { select: { id: true, type: true, eventTypeName: true, scheduleTimeZone: true, date: true } },
    },
  });
  const grouped = new Map<string, { event: { id: string; type: string; eventTypeName: string | null; scheduleTimeZone: string | null; date: Date }; images: typeof results }>();
  for (const item of results) {
    const current = grouped.get(item.event.id);
    if (current) current.images.push(item);
    else grouped.set(item.event.id, { event: item.event, images: [item] });
  }
  return NextResponse.json({ results: Array.from(grouped.values()) });
}
