import { NextResponse } from "next/server";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function getDiscordRoles() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_OFFICIAL_GUILD_ID;
  if (!token || !guildId) throw new Error("DISCORD_BOT_TOKEN or DISCORD_OFFICIAL_GUILD_ID is not configured.");
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Discord roles request failed (${response.status}).`);
  return await response.json() as Array<{ id: string; name: string; managed: boolean; position: number }>;
}

export async function GET() {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const [plans, mappings, roles] = await Promise.all([
      prisma.plan.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.discordSubscriptionRoleMapping.findMany({ include: { plan: { select: { id: true, name: true } } }, orderBy: { plan: { name: "asc" } } }),
      getDiscordRoles(),
    ]);
    return NextResponse.json({ plans, mappings, roles: roles.filter((role) => !role.managed).map(({ id, name, position }) => ({ id, name, position })) });
  } catch (error) {
    console.error("[DISCORD ROLE MAPPINGS]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "DISCORD_CONFIGURATION_ERROR" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const body = await request.json() as { planId?: string; discordRoleId?: string; enabled?: boolean };
    if (!body.planId || !body.discordRoleId) return NextResponse.json({ error: "PLAN_AND_ROLE_REQUIRED" }, { status: 400 });
    const [plan, roles] = await Promise.all([
      prisma.plan.findUnique({ where: { id: body.planId }, select: { id: true } }),
      getDiscordRoles(),
    ]);
    if (!plan) return NextResponse.json({ error: "PLAN_NOT_FOUND" }, { status: 404 });
    const role = roles.find((item) => item.id === body.discordRoleId);
    if (!role || role.managed) return NextResponse.json({ error: "DISCORD_ROLE_NOT_ASSIGNABLE" }, { status: 400 });
    const mapping = await prisma.discordSubscriptionRoleMapping.upsert({
      where: { planId: plan.id },
      create: { planId: plan.id, discordRoleId: role.id, discordRoleName: role.name, enabled: body.enabled ?? true },
      update: { discordRoleId: role.id, discordRoleName: role.name, enabled: body.enabled ?? true },
      include: { plan: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ mapping });
  } catch (error) {
    console.error("[DISCORD ROLE MAPPINGS]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "ROLE_MAPPING_SAVE_FAILED" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const planId = searchParams.get("planId");
  if (!planId) return NextResponse.json({ error: "PLAN_REQUIRED" }, { status: 400 });
  await prisma.discordSubscriptionRoleMapping.deleteMany({ where: { planId } });
  return NextResponse.json({ success: true });
}
