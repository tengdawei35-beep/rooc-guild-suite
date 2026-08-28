import { NextResponse } from "next/server";

import {
  getCurrentAuth,
} from "@/lib/auth";

import {
  hasPermission,
} from "@/lib/permissions";

import {
  prisma,
} from "@/lib/prisma";

type GuildRequest = {
  name?: string;
  discordGuildId?: string;
};

function validateGuildData(
  body: GuildRequest
) {
  const name =
    body.name?.trim();

  const discordGuildId =
    body.discordGuildId?.trim();

  if (!name) {
    return {
      error:
        "Guild name is required.",
    };
  }

  if (!discordGuildId) {
    return {
      error:
        "Discord Guild ID is required.",
    };
  }

  return {
    name,
    discordGuildId,
  };
}

// =============================================================
// PUT
// Update the currently authenticated guild
// =============================================================

export async function PUT(
  request: Request
) {
  try {
    // ---------------------------------------------------------
    // AUTHENTICATION
    // ---------------------------------------------------------

    const auth =
      await getCurrentAuth();

    if (!auth) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    // ---------------------------------------------------------
    // PERMISSION
    // ---------------------------------------------------------

    if (
      !hasPermission(
        auth.role,
        "guild.manage"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to manage guild settings.",
        },
        {
          status: 403,
        }
      );
    }

    // ---------------------------------------------------------
    // REQUEST BODY
    // ---------------------------------------------------------

    const body =
      (await request.json()) as GuildRequest;

    const data =
      validateGuildData(
        body
      );

    if ("error" in data) {
      return NextResponse.json(
        data,
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------
    // LOAD CURRENT GUILD
    // ---------------------------------------------------------
    //
    // IMPORTANT:
    //
    // Never use findFirst() here.
    //
    // The guild is determined exclusively from the
    // authenticated session.
    //
    // ---------------------------------------------------------

    const guild =
      await prisma.guild.findUnique(
        {
          where: {
            id:
              auth.guild.id,
          },
        }
      );

    if (!guild) {
      return NextResponse.json(
        {
          error:
            "Guild not found.",
        },
        {
          status: 404,
        }
      );
    }

    // ---------------------------------------------------------
    // PREVENT DISCORD GUILD ID COLLISION
    // ---------------------------------------------------------

    const conflictingGuild =
      await prisma.guild.findFirst(
        {
          where: {
            discordGuildId:
              data.discordGuildId,

            NOT: {
              id:
                guild.id,
            },
          },
        }
      );

    if (conflictingGuild) {
      return NextResponse.json(
        {
          error:
            "That Discord Guild ID is already associated with another guild.",
        },
        {
          status: 409,
        }
      );
    }

    // ---------------------------------------------------------
    // UPDATE
    // ---------------------------------------------------------

    const updatedGuild =
      await prisma.guild.update(
        {
          where: {
            id:
              guild.id,
          },

          data: {
            name:
              data.name,

            discordGuildId:
              data.discordGuildId,
          },
        }
      );

    return NextResponse.json({
      guild:
        updatedGuild,
    });
  } catch (error) {
    console.error(
      "[GUILD] Failed to update guild:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update guild.",
      },
      {
        status: 500,
      }
    );
  }
}