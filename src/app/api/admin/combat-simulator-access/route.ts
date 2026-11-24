import { NextResponse } from "next/server";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

async function denied() {
  const admin = await getPlatformAdmin();
  return admin ? null : NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
}

export async function GET() {
  const response = await denied();
  if (response) return response;

  const [users, guilds, personalGrants, guildGrants] = await Promise.all([
    prisma.user.findMany({
      orderBy: { username: "asc" },
      select: { id: true, username: true, discordId: true },
    }),
    prisma.guild.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, gameType: true, discordGuildId: true },
    }),
    prisma.userCombatSimulatorSubscription.findMany({
      where: { provider: "admin" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, status: true, createdAt: true, updatedAt: true,
        user: { select: { id: true, username: true, discordId: true } },
      },
    }),
    prisma.guildCombatSimulatorSubscription.findMany({
      where: { provider: "admin" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, status: true, createdAt: true, updatedAt: true,
        guild: { select: { id: true, name: true, gameType: true, discordGuildId: true } },
      },
    }),
  ]);

  return NextResponse.json({
    users,
    guilds,
    personalGrants: personalGrants.map((grant) => ({ ...grant, createdAt: grant.createdAt.toISOString(), updatedAt: grant.updatedAt.toISOString() })),
    guildGrants: guildGrants.map((grant) => ({ ...grant, createdAt: grant.createdAt.toISOString(), updatedAt: grant.updatedAt.toISOString() })),
  });
}

export async function POST(request: Request) {
  const response = await denied();
  if (response) return response;

  let body: { targetType?: string; targetId?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.action === "revoke") {
    if (!body.targetId || (body.targetType !== "USER" && body.targetType !== "GUILD")) {
      return NextResponse.json({ error: "A valid grant and target type are required." }, { status: 400 });
    }
    const model = body.targetType === "USER" ? prisma.userCombatSimulatorSubscription : prisma.guildCombatSimulatorSubscription;
    const grant = await model.findFirst({ where: { id: body.targetId, provider: "admin" } });
    if (!grant) return NextResponse.json({ error: "Administrator grant not found." }, { status: 404 });
    await model.update({ where: { id: grant.id }, data: { status: "CANCELED", currentPeriodEnd: new Date(), cancelAtPeriodEnd: false } });
    return NextResponse.json({ success: true });
  }

  if (body.action !== "grant" || !body.targetId || (body.targetType !== "USER" && body.targetType !== "GUILD")) {
    return NextResponse.json({ error: "Choose a user or guild to grant access to." }, { status: 400 });
  }

  if (body.targetType === "USER") {
    const user = await prisma.user.findUnique({ where: { id: body.targetId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const existing = await prisma.userCombatSimulatorSubscription.findFirst({
      where: { userId: user.id, provider: "admin", status: { in: ["ACTIVE", "TRIALING"] } },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ error: "This user already has administrator-granted access." }, { status: 409 });
    await prisma.userCombatSimulatorSubscription.create({ data: { userId: user.id, provider: "admin", status: "ACTIVE" } });
  } else {
    const guild = await prisma.guild.findUnique({ where: { id: body.targetId }, select: { id: true } });
    if (!guild) return NextResponse.json({ error: "Guild not found." }, { status: 404 });
    const existing = await prisma.guildCombatSimulatorSubscription.findFirst({
      where: { guildId: guild.id, provider: "admin", status: { in: ["ACTIVE", "TRIALING"] } },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ error: "This guild already has administrator-granted access." }, { status: 409 });
    await prisma.guildCombatSimulatorSubscription.create({ data: { guildId: guild.id, provider: "admin", status: "ACTIVE" } });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
