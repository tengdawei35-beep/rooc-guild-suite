import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { hasGuildModule, RESOURCE_SUITE_MODULE } from "@/lib/auth/modules";

export async function POST(request: Request) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!(await hasGuildModule(auth.guild.id, RESOURCE_SUITE_MODULE))) return NextResponse.json({ error: "The Resource Suite is not subscribed for this guild." }, { status: 403 });
    if (!hasPermission(auth.role, "allocation.run")) return NextResponse.json({ error: "You do not have permission to correct allocation rotation." }, { status: 403 });

    const body = (await request.json().catch(() => ({}))) as { resourceId?: string; expectedCurrentIndex?: number; correctedIndex?: number };
    if (!body.resourceId || !Number.isInteger(body.expectedCurrentIndex) || !Number.isInteger(body.correctedIndex)) {
      return NextResponse.json({ error: "resourceId, expectedCurrentIndex and correctedIndex are required." }, { status: 400 });
    }

    const state = await prisma.rotationState.findUnique({
      where: { guildId_resourceId: { guildId: auth.guild.id, resourceId: body.resourceId } },
      include: { resource: { select: { name: true } } },
    });
    if (!state) return NextResponse.json({ error: "Rotation state not found." }, { status: 404 });
    if (state.rotationIndex !== body.expectedCurrentIndex) {
      return NextResponse.json({ error: `Rotation state changed since the audit. Current index is ${state.rotationIndex}; expected ${body.expectedCurrentIndex}. Refresh the audit before correcting it.` }, { status: 409 });
    }
    if (state.rotationIndex === body.correctedIndex) return NextResponse.json({ success: true, alreadyCorrect: true, resourceName: state.resource.name, rotationIndex: state.rotationIndex });

    const updated = await prisma.rotationState.update({
      where: { id: state.id },
      data: { rotationIndex: body.correctedIndex },
      select: { rotationIndex: true, resource: { select: { name: true } } },
    });

    return NextResponse.json({ success: true, resourceName: updated.resource.name, rotationIndex: updated.rotationIndex, previousIndex: state.rotationIndex });
  } catch (error) {
    console.error("[ALLOCATION AUDIT CORRECT] Failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to correct rotation index." }, { status: 500 });
  }
}
