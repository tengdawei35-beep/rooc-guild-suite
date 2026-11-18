import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");

  const latestAllocation = await prisma.allocationRun.findFirst({
    where: { guildId: auth.guild.id, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: { id: true, eventId: true, completedAt: true },
  });

  let rosters: Array<{
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    parties: Array<{
      id: string;
      partyNumber: number;
      battlefield: string;
      members: Array<{ id: string; slotNumber: number; memberId: string }>;
    }>;
  }> = [];

  if (eventId) {
    rosters = await prisma.roster.findMany({
      where: { eventId, event: { guildId: auth.guild.id } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        parties: {
          orderBy: [{ battlefield: "asc" }, { partyNumber: "asc" }],
          select: {
            id: true,
            partyNumber: true,
            battlefield: true,
            members: {
              orderBy: { slotNumber: "asc" },
              select: { id: true, slotNumber: true, memberId: true },
            },
          },
        },
      },
    });
  }

  return NextResponse.json({ latestAllocation, rosters });
}
