import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getPlatformAdmin } from "@/lib/platform-admin";

async function requireAdminResponse() {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  return null;
}

export async function GET() {
  const denied = await requireAdminResponse();
  if (denied) return denied;
  const creators = await prisma.platformGuildCreator.findMany({ orderBy: { discordUsername: "asc" } });
  return NextResponse.json({ creators });
}

function parsePositiveInt(value: unknown, fallback: number) {
  const n = Number(value ?? fallback);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function POST(request: Request) {
  const denied = await requireAdminResponse();
  if (denied) return denied;
  const body = (await request.json()) as { discordUserId?: string; discordUsername?: string; maxGuilds?: number; freeMonths?: number; active?: boolean };
  const discordUserId = body.discordUserId?.trim();
  const discordUsername = body.discordUsername?.trim();
  const maxGuilds = parsePositiveInt(body.maxGuilds, 1);
  const freeMonths = parsePositiveInt(body.freeMonths, 1);
  if (!discordUserId || !discordUsername) return NextResponse.json({ error: "Discord user ID and username are required." }, { status: 400 });
  if (!maxGuilds) return NextResponse.json({ error: "maxGuilds must be a positive integer." }, { status: 400 });
  if (!freeMonths) return NextResponse.json({ error: "freeMonths must be a positive integer." }, { status: 400 });
  try {
    const creator = await prisma.platformGuildCreator.create({ data: { discordUserId, discordUsername, maxGuilds, freeMonths, active: body.active ?? true } });
    return NextResponse.json({ creator }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return NextResponse.json({ error: "This Discord user is already configured as a guild creator." }, { status: 409 });
    console.error("[ADMIN] Failed to create guild creator:", error);
    return NextResponse.json({ error: "Failed to create guild creator." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = await requireAdminResponse();
  if (denied) return denied;
  const body = (await request.json()) as { id?: string; discordUsername?: string; maxGuilds?: number; freeMonths?: number; active?: boolean };
  if (!body.id) return NextResponse.json({ error: "Creator ID is required." }, { status: 400 });
  const maxGuilds = body.maxGuilds === undefined ? undefined : parsePositiveInt(body.maxGuilds, 1);
  const freeMonths = body.freeMonths === undefined ? undefined : parsePositiveInt(body.freeMonths, 1);
  if (body.maxGuilds !== undefined && !maxGuilds) return NextResponse.json({ error: "maxGuilds must be a positive integer." }, { status: 400 });
  if (body.freeMonths !== undefined && !freeMonths) return NextResponse.json({ error: "freeMonths must be a positive integer." }, { status: 400 });
  const creator = await prisma.platformGuildCreator.update({ where: { id: body.id }, data: { ...(body.discordUsername !== undefined ? { discordUsername: body.discordUsername.trim() } : {}), ...(maxGuilds !== undefined ? { maxGuilds } : {}), ...(freeMonths !== undefined ? { freeMonths } : {}), ...(body.active !== undefined ? { active: body.active } : {}) } });
  return NextResponse.json({ creator });
}

export async function DELETE(request: Request) {
  const denied = await requireAdminResponse();
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Creator ID is required." }, { status: 400 });
  await prisma.platformGuildCreator.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
