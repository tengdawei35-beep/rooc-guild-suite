import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import {
  GUILD_SELECTION_COOKIE,
  verifyGuildSelectionToken,
} from "@/lib/guild-selection";

export async function POST(request: Request) {
  const appUrl = process.env.APP_URL;
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const token = cookieStore.get(GUILD_SELECTION_COOKIE)?.value;
  const selection = token ? verifyGuildSelectionToken(token) : null;
  const baseUrl = appUrl ? new URL(appUrl) : url.origin;

  if (!selection) {
    cookieStore.set(GUILD_SELECTION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return NextResponse.redirect(new URL("/login?error=authentication_failed", baseUrl));
  }

  const formData = await request.formData();
  const guildId = formData.get("guildId");

  if (typeof guildId !== "string" || !guildId) {
    return NextResponse.redirect(new URL("/guild/select", baseUrl));
  }

  const membership = await prisma.guildMembership.findUnique({
    where: {
      userId_guildId: {
        userId: selection.userId,
        guildId,
      },
    },
    select: {
      guildId: true,
    },
  });

  if (!membership) {
    return NextResponse.redirect(new URL("/login?error=no_guild_access", baseUrl));
  }

  await createSession(selection.userId, membership.guildId);

  cookieStore.set(GUILD_SELECTION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.redirect(new URL("/", baseUrl));
}
