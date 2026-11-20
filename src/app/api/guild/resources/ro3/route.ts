import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { hasGuildModule, isRoocGuild, RESOURCE_SUITE_MODULE } from "@/lib/auth/modules";
import { prisma } from "@/lib/prisma";

const categories = ["CARD", "EQUIPMENT", "ECHO"] as const;
const capModes = ["TOTAL", "PER_CATEGORY", "COMBINED"] as const;

type AuthContext = NonNullable<Awaited<ReturnType<typeof getCurrentAuth>>>;

async function authorize(requireManage = false): Promise<{ auth: AuthContext; response?: never } | { response: ReturnType<typeof NextResponse.json>; auth?: never }> {
  const auth = await getCurrentAuth();
  if (!auth) return { response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  if (await isRoocGuild(auth.guild.id)) return { response: NextResponse.json({ error: "RO3 resource pools are only available to RO3 guilds." }, { status: 409 }) };
  if (!(await hasGuildModule(auth.guild.id, RESOURCE_SUITE_MODULE))) return { response: NextResponse.json({ error: "The Resource Suite is not subscribed for this guild." }, { status: 403 }) };
  if (!hasPermission(auth.role, requireManage ? "allocation.run" : "allocation.view")) return { response: NextResponse.json({ error: requireManage ? "You do not have permission to manage resources." : "You do not have permission to view resources." }, { status: 403 }) };
  return { auth };
}

export async function GET() {
  try {
    const access = await authorize(false);
    if (access.response) return access.response;
    const seasons = await prisma.ro3Season.findMany({
      where: { guildId: access.auth!.guild.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        resources: { orderBy: [{ category: "asc" }, { name: "asc" }] },
        eventTypes: { orderBy: { name: "asc" }, include: { rewardPool: { include: { resource: { select: { id: true, name: true, category: true } } }, orderBy: { resource: { name: "asc" } } } },
      },
    });
    return NextResponse.json({ seasons });
  } catch (error) {
    console.error("[RO3 RESOURCES GET]", error);
    return NextResponse.json({ error: "Failed to load RO3 resource pools." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const access = await authorize(true);
    if (access.response) return access.response;
    const guildId = access.auth!.guild.id;
    const body = await request.json();
    const action = body.action as string;

    if (action === "createSeason") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 80) return NextResponse.json({ error: "Enter a resource pool name (1–80 characters)." }, { status: 400 });
      const season = await prisma.ro3Season.create({ data: { guildId, name } });
      return NextResponse.json({ season }, { status: 201 });
    }

    if (action === "createResource") {
      const seasonId = typeof body.seasonId === "string" ? body.seasonId : "";
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const category = body.category;
      if (!name || name.length > 100 || !categories.includes(category)) return NextResponse.json({ error: "A valid resource name and category are required." }, { status: 400 });
      const season = await prisma.ro3Season.findFirst({ where: { id: seasonId, guildId } });
      if (!season || season.status === "ARCHIVED") return NextResponse.json({ error: "An editable resource pool could not be found." }, { status: 404 });
      const resource = await prisma.ro3SeasonResource.create({ data: { seasonId, name, category } });
      return NextResponse.json({ resource }, { status: 201 });
    }

    if (action === "createEventType") {
      const seasonId = typeof body.seasonId === "string" ? body.seasonId : "";
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 80) return NextResponse.json({ error: "Enter an event type name (1–80 characters)." }, { status: 400 });
      const season = await prisma.ro3Season.findFirst({ where: { id: seasonId, guildId } });
      if (!season || season.status === "ARCHIVED") return NextResponse.json({ error: "An editable resource pool could not be found." }, { status: 404 });
      const eventType = await prisma.ro3EventType.create({ data: { guildId, seasonId, name } });
      return NextResponse.json({ eventType }, { status: 201 });
    }

    if (action === "saveReward") {
      const eventTypeId = typeof body.eventTypeId === "string" ? body.eventTypeId : "";
      const resourceId = typeof body.resourceId === "string" ? body.resourceId : "";
      const quantity = body.quantity;
      if (!Number.isInteger(quantity) || quantity < 0) return NextResponse.json({ error: "Reward quantity must be a non-negative whole number." }, { status: 400 });
      const eventType = await prisma.ro3EventType.findFirst({ where: { id: eventTypeId, guildId }, include: { season: true } });
      const resource = await prisma.ro3SeasonResource.findFirst({ where: { id: resourceId, seasonId: eventType?.seasonId } });
      if (!eventType || !resource || eventType.season.status === "ARCHIVED") return NextResponse.json({ error: "Event type or resource does not belong to an editable pool." }, { status: 404 });
      const reward = await prisma.ro3EventRewardPool.upsert({
        where: { eventTypeId_resourceId: { eventTypeId, resourceId } },
        create: { eventTypeId, resourceId, quantity },
        update: { quantity },
      });
      return NextResponse.json({ reward });
    }

    return NextResponse.json({ error: "Unknown resource management action." }, { status: 400 });
  } catch (error) {
    console.error("[RO3 RESOURCES POST]", error);
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "That name or resource configuration already exists in this pool." }, { status: 409 });
    return NextResponse.json({ error: "Failed to save RO3 resource configuration." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await authorize(true);
    if (access.response) return access.response;
    const guildId = access.auth!.guild.id;
    const body = await request.json();
    const action = body.action as string;

    if (action === "updateSeason") {
      const seasonId = typeof body.seasonId === "string" ? body.seasonId : "";
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const capMode = body.capMode;
      const totalOptInCap = body.totalOptInCap === null || body.totalOptInCap === "" ? null : Number(body.totalOptInCap);
      const cardOptInCap = body.cardOptInCap === null || body.cardOptInCap === "" ? null : Number(body.cardOptInCap);
      const equipmentOptInCap = body.equipmentOptInCap === null || body.equipmentOptInCap === "" ? null : Number(body.equipmentOptInCap);
      const echoOptInCap = body.echoOptInCap === null || body.echoOptInCap === "" ? null : Number(body.echoOptInCap);
      if (!name || name.length > 80 || !capModes.includes(capMode)) return NextResponse.json({ error: "A valid pool name and cap mode are required." }, { status: 400 });
      const values = [totalOptInCap, cardOptInCap, equipmentOptInCap, echoOptInCap];
      if (values.some((v) => v !== null && (!Number.isInteger(v) || v < 1))) return NextResponse.json({ error: "Opt-in caps must be positive whole numbers or left blank." }, { status: 400 });
      if ((capMode === "TOTAL" || capMode === "COMBINED") && totalOptInCap === null) return NextResponse.json({ error: "Set an overall cap for this cap mode." }, { status: 400 });
      if ((capMode === "PER_CATEGORY" || capMode === "COMBINED") && [cardOptInCap, equipmentOptInCap, echoOptInCap].some((v) => v === null)) return NextResponse.json({ error: "Set a cap for Cards, Equipment and Echoes for this cap mode." }, { status: 400 });
      const existing = await prisma.ro3Season.findFirst({ where: { id: seasonId, guildId } });
      if (!existing || existing.status === "ARCHIVED") return NextResponse.json({ error: "Editable resource pool not found." }, { status: 404 });
      const season = await prisma.ro3Season.update({ where: { id: seasonId }, data: { name, capMode, totalOptInCap, cardOptInCap, equipmentOptInCap, echoOptInCap } });
      return NextResponse.json({ season });
    }

    if (action === "setSeasonStatus") {
      const seasonId = typeof body.seasonId === "string" ? body.seasonId : "";
      const status = body.status;
      if (!["ACTIVE", "ARCHIVED", "DRAFT"].includes(status)) return NextResponse.json({ error: "Invalid resource pool status." }, { status: 400 });
      const existing = await prisma.ro3Season.findFirst({ where: { id: seasonId, guildId } });
      if (!existing) return NextResponse.json({ error: "Resource pool not found." }, { status: 404 });
      const season = await prisma.$transaction(async (tx) => {
        if (status === "ACTIVE") await tx.ro3Season.updateMany({ where: { guildId, status: "ACTIVE", NOT: { id: seasonId } }, data: { status: "ARCHIVED" } });
        return tx.ro3Season.update({ where: { id: seasonId }, data: { status } });
      });
      return NextResponse.json({ season });
    }

    if (action === "setResourceActive") {
      const resourceId = typeof body.resourceId === "string" ? body.resourceId : "";
      const active = body.active;
      if (typeof active !== "boolean") return NextResponse.json({ error: "A resource status is required." }, { status: 400 });
      const resource = await prisma.ro3SeasonResource.findFirst({ where: { id: resourceId, season: { guildId, status: { not: "ARCHIVED" } } } });
      if (!resource) return NextResponse.json({ error: "Resource not found in an editable pool." }, { status: 404 });
      const updated = await prisma.ro3SeasonResource.update({ where: { id: resourceId }, data: { active } });
      return NextResponse.json({ resource: updated });
    }

    if (action === "setEventTypeActive") {
      const eventTypeId = typeof body.eventTypeId === "string" ? body.eventTypeId : "";
      const active = body.active;
      if (typeof active !== "boolean") return NextResponse.json({ error: "An event type status is required." }, { status: 400 });
      const eventType = await prisma.ro3EventType.findFirst({ where: { id: eventTypeId, guildId, season: { status: { not: "ARCHIVED" } } } });
      if (!eventType) return NextResponse.json({ error: "Event type not found in an editable pool." }, { status: 404 });
      const updated = await prisma.ro3EventType.update({ where: { id: eventTypeId }, data: { active } });
      return NextResponse.json({ eventType: updated });
    }

    return NextResponse.json({ error: "Unknown resource management action." }, { status: 400 });
  } catch (error) {
    console.error("[RO3 RESOURCES PATCH]", error);
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "A resource pool with that name already exists." }, { status: 409 });
    return NextResponse.json({ error: "Failed to update RO3 resource configuration." }, { status: 500 });
  }
}
