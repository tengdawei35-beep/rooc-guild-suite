import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { hasGuildModule, RESOURCE_SUITE_MODULE } from "@/lib/auth/modules";

export async function GET() {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const canReset = hasPermission(auth.role, "allocation.run") &&
      await hasGuildModule(auth.guild.id, RESOURCE_SUITE_MODULE);
    return NextResponse.json({ canReset });
  } catch (error) {
    console.error("[ROTATION RESET] Failed to check permissions:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to check rotation permissions." }, { status: 500 });
  }
}

export async function POST() {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!(await hasGuildModule(auth.guild.id, RESOURCE_SUITE_MODULE))) {
      return NextResponse.json({ error: "The Resource Suite is not subscribed for this guild." }, { status: 403 });
    }
    if (!hasPermission(auth.role, "allocation.run")) {
      return NextResponse.json({ error: "You do not have permission to reset the bidding rotation." }, { status: 403 });
    }

    const resetCount = await prisma.$transaction(async (tx) => {
      const resources = await tx.resource.findMany({
        where: { guildId: auth.guild.id },
        select: { id: true },
      });

      for (const resource of resources) {
        await tx.rotationState.upsert({
          where: { guildId_resourceId: { guildId: auth.guild.id, resourceId: resource.id } },
          create: { guildId: auth.guild.id, resourceId: resource.id, rotationIndex: 0 },
          update: { rotationIndex: 0 },
        });
      }

      return resources.length;
    });

    return NextResponse.json({ success: true, rotationIndex: 0, resourcesReset: resetCount });
  } catch (error) {
    console.error("[ROTATION RESET] Failed to reset rotation:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to reset bidding rotation." }, { status: 500 });
  }
}
