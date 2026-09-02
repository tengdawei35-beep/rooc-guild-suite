import { NextResponse } from "next/server";

import { getCurrentAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const auth = await getCurrentAuth();

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const guild = await prisma.guild.findUnique({
      where: { id: auth.guild.id },
      select: { id: true, ownerUserId: true },
    });

    if (!guild) {
      return NextResponse.json(
        { error: "Guild not found." },
        { status: 404 }
      );
    }

    if (guild.ownerUserId !== auth.user.id) {
      return NextResponse.json(
        { error: "Only the current guild owner can transfer ownership." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      newOwnerUserId?: unknown;
    };

    const newOwnerUserId =
      typeof body.newOwnerUserId === "string"
        ? body.newOwnerUserId.trim()
        : "";

    if (!newOwnerUserId) {
      return NextResponse.json(
        { error: "A new owner is required." },
        { status: 400 }
      );
    }

    if (newOwnerUserId === auth.user.id) {
      return NextResponse.json(
        { error: "The selected user is already the guild owner." },
        { status: 400 }
      );
    }

    const targetMembership = await prisma.guildMembership.findUnique({
      where: {
        userId_guildId: {
          userId: newOwnerUserId,
          guildId: guild.id,
        },
      },
      include: { user: true },
    });

    if (!targetMembership) {
      return NextResponse.json(
        { error: "The selected user is not a member of this guild." },
        { status: 404 }
      );
    }

    const previousOwnerMembership =
      await prisma.guildMembership.findUnique({
        where: {
          userId_guildId: {
            userId: auth.user.id,
            guildId: guild.id,
          },
        },
      });

    if (!previousOwnerMembership) {
      return NextResponse.json(
        { error: "The current owner does not have a guild membership." },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.guild.update({
        where: { id: guild.id },
        data: { ownerUserId: newOwnerUserId },
      });

      await tx.guildMembership.update({
        where: { id: previousOwnerMembership.id },
        data: { role: "MEMBER" },
      });

      await tx.guildMembership.update({
        where: { id: targetMembership.id },
        data: { role: "ADMIN" },
      });
    });

    return NextResponse.json({
      success: true,
      owner: {
        id: targetMembership.user.id,
        username: targetMembership.user.username,
      },
    });
  } catch (error) {
    console.error("[GUILD OWNERSHIP] Failed to transfer ownership:", error);

    return NextResponse.json(
      { error: "Failed to transfer guild ownership." },
      { status: 500 }
    );
  }
}
