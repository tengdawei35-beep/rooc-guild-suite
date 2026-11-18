import { NextResponse } from "next/server";

import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

async function requireAdminResponse() {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  return null;
}

function parseDuration(value: unknown): number | null | undefined {
  if (value === "permanent") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export async function POST(request: Request) {
  const denied = await requireAdminResponse();
  if (denied) return denied;

  try {
    const body = await request.json() as { guildId?: string; planId?: string; durationMonths?: number | "permanent" };
    const guildId = body.guildId?.trim();
    const planId = body.planId?.trim();
    const durationMonths = parseDuration(body.durationMonths);

    if (!guildId || !planId) return NextResponse.json({ error: "Guild and plan are required." }, { status: 400 });
    if (durationMonths === undefined) return NextResponse.json({ error: "Duration must be a positive number of months or permanent." }, { status: 400 });

    const [guild, plan, latestSubscription] = await Promise.all([
      prisma.guild.findUnique({ where: { id: guildId }, select: { id: true, name: true } }),
      prisma.plan.findUnique({ where: { id: planId }, include: { modules: true } }),
      prisma.guildSubscription.findFirst({ where: { guildId }, orderBy: { createdAt: "desc" }, include: { plan: true } }),
    ]);

    if (!guild) return NextResponse.json({ error: "Guild not found." }, { status: 404 });
    if (!plan?.active) return NextResponse.json({ error: "Selected plan is not active." }, { status: 400 });

    const latestIsPaidActive = latestSubscription
      && (latestSubscription.status === "ACTIVE" || latestSubscription.status === "TRIALING")
      && latestSubscription.provider !== "complimentary"
      && (!latestSubscription.currentPeriodEnd || latestSubscription.currentPeriodEnd > new Date());

    if (latestIsPaidActive) {
      return NextResponse.json({ error: "This guild has an active paid subscription. Cancel or replace it through billing before granting complimentary access." }, { status: 409 });
    }

    const now = new Date();
    let currentPeriodEnd: Date | null = null;
    if (durationMonths !== null) {
      currentPeriodEnd = new Date(now);
      if (latestSubscription?.provider === "complimentary" && latestSubscription.currentPeriodEnd && latestSubscription.currentPeriodEnd > now) {
        currentPeriodEnd = new Date(latestSubscription.currentPeriodEnd);
      }
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + durationMonths);
    }

    const subscription = await prisma.$transaction(async (tx) => {
      const savedSubscription = latestSubscription
        ? await tx.guildSubscription.update({
            where: { id: latestSubscription.id },
            data: {
              planId: plan.id,
              status: "ACTIVE",
              provider: "complimentary",
              providerCustomerId: null,
              providerSubscriptionId: null,
              currentPeriodStart: now,
              currentPeriodEnd,
              cancelAtPeriodEnd: false,
            },
            include: { plan: true },
          })
        : await tx.guildSubscription.create({
            data: {
              guildId,
              planId: plan.id,
              status: "ACTIVE",
              provider: "complimentary",
              currentPeriodStart: now,
              currentPeriodEnd,
              cancelAtPeriodEnd: false,
            },
            include: { plan: true },
          });

      await tx.guildModuleEntitlement.deleteMany({ where: { guildId } });
      if (plan.modules.length) {
        await tx.guildModuleEntitlement.createMany({
          data: plan.modules.map((module) => ({ guildId, module: module.module, enabled: true })),
        });
      }

      return savedSubscription;
    });

    return NextResponse.json({
      success: true,
      guild: { id: guild.id, name: guild.name },
      subscription: {
        planName: subscription.plan.name,
        expiresAt: subscription.currentPeriodEnd?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("[ADMIN] Failed to grant guild access:", error);
    return NextResponse.json({ error: "Failed to grant guild access." }, { status: 500 });
  }
}
