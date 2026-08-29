import { NextResponse } from "next/server";

import { getCurrentPlatformUser } from "@/lib/auth/platform";
import { prisma } from "@/lib/prisma";
import { stripePaymentProvider } from "@/lib/payments/stripe";

function getStripePriceEnvKey(planName: string) {
  const normalized = planName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  return `STRIPE_PRICE_${normalized}`;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentPlatformUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const creator = await prisma.platformGuildCreator.findUnique({
      where: { discordUserId: user.discordId },
    });
    if (!creator?.active) {
      return NextResponse.json({ error: "GUILD_CREATION_NOT_AUTHORIZED" }, { status: 403 });
    }

    const ownedGuildCount = await prisma.guild.count({ where: { ownerUserId: user.id } });
    if (ownedGuildCount >= creator.maxGuilds) {
      return NextResponse.json({ error: "GUILD_CREATION_LIMIT_REACHED" }, { status: 403 });
    }

    const body = await request.json() as {
      planId?: string;
      guildName?: string;
      discordGuildId?: string;
    };

    const planId = body.planId?.trim();
    const guildName = body.guildName?.trim();
    const discordGuildId = body.discordGuildId?.trim();

    if (!planId || !guildName || !discordGuildId) {
      return NextResponse.json({ error: "PLAN_AND_GUILD_DETAILS_REQUIRED" }, { status: 400 });
    }
    if (guildName.length < 2 || guildName.length > 100) {
      return NextResponse.json({ error: "INVALID_GUILD_NAME" }, { status: 400 });
    }
    if (!/^\d{17,20}$/.test(discordGuildId)) {
      return NextResponse.json({ error: "INVALID_DISCORD_GUILD_ID" }, { status: 400 });
    }

    const existingGuild = await prisma.guild.findUnique({ where: { discordGuildId } });
    if (existingGuild) {
      return NextResponse.json({ error: "DISCORD_GUILD_ALREADY_REGISTERED" }, { status: 409 });
    }

    const plan = await prisma.plan.findFirst({
      where: { id: planId, active: true },
      include: { modules: true },
    });
    if (!plan) return NextResponse.json({ error: "INVALID_PLAN" }, { status: 400 });

    const priceId = process.env[getStripePriceEnvKey(plan.name)];
    if (!priceId) {
      return NextResponse.json(
        { error: `STRIPE_PRICE_NOT_CONFIGURED_FOR_PLAN:${plan.name}` },
        { status: 500 },
      );
    }

    const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
    const session = await stripePaymentProvider.createCheckout({
      planId: priceId,
      customer: {
        discordUserId: user.discordId,
        username: user.username,
      },
      onboarding: { guildName, discordGuildId },
      successUrl: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/billing/new?canceled=1`,
    });

    return NextResponse.json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (error) {
    console.error("[BILLING CHECKOUT]", error);
    return NextResponse.json({ error: "CHECKOUT_FAILED" }, { status: 500 });
  }
}
