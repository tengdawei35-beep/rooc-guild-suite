import { NextResponse } from "next/server";
import { getCurrentAuth, createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) {
    return NextResponse.redirect(new URL("/login?error=authentication_required", request.url));
  }

  const formData = await request.formData();
  const guildId = formData.get("guildId");

  if (typeof guildId !== "string" || !guildId || guildId === auth.guild.id) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const membership = await prisma.guildMembership.findUnique({
    where: { userId_guildId: { userId: auth.user.id, guildId } },
    select: { guildId: true },
  });

  if (!membership) {
    return NextResponse.redirect(new URL("/?error=guild_access_denied", request.url));
  }

  await createSession(auth.user.id, membership.guildId);
  return NextResponse.redirect(new URL("/", request.url));
}
