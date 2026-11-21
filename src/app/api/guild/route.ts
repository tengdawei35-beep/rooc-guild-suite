import { NextResponse } from "next/server";

import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isGameType } from "@/lib/games";

type GuildRequest = {
  name?: string;
  discordGuildId?: string;
  gameType?: unknown;
};

function validateGuildData(body: GuildRequest) {
  const name = body.name?.trim();
  const discordGuildId = body.discordGuildId?.trim();

  if (!name) return { error: "Guild name is required." };
  if (!discordGuildId) return { error: "Discord Guild ID is required." };
  if (!/^\d{17,20}$/.test(discordGuildId)) return { error: "Enter a valid Discord server ID." };
  if (!isGameType(body.gameType)) return { error: "A valid game type is required." };

  return { name, discordGuildId, gameType: body.gameType };
}

export async function PUT(request: Request) {
  try {
    const auth = await getCurrentAuth();

    if (!auth) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!hasPermission(auth.role, "guild.manage")) {
      return NextResponse.json(
        { error: "You do not have permission to manage guild settings." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as GuildRequest;
    const data = validateGuildData(body);

    if ("error" in data) {
      return NextResponse.json(data, { status: 400 });
    }

    const guild = await prisma.guild.findUnique({ where: { id: auth.guild.id } });

    if (!guild) {
      return NextResponse.json({ error: "Guild not found." }, { status: 404 });
    }

    const conflictingGuild = await prisma.guild.findFirst({
      where: { discordGuildId: data.discordGuildId, NOT: { id: guild.id } },
      select: { id: true, name: true },
    });

    // A Discord server can be linked to only one HMDL guild. When a manager
    // intentionally assigns it to this guild, atomically release the old link.
    // No guild, member, event, or historical data is moved or deleted.
    const updatedGuild = await prisma.$transaction(async (tx) => {
      if (conflictingGuild) {
        await tx.guild.update({
          where: { id: conflictingGuild.id },
          data: { discordGuildId: null },
        });
      }

      return tx.guild.update({
        where: { id: guild.id },
        data: {
          name: data.name,
          discordGuildId: data.discordGuildId,
          gameType: data.gameType,
        },
      });
    });

    return NextResponse.json({
      guild: updatedGuild,
      discordAssociationTransferredFrom: conflictingGuild?.name ?? null,
    });
  } catch (error) {
    console.error("[GUILD] Failed to update guild:", error);
    return NextResponse.json({ error: "Failed to update guild." }, { status: 500 });
  }
}
