import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { getCurrentAuth } from "@/lib/auth";
import { hasGuildModule, isRoocGuild, RESOURCE_SUITE_MODULE } from "@/lib/auth/modules";
import { prisma } from "@/lib/prisma";

type Category = "CARD" | "EQUIPMENT" | "ECHO";
type CapMode = "TOTAL" | "PER_CATEGORY" | "COMBINED";

function withinCaps(ids: Set<string>, categories: Map<string, Category>, season: {
  capMode: CapMode; totalOptInCap: number | null; cardOptInCap: number | null;
  equipmentOptInCap: number | null; echoOptInCap: number | null;
}) {
  const counts = { CARD: 0, EQUIPMENT: 0, ECHO: 0 };
  for (const id of ids) {
    const category = categories.get(id);
    if (category) counts[category] += 1;
  }
  if ((season.capMode === "TOTAL" || season.capMode === "COMBINED") &&
      (season.totalOptInCap === null || ids.size > season.totalOptInCap)) return false;
  if ((season.capMode === "PER_CATEGORY" || season.capMode === "COMBINED") &&
      (season.cardOptInCap === null || season.equipmentOptInCap === null || season.echoOptInCap === null ||
       counts.CARD > season.cardOptInCap || counts.EQUIPMENT > season.equipmentOptInCap || counts.ECHO > season.echoOptInCap)) return false;
  return true;
}

function capIsConfigured(season: {
  capMode: CapMode; totalOptInCap: number | null; cardOptInCap: number | null;
  equipmentOptInCap: number | null; echoOptInCap: number | null;
}) {
  return (season.capMode === "TOTAL" && season.totalOptInCap !== null) ||
    (season.capMode === "PER_CATEGORY" && season.cardOptInCap !== null && season.equipmentOptInCap !== null && season.echoOptInCap !== null) ||
    (season.capMode === "COMBINED" && season.totalOptInCap !== null && season.cardOptInCap !== null && season.equipmentOptInCap !== null && season.echoOptInCap !== null);
}

async function authorize() {
  const auth = await getCurrentAuth();
  if (!auth) return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) } as const;
  if (await isRoocGuild(auth.guild.id)) return { error: NextResponse.json({ error: "RO3 opt-ins are only available to RO3 guilds." }, { status: 409 }) } as const;
  if (!(await hasGuildModule(auth.guild.id, RESOURCE_SUITE_MODULE))) return { error: NextResponse.json({ error: "The Resource Suite is not subscribed for this guild." }, { status: 403 }) } as const;
  const member = await prisma.guildMember.findFirst({
    where: { guildId: auth.guild.id, active: true, OR: [{ userId: auth.user.id }, { discordUserId: auth.user.discordId }] },
    select: { id: true },
  });
  if (!member) return { error: NextResponse.json({ error: "Your Discord account is not linked to an active guild character." }, { status: 403 }) } as const;
  const season = await prisma.ro3Season.findFirst({
    where: { guildId: auth.guild.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, capMode: true, totalOptInCap: true, cardOptInCap: true, equipmentOptInCap: true, echoOptInCap: true },
  });
  if (!season) return { error: NextResponse.json({ error: "There is no active resource pool for this guild." }, { status: 409 }) } as const;
  if (!capIsConfigured(season)) return { error: NextResponse.json({ error: "Guild management has not configured opt-in limits for the active resource pool." }, { status: 409 }) } as const;
  return { auth, member, season } as const;
}

