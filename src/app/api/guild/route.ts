import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type GuildRequest = {
  name?: string;
  discordGuildId?: string;
};

function validateGuildData(body: GuildRequest) {
  const name = body.name?.trim();
  const discordGuildId = body.discordGuildId?.trim();

  if (!name) {
    return {
      error: "Guild name is required.",
    };
  }

  if (!discordGuildId) {
    return {
      error: "Discord Guild ID is required.",
    };
  }

  return {
    name,
    discordGuildId,
  };
}

export async function POST(request: Request) {
  try {
    const body =
      (await request.json()) as GuildRequest;

    const data = validateGuildData(body);

    if ("error" in data) {
      return NextResponse.json(
        data,
        { status: 400 }
      );
    }

    const existingGuild =
      await prisma.guild.findFirst();

    if (existingGuild) {
      return NextResponse.json(
        {
          error:
            "A guild is already configured.",
        },
        { status: 409 }
      );
    }

    const guild =
      await prisma.guild.create({
        data: {
          name: data.name,
          discordGuildId:
            data.discordGuildId,
        },
      });

    return NextResponse.json({
      guild,
    });
  } catch (error) {
    console.error(
      "[GUILD] Failed to create guild:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to create guild.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body =
      (await request.json()) as GuildRequest;

    const data = validateGuildData(body);

    if ("error" in data) {
      return NextResponse.json(
        data,
        { status: 400 }
      );
    }

    const guild =
      await prisma.guild.findFirst();

    if (!guild) {
      return NextResponse.json(
        {
          error:
            "No guild has been configured yet.",
        },
        { status: 404 }
      );
    }

    const updatedGuild =
      await prisma.guild.update({
        where: {
          id: guild.id,
        },
        data: {
          name: data.name,
          discordGuildId:
            data.discordGuildId,
        },
      });

    return NextResponse.json({
      guild: updatedGuild,
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
      { status: 500 }
    );
  }
}