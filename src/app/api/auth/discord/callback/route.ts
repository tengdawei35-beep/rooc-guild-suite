import { NextResponse } from "next/server";

import {
  createSession,
} from "@/lib/auth";

import { prisma } from "@/lib/prisma";

type DiscordUser = {
  id: string;
  username: string;
  avatar?: string | null;
};

type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
};

export async function GET(
  request: Request
) {
  /*
   * APP_URL is the public URL of the application.
   *
   * Example:
   * https://imagine-capabilities-silence-fully.trycloudflare.com
   *
   * Do NOT include /api/auth/discord/callback here.
   */

  const appUrl =
    process.env.APP_URL;

  try {
    const url =
      new URL(request.url);

    const code =
      url.searchParams.get("code");

    if (!code) {
      return NextResponse.redirect(
        new URL(
          "/login?error=missing_code",
          appUrl ?? url.origin
        )
      );
    }

    const clientId =
      process.env.DISCORD_CLIENT_ID;

    const clientSecret =
      process.env.DISCORD_CLIENT_SECRET;

    if (
      !clientId ||
      !clientSecret ||
      !appUrl
    ) {
      return NextResponse.json(
        {
          error:
            "Discord authentication is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const appBaseUrl =
      new URL(appUrl);

    const redirectUri =
      `${appUrl}/api/auth/discord/callback`;

    // =========================================================
    // EXCHANGE DISCORD OAUTH CODE
    // =========================================================

    const tokenResponse =
      await fetch(
        "https://discord.com/api/oauth2/token",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body:
            new URLSearchParams({
              client_id:
                clientId,

              client_secret:
                clientSecret,

              grant_type:
                "authorization_code",

              code,

              redirect_uri:
                redirectUri,
            }),
        }
      );

    const tokenResponseText =
      await tokenResponse.text();

    if (!tokenResponse.ok) {
      console.error(
        "[DISCORD AUTH] Token exchange failed:",
        tokenResponse.status,
        tokenResponseText
      );

      throw new Error(
        `Discord token exchange failed: ${tokenResponse.status}`
      );
    }

    let tokenData: DiscordTokenResponse;

    try {
      tokenData =
        JSON.parse(
          tokenResponseText
        ) as DiscordTokenResponse;
    } catch {
      console.error(
        "[DISCORD AUTH] Invalid token response:",
        tokenResponseText
      );

      throw new Error(
        "Discord returned an invalid token response."
      );
    }

    if (
      !tokenData.access_token ||
      !tokenData.token_type
    ) {
      console.error(
        "[DISCORD AUTH] Token response missing required fields:",
        tokenResponseText
      );

      throw new Error(
        "Discord token response was incomplete."
      );
    }

    // =========================================================
    // GET DISCORD USER
    // =========================================================

    const discordResponse =
      await fetch(
        "https://discord.com/api/users/@me",
        {
          headers: {
            Authorization:
              `${tokenData.token_type} ${tokenData.access_token}`,
          },

          cache: "no-store",
        }
      );

    const discordResponseText =
      await discordResponse.text();

    if (
      !discordResponse.ok
    ) {
      console.error(
        "[DISCORD AUTH] Failed to retrieve Discord user:",
        discordResponse.status,
        discordResponseText
      );

      throw new Error(
        "Failed to retrieve Discord identity."
      );
    }

    let discordUser: DiscordUser;

    try {
      discordUser =
        JSON.parse(
          discordResponseText
        ) as DiscordUser;
    } catch {
      console.error(
        "[DISCORD AUTH] Invalid Discord user response:",
        discordResponseText
      );

      throw new Error(
        "Discord returned an invalid user response."
      );
    }

    if (
      !discordUser.id ||
      !discordUser.username
    ) {
      throw new Error(
        "Discord user response was incomplete."
      );
    }

    // =========================================================
    // DISCORD AVATAR
    // =========================================================

    const avatarUrl =
      discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null;

    // =========================================================
    // FIND OR CREATE USER
    // =========================================================

    const user =
      await prisma.user.upsert({
        where: {
          discordId:
            discordUser.id,
        },

        update: {
          username:
            discordUser.username,

          avatarUrl,
        },

        create: {
          discordId:
            discordUser.id,

          username:
            discordUser.username,

          avatarUrl,
        },
      });

    // =========================================================
    // FIND EXISTING GUILD MEMBERSHIPS
    // =========================================================

    const memberships =
      await prisma.guildMembership.findMany(
        {
          where: {
            userId:
              user.id,
          },

          include: {
            guild: true,
          },

          orderBy: {
            createdAt: "asc",
          },
        }
      );

    let membership =
      memberships[0] ?? null;

    // =========================================================
    // INITIAL LEADER BOOTSTRAP
    // =========================================================

    if (
      !membership &&
      discordUser.id ===
        process.env
          .INITIAL_LEADER_DISCORD_ID
    ) {
      const initialGuildDiscordId =
        process.env
          .INITIAL_GUILD_DISCORD_ID;

      if (
        !initialGuildDiscordId
      ) {
        throw new Error(
          "INITIAL_GUILD_DISCORD_ID is not configured."
        );
      }

      const guild =
        await prisma.guild.findUnique(
          {
            where: {
              discordGuildId:
                initialGuildDiscordId,
            },
          }
        );

      if (!guild) {
        throw new Error(
          "The configured initial Discord guild does not exist in the database."
        );
      }

      membership =
        await prisma.guildMembership.create(
          {
            data: {
              userId:
                user.id,

              guildId:
                guild.id,

              role:
                "LEADER",
            },

            include: {
              guild: true,
            },
          }
        );
    }

    // =========================================================
    // NO GUILD ACCESS
    // =========================================================

    if (!membership) {
      return NextResponse.redirect(
        new URL(
          "/login?error=no_guild_access",
          appBaseUrl
        )
      );
    }

    // =========================================================
    // CREATE SESSION
    // =========================================================

    await createSession(
      user.id,
      membership.guildId
    );

    // =========================================================
    // LOGIN COMPLETE
    // =========================================================

    return NextResponse.redirect(
      new URL(
        "/",
        appBaseUrl
      )
    );
  } catch (error) {
    console.error(
      "[DISCORD AUTH]",
      error
    );

    /*
     * If APP_URL is configured, always redirect using
     * the public application URL.
     *
     * This prevents Cloudflare Tunnel requests from
     * accidentally redirecting the user to localhost.
     */
    const fallbackUrl =
      appUrl
        ? new URL(appUrl)
        : new URL(request.url);

    return NextResponse.redirect(
      new URL(
        "/login?error=authentication_failed",
        fallbackUrl
      )
    );
  }
}