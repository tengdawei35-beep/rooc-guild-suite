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

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "MISSING_STRIPE_SIGNATURE" }, { status: 400 });
  }

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

      const subscriptionId = typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
      const customerId = typeof session.customer === "string"
        ? session.customer
        : session.customer?.id;

      if (!subscriptionId) {
        return NextResponse.json({ error: "MISSING_STRIPE_SUBSCRIPTION" }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        const creator = await tx.platformGuildCreator.findUnique({
          where: { discordUserId },
        });
        const user = await tx.user.findUnique({ where: { discordId: discordUserId } });
        const plan = await tx.plan.findFirst({
          where: { id: planId, active: true },
          include: { modules: true },
        });

        if (!creator?.active || !user || !plan) {
          throw new Error("CHECKOUT_CREATOR_USER_OR_PLAN_INVALID");
        }

        const existingGuild = await tx.guild.findUnique({ where: { discordGuildId } });
        if (existingGuild) {
          const existingSubscription = await tx.guildSubscription.findFirst({
            where: { guildId: existingGuild.id, providerSubscriptionId: subscriptionId },
          });
          if (!existingSubscription) throw new Error("DISCORD_GUILD_ALREADY_REGISTERED");
          return;
        }

        const ownedGuildCount = await tx.guild.count({ where: { ownerUserId: user.id } });
        if (ownedGuildCount >= creator.maxGuilds) {
          throw new Error("GUILD_CREATION_LIMIT_REACHED");
        }

        const guild = await tx.guild.create({
          data: {
            name: guildName,
            discordGuildId,
            ownerUserId: user.id,
          },
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
          data: plan.modules.map((module) => ({
            guildId: guild.id,
            module: module.module,
            enabled: true,
          })),
        });
      });
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const status = subscriptionStatus(subscription.status);
      await prisma.guildSubscription.updateMany({
        where: { providerSubscriptionId: subscription.id },
        data: {
          status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodStart: new Date(subscription.items.data[0]?.current_period_start ? subscription.items.data[0].current_period_start * 1000 : Date.now()),
          currentPeriodEnd: new Date(subscription.items.data[0]?.current_period_end ? subscription.items.data[0].current_period_end * 1000 : Date.now()),
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[STRIPE WEBHOOK] Processing failed", event.id, error);
    return NextResponse.json({ error: "WEBHOOK_PROCESSING_FAILED" }, { status: 500 });
  }
}
