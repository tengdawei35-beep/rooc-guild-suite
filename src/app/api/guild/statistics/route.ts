import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!hasPermission(auth.role, "members.view")) return NextResponse.json({ error: "You do not have permission to view guild statistics." }, { status: 403 });

    const guildId = auth.guild.id;
    const [members, events, rosters, resources, reservations, allocationRuns, participation] = await Promise.all([
      prisma.guildMember.findMany({ where: { guildId }, select: { active: true, job: true } }),
      prisma.event.findMany({ where: { guildId }, select: { date: true } }),
      prisma.roster.findMany({ where: { event: { guildId } }, select: { id: true } }),
      prisma.resource.findMany({ where: { guildId }, select: { id: true } }),
      prisma.reservedAllocation.count({ where: { guildId } }),
      prisma.allocationRun.count({ where: { guildId } }),
      prisma.eventParticipation.findMany({ where: { event: { guildId } }, select: { available: true } }),
    ]);

    const now = new Date();
    const completed = events.filter((event) => event.date < now).length;
    const jobs = new Map<string, number>();
    for (const member of members) if (member.job) jobs.set(member.job, (jobs.get(member.job) ?? 0) + 1);

    // The current schema records event availability, not post-event attendance.
    // Use availability as the current guild activity metric until explicit attendance is added.
    const available = participation.filter((entry) => entry.available).length;
    const activityRate = participation.length ? (available / participation.length) * 100 : 0;

    return NextResponse.json({
      members: { total: members.length, active: members.filter((m) => m.active).length, inactive: members.filter((m) => !m.active).length },
      jobs: [...jobs.entries()].map(([job, count]) => ({ job, count })).sort((a, b) => b.count - a.count),
      attendance: { events: participation.length, attended: available, rate: Number(activityRate.toFixed(1)) },
      events: { total: events.length, completed, upcoming: events.length - completed },
      rosters: { total: rosters.length },
      resources: { total: resources.length, allocations: allocationRuns, reservations },
    });
  } catch (error) {
    console.error("[GUILD STATISTICS] Failed to fetch:", error);
    return NextResponse.json({ error: "Failed to fetch guild statistics." }, { status: 500 });
  }
}
