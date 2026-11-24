import { NextResponse } from "next/server";
import { getCurrentPlatformUser } from "@/lib/auth/platform";
import { prisma } from "@/lib/prisma";
import { stripePaymentProvider } from "@/lib/payments/stripe";

type PortalType = "GUILD_PLAN" | "GUILD_COMBAT_SIMULATOR" | "PERSONAL_COMBAT_SIMULATOR";

export async function POST(request: Request) {
  try {
    const user = await getCurrentPlatformUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const body = await request.json() as { guildId?: string; subscriptionType?: PortalType };
    const subscriptionType = body.subscriptionType ?? "GUILD_PLAN";
    let customerId: string | null | undefined;

    if (subscriptionType === "PERSONAL_COMBAT_SIMULATOR") {
      const subscription = await prisma.userCombatSimulatorSubscription.findFirst({
        where: { userId: user.id, provider: "stripe", providerCustomerId: { not: null } },
        orderBy: { createdAt: "desc" }, select: { providerCustomerId: true },
      });
      customerId = subscription?.providerCustomerId;
    } else {
      const guildId = body.guildId?.trim();
      if (!guildId) return NextResponse.json({ error: "GUILD_REQUIRED" }, { status: 400 });
      const guild = await prisma.guild.findUnique({ where: { id: guildId }, select: { ownerUserId: true } });
      if (!guild || guild.ownerUserId !== user.id) return NextResponse.json({ error: "GUILD_NOT_OWNED" }, { status: 403 });
      if (subscriptionType === "GUILD_COMBAT_SIMULATOR") {
        const subscription = await prisma.guildCombatSimulatorSubscription.findFirst({
          where: { guildId, provider: "stripe", providerCustomerId: { not: null } },
          orderBy: { createdAt: "desc" }, select: { providerCustomerId: true },
        });
        customerId = subscription?.providerCustomerId;
      } else {
        const subscription = await prisma.guildSubscription.findFirst({
          where: { guildId, provider: "stripe", providerCustomerId: { not: null } },
          orderBy: { createdAt: "desc" }, select: { providerCustomerId: true },
        });
        customerId = subscription?.providerCustomerId;
      }
    }

    if (!customerId) return NextResponse.json({ error: "STRIPE_CUSTOMER_NOT_FOUND" }, { status: 404 });
    const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
    const portal = await stripePaymentProvider.createCustomerPortal(customerId, `${appUrl}/billing/new`);
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    console.error("[BILLING PORTAL]", error);
    return NextResponse.json({ error: "PORTAL_FAILED" }, { status: 500 });
  }
}
