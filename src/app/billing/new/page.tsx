import { redirect } from "next/navigation";
import Link from "next/link";
import Stripe from "stripe";
import { getCurrentPlatformUser } from "@/lib/auth/platform";
import { prisma } from "@/lib/prisma";
import BillingPlansClient from "./BillingPlansClient";

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  return secretKey ? new Stripe(secretKey) : null;
}

function getConfiguredPriceId(planName: string) {
  const normalized = planName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  return process.env[`${normalized}_PRICE_ID`] ?? process.env[`STRIPE_PRICE_${normalized}`];
}

export default async function NewGuildBillingPage() {
  const user = await getCurrentPlatformUser();
  if (!user) redirect("/login?error=authentication_required");

  const [plans, ownedGuilds, creator] = await Promise.all([
    prisma.plan.findMany({ where: { active: true }, include: { modules: true }, orderBy: [{ priceCents: "asc" }, { name: "asc" }] }),
    prisma.guild.findMany({
      where: { ownerUserId: user.id }, orderBy: { createdAt: "asc" },
      include: { subscriptions: { orderBy: { createdAt: "desc" }, take: 1, include: { plan: true } } },
    }),
    prisma.platformGuildCreator.findUnique({ where: { discordUserId: user.discordId }, select: { active: true, maxGuilds: true, freeMonths: true } }),
  ]);

  const stripe = getStripe();
  const displayPlans = await Promise.all(plans.map(async (plan) => {
    let priceCents = plan.priceCents;
    let currency = plan.currency;
    const priceId = getConfiguredPriceId(plan.name);
    if (stripe && priceId) {
      try {
        const price = await stripe.prices.retrieve(priceId);
        if (price.active && price.unit_amount != null) {
          priceCents = price.unit_amount;
          currency = price.currency;
        }
      } catch (error) {
        console.error(`[BILLING PRICE] Unable to retrieve ${plan.name} price`, error);
      }
    }
    return { id: plan.id, name: plan.name, description: plan.description, priceCents, currency, billingInterval: plan.billingInterval, modules: plan.modules.map((module) => module.module) };
  }));

  const now = new Date();
  const guilds = ownedGuilds.map((guild) => {
    const subscription = guild.subscriptions[0] ?? null;
    const active = subscription?.status === "ACTIVE" || subscription?.status === "TRIALING";
    const periodActive = !subscription?.currentPeriodEnd || subscription.currentPeriodEnd > now;
    return { id: guild.id, name: guild.name, discordGuildId: guild.discordGuildId, planName: subscription?.plan.name ?? null, active: active && periodActive, expiresAt: subscription?.currentPeriodEnd?.toISOString() ?? null, providerCustomerId: subscription?.providerCustomerId ?? null, cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false };
  });

  const complimentaryAvailable = creator?.active === true && ownedGuilds.length < creator.maxGuilds;
  return <main className="min-h-screen bg-zinc-950 px-4 py-12 text-white"><div className="mx-auto max-w-5xl">
    <Link href="/" className="text-sm text-zinc-500 hover:text-white">← Dashboard</Link>
    <div className="mt-6"><BillingPlansClient
      plans={displayPlans}
      ownedGuildCount={ownedGuilds.length}
      guilds={guilds}
      complimentary={complimentaryAvailable ? { freeMonths: creator.freeMonths, remainingGuilds: creator.maxGuilds - ownedGuilds.length } : null}
    /></div>
  </div></main>;
}
