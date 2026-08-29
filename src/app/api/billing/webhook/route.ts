import { NextResponse } from "next/server";
import Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { stripePaymentProvider } from "@/lib/payments/stripe";

export const runtime = "nodejs";

function subscriptionStatus(status: Stripe.Subscription.Status) {
  switch (status) {
    case "active":
      return "ACTIVE" as const;
    case "trialing":
      return "TRIALING" as const;
    case "past_due":
    case "unpaid":
      return "PAST_DUE" as const;
    case "canceled":
      return "CANCELED" as const;
    default:
      return "INCOMPLETE" as const;
  }
}

function subscriptionIsEntitled(status: Stripe.Subscription.Status) {
  return status === "active" || status === "trialing";
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) return NextResponse.json({ error: "MISSING_STRIPE_SIGNATURE" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripePaymentProvider.verifyWebhook(payload, signature) as Stripe.Event;
  } catch (error) {
    console.error("[STRIPE WEBHOOK] Invalid signature", error);
    return NextResponse.json({ error: "INVALID_STRIPE_SIGNATURE" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata;
      const planId = metadata?.planId;
      const guildName = metadata?.guildName;
      const discordGuildId = metadata?.discordGuildId;
      const discordUserId = metadata?.discordUserId;

      if (!planId || !guildName || !discordGuildId || !discordUserId) {
        console.error("[STRIPE WEBHOOK] Missing onboarding metadata", event.id);
        return NextResponse.json({ error: "INVALID_CHECKOUT_METADATA" }, { status: 400 });
      }

      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (!subscriptionId) return NextResponse.json({ error: "MISSING_STRIPE_SUBSCRIPTION" }, { status: 400 });

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { discordId: discordUserId } });
        const plan = await tx.plan.findFirst({ where: { id: planId, active: true }, include: { modules: true } });
        if (!user || !plan) throw new Error("CHECKOUT_USER_OR_PLAN_INVALID");

        const existingGuild = await tx.guild.findUnique({ where: { discordGuildId } });
        if (existingGuild) {
          const existingSubscription = await tx.guildSubscription.findFirst({
            where: { guildId: existingGuild.id, providerSubscriptionId: subscriptionId },
          });
          if (!existingSubscription) throw new Error("DISCORD_GUILD_ALREADY_REGISTERED");

          // The first provisioning attempt may have created the guild before the
          // owner membership was added. Replaying the webhook must repair that
          // partial state instead of returning early.
          await tx.guildMembership.upsert({
            where: { userId_guildId: { userId: user.id, guildId: existingGuild.id } },
            update: { role: "ADMIN" },
            create: { userId: user.id, guildId: existingGuild.id, role: "ADMIN" },
          });

          await tx.guildModuleEntitlement.createMany({
            data: plan.modules.map((module) => ({ guildId: existingGuild.id, module: module.module, enabled: true })),
            skipDuplicates: true,
          });
          return;
        }

        // Paid checkout authorizes guild creation for any authenticated user.
        // Complimentary creator grants are a separate admin-controlled bypass.
        const guild = await tx.guild.create({
          data: { name: guildName, discordGuildId, ownerUserId: user.id },
        });

        await tx.guildMembership.create({
          data: { guildId: guild.id, userId: user.id, role: "ADMIN" },
        });

        await tx.guildSubscription.create({
          data: {
            guildId: guild.id,
            planId: plan.id,
            status: "ACTIVE",
            provider: "stripe",
            providerCustomerId: customerId,
            providerSubscriptionId: subscriptionId,
          },
        });

        await tx.guildModuleEntitlement.createMany({
          data: plan.modules.map((module) => ({ guildId: guild.id, module: module.module, enabled: true })),
        });
      });
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const status = subscriptionStatus(subscription.status);
      const entitled = subscriptionIsEntitled(subscription.status);

      await prisma.$transaction(async (tx) => {
        const existing = await tx.guildSubscription.findUnique({
          where: { providerSubscriptionId: subscription.id },
          include: { plan: { include: { modules: true } } },
        });
        if (!existing) return;

        await tx.guildSubscription.update({
          where: { id: existing.id },
          data: {
            status,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            currentPeriodStart: new Date(subscription.items.data[0]?.current_period_start ? subscription.items.data[0].current_period_start * 1000 : Date.now()),
            currentPeriodEnd: new Date(subscription.items.data[0]?.current_period_end ? subscription.items.data[0].current_period_end * 1000 : Date.now()),
          },
        });

        for (const module of existing.plan.modules) {
          await tx.guildModuleEntitlement.upsert({
            where: { guildId_module: { guildId: existing.guildId, module: module.module } },
            create: { guildId: existing.guildId, module: module.module, enabled: entitled },
            update: { enabled: entitled },
          });
        }
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[STRIPE WEBHOOK] Processing failed", event.id, error);
    return NextResponse.json({ error: "WEBHOOK_PROCESSING_FAILED" }, { status: 500 });
  }
}
