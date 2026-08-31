import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripePaymentProvider } from "@/lib/payments/stripe";
export const runtime = "nodejs";
function subscriptionStatus(status: Stripe.Subscription.Status) { switch (status) { case "active": return "ACTIVE" as const; case "trialing": return "TRIALING" as const; case "past_due": case "unpaid": return "PAST_DUE" as const; case "canceled": return "CANCELED" as const; default: return "INCOMPLETE" as const; } }
function subscriptionIsEntitled(status: Stripe.Subscription.Status) { return status === "active" || status === "trialing"; }
async function syncSubscription(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], subscription: Stripe.Subscription) {
  const existing = await tx.guildSubscription.findUnique({ where: { providerSubscriptionId: subscription.id }, include: { plan: { include: { modules: true } } } }); if (!existing) return;
  const status = subscriptionStatus(subscription.status); const entitled = subscriptionIsEntitled(subscription.status); const item = subscription.items.data[0];
  await tx.guildSubscription.update({ where: { id: existing.id }, data: { status, cancelAtPeriodEnd: subscription.cancel_at_period_end, currentPeriodStart: item?.current_period_start ? new Date(item.current_period_start * 1000) : existing.currentPeriodStart, currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : existing.currentPeriodEnd } });
  await tx.guildModuleEntitlement.updateMany({ where: { guildId: existing.guildId }, data: { enabled: false } });
  for (const module of existing.plan.modules) await tx.guildModuleEntitlement.upsert({ where: { guildId_module: { guildId: existing.guildId, module: module.module } }, create: { guildId: existing.guildId, module: module.module, enabled: entitled }, update: { enabled: entitled } });
}
async function recordAffiliateReferral(guildId: string, subscriptionId: string, affiliateId: string) {
  await prisma.$executeRawUnsafe('INSERT INTO "AffiliateReferral" ("id", "affiliateId", "guildId", "stripeSubscriptionId") VALUES ($1,$2,$3,$4) ON CONFLICT ("guildId") DO UPDATE SET "stripeSubscriptionId" = EXCLUDED."stripeSubscriptionId", "updatedAt" = NOW()', crypto.randomUUID(), affiliateId, guildId, subscriptionId);
}
async function recordAffiliateCommission(invoice: Stripe.Invoice) {
  const subscriptionId = typeof (invoice as unknown as { subscription?: string | { id: string } }).subscription === "string" ? (invoice as unknown as { subscription: string }).subscription : (invoice as unknown as { subscription?: { id: string } }).subscription?.id;
  if (!subscriptionId || invoice.amount_paid <= 0) return;
  const subscription = await stripePaymentProvider.getSubscription(subscriptionId) as Stripe.Subscription;
  const affiliateId = subscription.metadata?.affiliateId;
  if (!affiliateId) return;
  const subscriptionRow = await prisma.$queryRawUnsafe<Array<{ guildId: string }>>('SELECT "guildId" FROM "GuildSubscription" WHERE "providerSubscriptionId" = $1 LIMIT 1', subscriptionId);
  const guildId = subscriptionRow[0]?.guildId; if (!guildId) return;
  await recordAffiliateReferral(guildId, subscriptionId, affiliateId);
  const referrals = await prisma.$queryRawUnsafe<Array<{ id: string; affiliateId: string; commissionPercent: number }>>('SELECT r."id", r."affiliateId", a."commissionPercent" FROM "AffiliateReferral" r JOIN "Affiliate" a ON a."id" = r."affiliateId" WHERE r."stripeSubscriptionId" = $1 AND a."active" = TRUE LIMIT 1', subscriptionId);
  const referral = referrals[0]; if (!referral) return;
  const amountCents = Math.round(invoice.amount_paid * referral.commissionPercent / 100); if (amountCents <= 0) return;
  await prisma.$executeRawUnsafe('INSERT INTO "AffiliateCommission" ("id", "affiliateId", "referralId", "stripeInvoiceId", "amountCents", "currency", "status") VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT ("stripeInvoiceId") DO NOTHING', crypto.randomUUID(), referral.affiliateId, referral.id, invoice.id, amountCents, invoice.currency, "PENDING");
}
export async function POST(request: Request) {
  const payload = await request.text(); const signature = request.headers.get("stripe-signature"); if (!signature) return NextResponse.json({ error: "MISSING_STRIPE_SIGNATURE" }, { status: 400 });
  let event: Stripe.Event; try { event = await stripePaymentProvider.verifyWebhook(payload, signature) as Stripe.Event; } catch (error) { console.error("[STRIPE WEBHOOK] Invalid signature", error); return NextResponse.json({ error: "INVALID_STRIPE_SIGNATURE" }, { status: 400 }); }
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session; const metadata = session.metadata; const planId = metadata?.planId; const guildName = metadata?.guildName; const discordGuildId = metadata?.discordGuildId; const discordUserId = metadata?.discordUserId; const guildId = metadata?.guildId; const affiliateId = metadata?.affiliateId;
      if (!planId || !discordUserId || (!guildId && (!guildName || !discordGuildId))) return NextResponse.json({ error: "INVALID_CHECKOUT_METADATA" }, { status: 400 });
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id; const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id; if (!subscriptionId) return NextResponse.json({ error: "MISSING_STRIPE_SUBSCRIPTION" }, { status: 400 });
      let createdGuildId = guildId;
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { discordId: discordUserId } }); const plan = await tx.plan.findFirst({ where: { id: planId, active: true }, include: { modules: true } }); if (!user || !plan) throw new Error("CHECKOUT_USER_OR_PLAN_INVALID");
        if (guildId) { const guild = await tx.guild.findUnique({ where: { id: guildId } }); if (!guild || guild.ownerUserId !== user.id) throw new Error("GUILD_NOT_OWNED"); const duplicate = await tx.guildSubscription.findUnique({ where: { providerSubscriptionId: subscriptionId } }); if (duplicate) return; const active = await tx.guildSubscription.findFirst({ where: { guildId, status: { in: ["ACTIVE", "TRIALING"] }, OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }] }, select: { id: true } }); if (active) throw new Error("GUILD_ALREADY_SUBSCRIBED"); await tx.guildMembership.upsert({ where: { userId_guildId: { userId: user.id, guildId } }, update: { role: "ADMIN" }, create: { userId: user.id, guildId, role: "ADMIN" } }); await tx.guildSubscription.create({ data: { guildId, planId: plan.id, status: "ACTIVE", provider: "stripe", providerCustomerId: customerId, providerSubscriptionId: subscriptionId } }); await tx.guildModuleEntitlement.updateMany({ where: { guildId }, data: { enabled: false } }); await tx.guildModuleEntitlement.createMany({ data: plan.modules.map((module) => ({ guildId, module: module.module, enabled: true })), skipDuplicates: true }); return; }
        const existingGuild = await tx.guild.findUnique({ where: { discordGuildId: discordGuildId! } }); if (existingGuild) throw new Error("DISCORD_GUILD_ALREADY_REGISTERED"); const guild = await tx.guild.create({ data: { name: guildName!, discordGuildId: discordGuildId!, ownerUserId: user.id } }); createdGuildId = guild.id; await tx.guildMembership.create({ data: { guildId: guild.id, userId: user.id, role: "ADMIN" } }); await tx.guildSubscription.create({ data: { guildId: guild.id, planId: plan.id, status: "ACTIVE", provider: "stripe", providerCustomerId: customerId, providerSubscriptionId: subscriptionId } }); await tx.guildModuleEntitlement.createMany({ data: plan.modules.map((module) => ({ guildId: guild.id, module: module.module, enabled: true })) });
      });
      if (affiliateId && createdGuildId) await recordAffiliateReferral(createdGuildId, subscriptionId, affiliateId);
    }
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") await prisma.$transaction((tx) => syncSubscription(tx, event.data.object as Stripe.Subscription));
    if (event.type === "invoice.paid") await recordAffiliateCommission(event.data.object as Stripe.Invoice);
    return NextResponse.json({ received: true });
  } catch (error) { console.error("[STRIPE WEBHOOK] Processing failed", event.id, error); return NextResponse.json({ error: "WEBHOOK_PROCESSING_FAILED" }, { status: 500 }); }
}
