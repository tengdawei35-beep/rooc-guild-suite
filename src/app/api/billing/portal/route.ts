import { NextResponse } from "next/server";

import { getCurrentPlatformUser } from "@/lib/auth/platform";
import { prisma } from "@/lib/prisma";
import { stripePaymentProvider } from "@/lib/payments/stripe";

export async function POST(request: Request) {
  try {
    const user = await getCurrentPlatformUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const body = await request.json() as { guildId?: string };
    const guildId = body.guildId?.trim();
    if (!guildId) return NextResponse.json({ error: "GUILD_REQUIRED" }, { status: 400 });

    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      include: {
        subscriptions: {
          where: { provider: "stripe", providerCustomerId: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { providerCustomerId: true },
        },
      },
    });

    if (!guild || guild.ownerUserId !== user.id) {
      return NextResponse.json({ error: "GUILD_NOT_OWNED" }, { status: 403 });
    }

    const customerId = guild.subscriptions[0]?.providerCustomerId;
    if (!customerId) return NextResponse.json({ error: "STRIPE_CUSTOMER_NOT_FOUND" }, { status: 404 });

    const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
    const portal = await stripePaymentProvider.createCustomerPortal(customerId, `${appUrl}/billing/new`);
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    console.error("[BILLING PORTAL]", error);
    return NextResponse.json({ error: "PORTAL_FAILED" }, { status: 500 });
  }
}
