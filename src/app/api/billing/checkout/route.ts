import { NextResponse } from "next/server";
import { getCurrentPlatformUser } from "@/lib/auth/platform";
import { prisma } from "@/lib/prisma";
import { stripePaymentProvider } from "@/lib/payments/stripe";

const BILLING_TERMS = { monthly: { env: "MONTHLY", months: 1 }, quarterly: { env: "3_MONTH", months: 3 }, semiannual: { env: "6_MONTH", months: 6 }, annual: { env: "YEARLY", months: 12 } } as const;
type BillingTerm = keyof typeof BILLING_TERMS;
function getStripePriceId(planName: string, billingTerm: BillingTerm) {
  const normalized = planName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_"); const term = BILLING_TERMS[billingTerm].env;
  return [process.env[`STRIPE_PRICE_${normalized}_${term}`], process.env[`${normalized}_PRICE_${term}`], process.env[`${normalized}_${term}_PRICE_ID`], billingTerm === "monthly" ? process.env[`STRIPE_PRICE_${normalized}`] : undefined, billingTerm === "monthly" ? process.env[`${normalized}_PRICE_ID`] : undefined].find(Boolean);
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentPlatformUser(); if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const body = await request.json() as { planId?: string; guildId?: string; guildName?: string; discordGuildId?: string; billingTerm?: BillingTerm; referralCode?: string; validateReferralCode?: string };

    if (body.validateReferralCode !== undefined) {
      const code = body.validateReferralCode.trim().toUpperCase();
      if (!code) return NextResponse.json({ valid: false }, { status: 400 });
      const rows = await prisma.$queryRaw<Array<{ name: string; discountPercent: number }>>`
        SELECT "name", "discountPercent"
        FROM "Affiliate"
        WHERE UPPER("code") = ${code} AND "active" = true
        LIMIT 1
      `;
      const affiliate = rows[0];
      if (!affiliate) return NextResponse.json({ valid: false, error: "INVALID_REFERRAL_CODE" }, { status: 400 });
      return NextResponse.json({ valid: true, affiliateName: affiliate.name, discountPercent: affiliate.discountPercent });
    }

    const planId = body.planId?.trim(); const guildId = body.guildId?.trim(); const guildName = body.guildName?.trim(); const discordGuildId = body.discordGuildId?.trim();
    const billingTerm: BillingTerm = body.billingTerm && body.billingTerm in BILLING_TERMS ? body.billingTerm : "monthly";
    if (!planId) return NextResponse.json({ error: "PLAN_REQUIRED" }, { status: 400 });
    const plan = await prisma.plan.findFirst({ where: { id: planId, active: true }, include: { modules: true } });
    if (!plan) return NextResponse.json({ error: "INVALID_PLAN" }, { status: 400 });

    let onboarding: { guildName: string; discordGuildId: string } | undefined;
    if (guildId) {
      const guild = await prisma.guild.findUnique({ where: { id: guildId }, include: { subscriptions: { where: { status: { in: ["ACTIVE", "TRIALING"] }, OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }] }, select: { id: true } } } });
      if (!guild || guild.ownerUserId !== user.id) return NextResponse.json({ error: "GUILD_NOT_OWNED" }, { status: 403 });
      if (guild.subscriptions.length > 0) return NextResponse.json({ error: "GUILD_ALREADY_SUBSCRIBED" }, { status: 409 });
      onboarding = { guildName: guild.name, discordGuildId: guild.discordGuildId };
    } else {
      if (!guildName || !discordGuildId) return NextResponse.json({ error: "PLAN_AND_GUILD_DETAILS_REQUIRED" }, { status: 400 });
      if (guildName.length < 2 || guildName.length > 100) return NextResponse.json({ error: "INVALID_GUILD_NAME" }, { status: 400 });
      if (!/^\d{17,20}$/.test(discordGuildId)) return NextResponse.json({ error: "INVALID_DISCORD_GUILD_ID" }, { status: 400 });
      if (await prisma.guild.findUnique({ where: { discordGuildId } })) return NextResponse.json({ error: "DISCORD_GUILD_ALREADY_REGISTERED" }, { status: 409 });
      onboarding = { guildName, discordGuildId };
    }

    let affiliate: { id: string; code: string; discountPercent: number } | undefined;
    if (body.referralCode?.trim()) {
      const code = body.referralCode.trim().toUpperCase();
      const rows = await prisma.$queryRaw<Array<{ id: string; code: string; discountPercent: number }>>`
        SELECT "id", "code", "discountPercent"
        FROM "Affiliate"
        WHERE UPPER("code") = ${code} AND "active" = true
        LIMIT 1
      `;
      const found = rows[0];
      if (!found) return NextResponse.json({ error: "INVALID_REFERRAL_CODE" }, { status: 400 });
      affiliate = found;
    }

    const stripePriceId = getStripePriceId(plan.name, billingTerm);
    if (!stripePriceId) return NextResponse.json({ error: `STRIPE_PRICE_NOT_CONFIGURED_FOR_PLAN_AND_TERM:${plan.name}:${billingTerm}` }, { status: 500 });
    const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
    const session = await stripePaymentProvider.createCheckout({ ...(guildId ? { guildId } : {}), planId, stripePriceId, billingTerm, customer: { discordUserId: user.discordId, username: user.username }, onboarding, affiliate, successUrl: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${appUrl}/billing/new?canceled=1` });
    return NextResponse.json({ checkoutUrl: session.url, sessionId: session.id, affiliateDiscountPercent: affiliate?.discountPercent ?? 0 });
  } catch (error) { console.error("[BILLING CHECKOUT]", error); return NextResponse.json({ error: "CHECKOUT_FAILED" }, { status: 500 }); }
}
