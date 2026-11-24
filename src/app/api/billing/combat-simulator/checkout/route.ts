import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getCurrentPlatformUser } from "@/lib/auth/platform";
import { prisma } from "@/lib/prisma";

type PurchaseType = "PERSONAL" | "GUILD";
type BillingTerm = "MONTHLY" | "ANNUAL";

function getPriceId(type: PurchaseType, term: BillingTerm) {
  const suffix = type === "PERSONAL" ? "PERSONAL" : "GUILD";
  return process.env[`STRIPE_PRICE_COMBAT_SIMULATOR_${suffix}_${term}`]
    ?? process.env[`STRIPE_COMBAT_SIMULATOR_${suffix}_PRICE_${term}`];
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentPlatformUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const body = await request.json() as { purchaseType?: PurchaseType; guildId?: string; billingTerm?: BillingTerm };
    const purchaseType = body.purchaseType;
    const billingTerm: BillingTerm = body.billingTerm === "ANNUAL" ? "ANNUAL" : "MONTHLY";
    if (purchaseType !== "PERSONAL" && purchaseType !== "GUILD") {
      return NextResponse.json({ error: "INVALID_PURCHASE_TYPE" }, { status: 400 });
    }

    let guildId: string | undefined;
    if (purchaseType === "GUILD") {
      guildId = body.guildId?.trim();
      if (!guildId) return NextResponse.json({ error: "GUILD_REQUIRED" }, { status: 400 });
      const guild = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true, ownerUserId: true, name: true } });
      if (!guild || guild.ownerUserId !== user.id) return NextResponse.json({ error: "GUILD_NOT_OWNED" }, { status: 403 });
      const baseSubscription = await prisma.guildSubscription.findFirst({
        where: { guildId, status: { in: ["ACTIVE", "TRIALING"] }, OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }] },
        select: { id: true },
      });
      if (!baseSubscription) return NextResponse.json({ error: "ACTIVE_GUILD_PLAN_REQUIRED" }, { status: 409 });
      const active = await prisma.guildCombatSimulatorSubscription.findFirst({
        where: { guildId, status: { in: ["ACTIVE", "TRIALING"] }, OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }] },
        select: { id: true },
      });
      if (active) return NextResponse.json({ error: "GUILD_ADDON_ALREADY_ACTIVE" }, { status: 409 });
    } else {
      const active = await prisma.userCombatSimulatorSubscription.findFirst({
        where: { userId: user.id, status: { in: ["ACTIVE", "TRIALING"] }, OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }] },
        select: { id: true },
      });
      if (active) return NextResponse.json({ error: "PERSONAL_SUBSCRIPTION_ALREADY_ACTIVE" }, { status: 409 });
    }

    const priceId = getPriceId(purchaseType, billingTerm);
    if (!priceId) return NextResponse.json({ error: `COMBAT_SIMULATOR_PRICE_NOT_CONFIGURED:${purchaseType}:${billingTerm}` }, { status: 500 });
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 500 });

    const stripe = new Stripe(secret);
    const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
    const metadata: Record<string, string> = {
      purchaseType: purchaseType === "PERSONAL" ? "COMBAT_SIMULATOR_PERSONAL" : "COMBAT_SIMULATOR_GUILD",
      userId: user.id,
      discordUserId: user.discordId,
      billingTerm,
    };
    if (guildId) metadata.guildId = guildId;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: guildId ?? user.id,
      metadata,
      subscription_data: { metadata },
      success_url: `${appUrl}/combat-simulator?checkout=success`,
      cancel_url: `${appUrl}/billing/new?combatSimulatorCheckout=canceled`,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return NextResponse.json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (error) {
    console.error("[COMBAT SIMULATOR CHECKOUT]", error);
    return NextResponse.json({ error: "CHECKOUT_FAILED" }, { status: 500 });
  }
}
