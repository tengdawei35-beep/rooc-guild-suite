import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!hasPermission(auth.role, "allocation.view")) return NextResponse.json({ error: "You do not have permission to view resource history." }, { status: 403 });

    const runs = await prisma.allocationRun.findMany({
      where: { guildId: auth.guild.id }, orderBy: { createdAt: "desc" }, take: 100,
      include: { allocationResults: { include: { resource: { select: { name: true } }, member: { select: { characterName: true, discordUsername: true } } } } },
    });

    const allocations = runs.flatMap((run) => run.allocationResults
      .filter((result) => result.assignedQuantity > 0 || result.reservedQuantity > 0)
      .map((result) => ({
        id: result.id, resource: result.resource.name,
        member: result.member.characterName || result.member.discordUsername || "Unknown",
        amount: result.assignedQuantity, status: run.status, date: result.createdAt,
        notes: result.reservedQuantity > 0 ? `Reserved: ${result.reservedQuantity}` : null,
      })));

    return NextResponse.json({ allocations: allocations.slice(0, 250) });
  } catch (error) {
    console.error("[RESOURCE HISTORY] Failed to fetch:", error);
    return NextResponse.json({ error: "Failed to fetch resource allocation history." }, { status: 500 });
  }
}
