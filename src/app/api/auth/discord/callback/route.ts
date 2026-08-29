import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createSession } from "@/lib/auth";
import { setApplicantSession } from "@/lib/auth/applicant";
import { setPlatformUserSession } from "@/lib/auth/platform";
import { prisma } from "@/lib/prisma";
import { ensureGuildMembershipsForDiscordUser } from "@/lib/auth/ensure-guild-membership";
import { GUILD_SELECTION_COOKIE, createGuildSelectionToken } from "@/lib/guild-selection";

const OAUTH_STATE_COOKIE = "rooc_discord_oauth_state";
const OAUTH_RETURN_COOKIE = "rooc_discord_oauth_return";

type DiscordUser = { id: string; username: string; avatar?: string | null };
type DiscordTokenResponse = { access_token: string; token_type: string };

export async function GET(request: Request) {
  const appUrl = process.env.APP_URL;

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieStore = await cookies();
    const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
    const applicantReturn = cookieStore.get(OAUTH_RETURN_COOKIE)?.value;

    if (!code || !state || !expectedState || state.length !== expectedState.length || state !== expectedState) {
      return NextResponse.redirect(new URL("/login?error=invalid_oauth_state", appUrl ?? url.origin));
    }

    cookieStore.set(OAUTH_STATE_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    if (!clientId || !clientSecret || !appUrl) {
      return NextResponse.json({ error: "Discord authentication is not configured." }, { status: 500 });
    }

    const appBaseUrl = new URL(appUrl);
    const redirectUri = `${appUrl}/api/auth/discord/callback`;

    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code, redirect_uri: redirectUri }),
    });
    const tokenResponseText = await tokenResponse.text();
    if (!tokenResponse.ok) throw new Error(`Discord token exchange failed: ${tokenResponse.status}`);

    let tokenData: DiscordTokenResponse;
    try { tokenData = JSON.parse(tokenResponseText) as DiscordTokenResponse; } catch { throw new Error("Discord returned an invalid token response."); }
    if (!tokenData.access_token || !tokenData.token_type) throw new Error("Discord token response was incomplete.");

    const discordResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `${tokenData.token_type} ${tokenData.access_token}` },
      cache: "no-store",
    });
    const discordResponseText = await discordResponse.text();
    if (!discordResponse.ok) throw new Error("Failed to retrieve Discord identity.");

    let discordUser: DiscordUser;
    try { discordUser = JSON.parse(discordResponseText) as DiscordUser; } catch { throw new Error("Discord returned an invalid user response."); }
    if (!discordUser.id || !discordUser.username) throw new Error("Discord user response was incomplete.");

    const discordUserId = discordUser.id;
    const discordUsername = discordUser.username;
    const avatarUrl = discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : null;

    const user = await prisma.user.upsert({
      where: { discordId: discordUserId },
      update: { username: discordUsername, avatarUrl },
      create: { discordId: discordUserId, username: discordUsername, avatarUrl },
    });

    if (applicantReturn && /^\/apply\/[A-Za-z0-9_-]{20,200}$/.test(applicantReturn)) {
      cookieStore.set(OAUTH_RETURN_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
      await setApplicantSession(user.id);
      return NextResponse.redirect(new URL(applicantReturn, appBaseUrl));
    }

    await setPlatformUserSession(user.id);
    await ensureGuildMembershipsForDiscordUser({ userId: user.id, discordId: discordUserId, username: discordUsername });

    let memberships = await prisma.guildMembership.findMany({
      where: { userId: user.id },
      include: { guild: true },
      orderBy: { createdAt: "asc" },
    });

    if (memberships.length === 0) {
      const ownedGuilds = await prisma.guild.findMany({ where: { ownerUserId: user.id }, select: { id: true } });

      if (ownedGuilds.length > 0) {
        await prisma.guildMembership.createMany({
          data: ownedGuilds.map((guild) => ({ userId: user.id, guildId: guild.id, role: "ADMIN" as const })),
          skipDuplicates: true,
        });

        memberships = await prisma.guildMembership.findMany({
          where: { userId: user.id },
          include: { guild: true },
          orderBy: { createdAt: "asc" },
        });
      }
    }

    const membership = memberships[0] ?? null;

    if (!membership && discordUserId === process.env.INITIAL_LEADER_DISCORD_ID) {
      const initialGuildDiscordId = process.env.INITIAL_GUILD_DISCORD_ID;
      if (!initialGuildDiscordId) throw new Error("INITIAL_GUILD_DISCORD_ID is not configured.");

      const guild = await prisma.guild.findUnique({ where: { discordGuildId: initialGuildDiscordId } });
      if (!guild) throw new Error("The configured initial Discord guild does not exist in the database.");

      const initialMembership = await prisma.guildMembership.create({
        data: { userId: user.id, guildId: guild.id, role: "ADMIN" },
        include: { guild: true },
      });

      cookieStore.set(GUILD_SELECTION_COOKIE, createGuildSelectionToken(user.id), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 5 * 60,
      });
      await createSession(user.id, initialMembership.guildId);
      return NextResponse.redirect(new URL("/guild/select", appBaseUrl));
    }

    if (!membership) return NextResponse.redirect(new URL("/billing/new", appBaseUrl));

    cookieStore.set(GUILD_SELECTION_COOKIE, createGuildSelectionToken(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 5 * 60,
    });
    return NextResponse.redirect(new URL("/guild/select", appBaseUrl));
  } catch (error) {
    console.error("[DISCORD AUTH]", error);
    const fallbackUrl = appUrl ? new URL(appUrl) : new URL(request.url);
    return NextResponse.redirect(new URL("/login?error=authentication_failed", fallbackUrl));
  }
}