export async function GET() {
  try {
    const access = await authorize();
    if ("error" in access) return access.error;
    const { auth, member, season } = access;
    const now = new Date();
    const [resources, persistent, eventOptIns, events] = await Promise.all([
      prisma.ro3SeasonResource.findMany({ where: { seasonId: season.id, active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
      prisma.ro3PersistentInterest.findMany({ where: { memberId: member.id, resource: { is: { seasonId: season.id, active: true } }, active: true }, select: { resourceId: true } }),
      prisma.ro3EventOptIn.findMany({
        where: { memberId: member.id, event: { is: { guildId: auth.guild.id, date: { gt: now }, ro3EventType: { is: { seasonId: season.id, active: true } } } }, resource: { is: { seasonId: season.id, active: true } } },
        include: { event: { select: { date: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      prisma.event.findMany({
        where: { guildId: auth.guild.id, date: { gt: now }, ro3EventType: { is: { seasonId: season.id, active: true } } },
        orderBy: { date: "asc" },
        include: {
          ro3EventType: { include: { rewardPool: { where: { quantity: { gt: 0 } }, include: { resource: { select: { id: true, name: true, category: true, active: true } } } } } },
          ro3EventOptIns: { where: { memberId: member.id }, select: { resourceId: true } },
        },
      }),
    ]);
    const categories = new Map(resources.map(resource => [resource.id, resource.category as Category]));
    const persistentIds = new Set(persistent.map(item => item.resourceId));
    const acceptedEventIds = new Set<string>(persistentIds);
    for (const item of eventOptIns) {
      const next = new Set(acceptedEventIds);
      next.add(item.resourceId);
      if (withinCaps(next, categories, season)) acceptedEventIds.add(item.resourceId);
    }
    const allIds = new Set(acceptedEventIds);
    const counts = { CARD: 0, EQUIPMENT: 0, ECHO: 0 };
    for (const id of allIds) { const category = categories.get(id); if (category) counts[category] += 1; }
    return NextResponse.json({
      member: { id: member.id },
      season: { id: season.id, name: season.name, capMode: season.capMode, totalOptInCap: season.totalOptInCap, cardOptInCap: season.cardOptInCap, equipmentOptInCap: season.equipmentOptInCap, echoOptInCap: season.echoOptInCap },
      resources: resources.map(resource => ({ id: resource.id, name: resource.name, category: resource.category, persistent: persistentIds.has(resource.id) })),
      events: events.map(event => ({
        id: event.id, date: event.date, typeName: event.ro3EventType?.name ?? "Event",
        locked: event.ro3OptInsLockedAt !== null,
        rewards: event.ro3EventType?.rewardPool.filter(reward => reward.resource.active).map(reward => ({
          id: reward.resource.id, name: reward.resource.name, category: reward.resource.category,
          selected: event.ro3EventOptIns.some(item => item.resourceId === reward.resource.id),
          accepted: acceptedEventIds.has(reward.resource.id),
          persistent: persistentIds.has(reward.resource.id),
        })) ?? [],
      })),
      usage: { distinct: allIds.size, categories: counts, remainingTotal: season.totalOptInCap === null ? null : Math.max(0, season.totalOptInCap - allIds.size) },
    });
  } catch (error) {
    console.error("[RO3 OPT-INS GET]", error);
    return NextResponse.json({ error: "Failed to load your RO3 opt-ins." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const access = await authorize();
    if ("error" in access) return access.error;
    const { auth, member, season } = access;
    const body = await request.json() as { action?: string; resourceId?: string; eventId?: string; selected?: boolean };
    if (typeof body.resourceId !== "string" || typeof body.selected !== "boolean") return NextResponse.json({ error: "A resource and selection state are required." }, { status: 400 });

    const result = await prisma.$transaction(async tx => {
      const resource = await tx.ro3SeasonResource.findFirst({ where: { id: body.resourceId, seasonId: season.id, active: true }, select: { id: true, category: true } });
      if (!resource) throw new Error("RESOURCE_NOT_AVAILABLE");

      if (body.action === "persistent") {
        if (body.selected) {
          const current = await tx.ro3PersistentInterest.findMany({ where: { memberId: member.id, active: true, resource: { is: { seasonId: season.id, active: true } } }, select: { resourceId: true } });
          const ids = new Set(current.map(item => item.resourceId)); ids.add(resource.id);
          const categories = new Map((await tx.ro3SeasonResource.findMany({ where: { seasonId: season.id, active: true }, select: { id: true, category: true } })).map(item => [item.id, item.category as Category]));
          if (!withinCaps(ids, categories, season)) throw new Error("PERSISTENT_CAP_REACHED");
          await tx.ro3PersistentInterest.upsert({
            where: { memberId_resourceId: { memberId: member.id, resourceId: resource.id } },
            create: { memberId: member.id, resourceId: resource.id, quantity: 1, active: true },
            update: { active: true, quantity: 1 },
          });
        } else {
          await tx.ro3PersistentInterest.updateMany({ where: { memberId: member.id, resourceId: resource.id }, data: { active: false } });
        }
      } else if (body.action === "event") {
        if (typeof body.eventId !== "string") throw new Error("EVENT_REQUIRED");
        const event = await tx.event.findFirst({
          where: { id: body.eventId, guildId: auth.guild.id, date: { gt: new Date() }, ro3OptInsLockedAt: null, ro3EventType: { is: { seasonId: season.id, active: true } } },
          include: { ro3EventType: { include: { rewardPool: { where: { resourceId: resource.id, quantity: { gt: 0 } } } } } },
        });
        if (!event) throw new Error("EVENT_NOT_AVAILABLE_OR_LOCKED");
        const rewardAvailable = event.ro3EventType?.rewardPool.some(item => item.resourceId === resource.id);
        if (!rewardAvailable) throw new Error("RESOURCE_NOT_IN_EVENT_REWARDS");
        if (body.selected) {
          const [persistent, eventSelections, allResources] = await Promise.all([
            tx.ro3PersistentInterest.findMany({ where: { memberId: member.id, active: true, resource: { is: { seasonId: season.id, active: true } } }, select: { resourceId: true } }),
            tx.ro3EventOptIn.findMany({
              where: { memberId: member.id, event: { is: { guildId: auth.guild.id, date: { gt: new Date() }, ro3EventType: { is: { seasonId: season.id, active: true } } } }, resource: { is: { seasonId: season.id, active: true } } },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { resourceId: true },
            }),
            tx.ro3SeasonResource.findMany({ where: { seasonId: season.id, active: true }, select: { id: true, category: true } }),
          ]);
          const categories = new Map(allResources.map(item => [item.id, item.category as Category]));
          const accepted = new Set(persistent.map(item => item.resourceId));
          for (const item of eventSelections) {
            const next = new Set(accepted); next.add(item.resourceId);
            if (withinCaps(next, categories, season)) accepted.add(item.resourceId);
          }
          const next = new Set(accepted); next.add(resource.id);
          if (!withinCaps(next, categories, season)) throw new Error("EVENT_CAP_REACHED");
          await tx.ro3EventOptIn.upsert({
            where: { eventId_memberId_resourceId: { eventId: event.id, memberId: member.id, resourceId: resource.id } },
            create: { eventId: event.id, memberId: member.id, resourceId: resource.id, quantity: 1 },
            update: { quantity: 1 },
          });
        } else {
          await tx.ro3EventOptIn.deleteMany({ where: { eventId: event.id, memberId: member.id, resourceId: resource.id } });
        }
      } else {
        throw new Error("UNKNOWN_ACTION");
      }
      return { success: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const errors: Record<string, { status: number; text: string }> = {
      RESOURCE_NOT_AVAILABLE: { status: 404, text: "That resource is not available in the active pool." },
      PERSISTENT_CAP_REACHED: { status: 409, text: "That Persistent Opt-in exceeds your configured resource cap." },
      EVENT_REQUIRED: { status: 400, text: "Select an upcoming event." },
      EVENT_NOT_AVAILABLE_OR_LOCKED: { status: 409, text: "This event is no longer open for Event Opt-ins." },
      RESOURCE_NOT_IN_EVENT_REWARDS: { status: 400, text: "That resource is not offered for this event." },
      EVENT_CAP_REACHED: { status: 409, text: "Persistent Opt-ins take priority. There is not enough remaining cap space for this Event Opt-in." },
      UNKNOWN_ACTION: { status: 400, text: "Unknown opt-in action." },
    };
    if (message in errors) return NextResponse.json({ error: errors[message].text }, { status: errors[message].status });
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") return NextResponse.json({ error: "Your opt-ins changed at the same time. Refresh and try again." }, { status: 409 });
    console.error("[RO3 OPT-INS POST]", error);
    return NextResponse.json({ error: "Failed to save your RO3 opt-in." }, { status: 500 });
  }
}
