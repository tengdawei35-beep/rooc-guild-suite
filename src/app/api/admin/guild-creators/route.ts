import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getPlatformAdmin } from "@/lib/platform-admin";

async function requireAdminResponse() {
  const admin = await getPlatformAdmin();

  if (!admin) {
    return NextResponse.json(
      { error: "Platform administrator access required." },
      { status: 403 }
    );
  }

  return null;
}

export async function GET() {
  const denied = await requireAdminResponse();
  if (denied) return denied;

  const creators = await prisma.platformGuildCreator.findMany({
    orderBy: { discordUsername: "asc" },
  });

  return NextResponse.json({ creators });
}

export async function POST(request: Request) {
  const denied = await requireAdminResponse();
  if (denied) return denied;

  const body = (await request.json()) as {
    discordUserId?: string;
    discordUsername?: string;
    maxGuilds?: number;
    active?: boolean;
  };

  const discordUserId = body.discordUserId?.trim();
  const discordUsername = body.discordUsername?.trim();
  const maxGuilds = Number(body.maxGuilds ?? 1);

  if (!discordUserId || !discordUsername) {
    return NextResponse.json(
      { error: "Discord user ID and username are required." },
      { status: 400 }
    );
  }

  if (!Number.isInteger(maxGuilds) || maxGuilds < 1) {
    return NextResponse.json(
      { error: "maxGuilds must be a positive integer." },
      { status: 400 }
    );
  }

  try {
    const creator = await prisma.platformGuildCreator.create({
      data: {
        discordUserId,
        discordUsername,
        maxGuilds,
        active: body.active ?? true,
      },
    });

    return NextResponse.json({ creator }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "This Discord user is already configured as a guild creator." },
        { status: 409 }
      );
    }

    console.error("[ADMIN] Failed to create guild creator:", error);
    return NextResponse.json(
      { error: "Failed to create guild creator." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const denied = await requireAdminResponse();
  if (denied) return denied;

  const body = (await request.json()) as {
    id?: string;
    discordUsername?: string;
    maxGuilds?: number;
    active?: boolean;
  };

  if (!body.id) {
    return NextResponse.json(
      { error: "Creator ID is required." },
      { status: 400 }
    );
  }

  const maxGuilds = Number(body.maxGuilds);
  if (body.maxGuilds !== undefined && (!Number.isInteger(maxGuilds) || maxGuilds < 1)) {
    return NextResponse.json(
      { error: "maxGuilds must be a positive integer." },
      { status: 400 }
    );
  }

  const creator = await prisma.platformGuildCreator.update({
    where: { id: body.id },
    data: {
      ...(body.discordUsername !== undefined
        ? { discordUsername: body.discordUsername.trim() }
        : {}),
      ...(body.maxGuilds !== undefined ? { maxGuilds } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    },
  });

  return NextResponse.json({ creator });
}

export async function DELETE(request: Request) {
  const denied = await requireAdminResponse();
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Creator ID is required." },
      { status: 400 }
    );
  }

  await prisma.platformGuildCreator.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
