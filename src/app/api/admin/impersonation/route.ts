import { NextResponse } from "next/server";
import { getOriginalPlatformAdmin } from "@/lib/platform-admin";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveImpersonation, isImpersonationRole, startImpersonation, stopImpersonation } from "@/lib/impersonation";

function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}
export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const body = await request.json() as { action?: string; mode?: string; guildId?: string; userId?: string; role?: unknown };
    if (body.action === "stop") {
      const admin = await getOriginalPlatformAdmin();
      if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
      const active = await getActiveImpersonation();
      if (active && active.adminUserId !== admin.id) return NextResponse.json({ error: "This impersonation session belongs to another administrator." }, { status: 403 });
      await stopImpersonation();
      return NextResponse.json({ ok: true, redirectTo: "/admin/impersonation" });
    }
    const admin = await getOriginalPlatformAdmin();
    const originalSession = await getSession();
    if (!admin || !originalSession) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
    if (!body.guildId || (body.mode !== "USER" && body.mode !== "ROLE")) return NextResponse.json({ error: "Choose a guild and impersonation mode." }, { status: 400 });
    const guild = await prisma.guild.findUnique({ where: { id: body.guildId }, select: { id: true, ownerUserId: true } });
    if (!guild) return NextResponse.json({ error: "Guild not found." }, { status: 404 });

    if (body.mode === "USER") {
      if (!body.userId) return NextResponse.json({ error: "Choose a user." }, { status: 400 });
      const membership = await prisma.guildMembership.findUnique({
        where: { userId_guildId: { userId: body.userId, guildId: guild.id } },
        select: { userId: true, role: true },
      });
      if (!membership) return NextResponse.json({ error: "That user does not have a guild membership." }, { status: 400 });
      await stopImpersonation("REPLACED_BY_NEW_SESSION");
      await startImpersonation({ adminUserId: admin.id, targetUserId: membership.userId, guildId: guild.id, role: membership.role, mode: "USER" });
    } else {
      if (!isImpersonationRole(body.role)) return NextResponse.json({ error: "Choose a valid guild role." }, { status: 400 });
      let targetUserId = admin.id;
      let role = body.role;
      if (body.role === "ADMIN") {
        if (!guild.ownerUserId) return NextResponse.json({ error: "This guild has no linked owner account to preview." }, { status: 400 });
        targetUserId = guild.ownerUserId;
      }
      await stopImpersonation("REPLACED_BY_NEW_SESSION");
      await startImpersonation({ adminUserId: admin.id, targetUserId, guildId: guild.id, role, mode: "ROLE" });
    }
    return NextResponse.json({ ok: true, redirectTo: "/" });
  } catch (error) {
    console.error("[ADMIN IMPERSONATION]", error);
    return NextResponse.json({ error: "Unable to start impersonation." }, { status: 500 });
  }
}
