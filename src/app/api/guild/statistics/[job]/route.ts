import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ job: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!hasPermission(auth.role, "members.view")) {
      return NextResponse.json({ error: "You do not have permission to view guild statistics." }, { status: 403 });
    }

    const { job: encodedJob } = await context.params;
    const job = decodeURIComponent(encodedJob);
    const guild = await prisma.guild.findUnique({
      where: { id: auth.guild.id },
      select: { gameType: true },
    });

    const members = await prisma.guildMember.findMany({
      where: { guildId: auth.guild.id, job },
      select: {
        id: true,
        characterName: true,
        job: true,
        active: true,
        eligible: true,
        pvpScore: true,
        dpsScore: true,
        tankScore: true,
      },
      orderBy: [{ pvpScore: "desc" }, { characterName: "asc" }],
    });

    return NextResponse.json({
      gameType: guild?.gameType === "RO3" ? "RO3" : "ROOC",
      job,
      players: members.map((member) => ({
        ...member,
        pvpScore: member.pvpScore === null ? null : Number(member.pvpScore),
        dpsScore: member.dpsScore === null ? null : Number(member.dpsScore),
        tankScore: member.tankScore === null ? null : Number(member.tankScore),
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GUILD STATISTICS] Failed to fetch job players:", error);
    return NextResponse.json({ error: "Failed to fetch players for this job." }, { status: 500 });
  }
}
