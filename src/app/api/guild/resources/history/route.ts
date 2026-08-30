import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!hasPermission(auth.role, "resources.view")) return NextResponse.json({ error: "You do not have permission to view resource history." }, { status: 403 });

    const allocations = await prisma.resourceAllocation.findMany({
      where: { guildId: auth.guild.id },
      orderBy: { createdAt: "desc" },
      take: 250,
      select: {
        id: true,
        quantity: true,
        status: true,
        createdAt: true,
        notes: true,
        resource: { select: { name: true } },
        member: { select: { characterName: true } },
      },
    });

    return NextResponse.json({
      allocations: allocations.map((allocation) => ({
        id: allocation.id,
        resource: allocation.resource.name,
        member: allocation.member.characterName ?? "Unknown",
        amount: allocation.quantity,
        status: allocation.status,
        date: allocation.createdAt,
        notes: allocation.notes,
      })),
    });
  } catch (error) {
    console.error("[RESOURCE HISTORY] Failed to fetch:", error);
    return NextResponse.json({ error: "Failed to fetch resource allocation history." }, { status: 500 });
  }
}
