import { redirect } from "next/navigation";
import Link from "next/link";
import Stripe from "stripe";
import { getCurrentPlatformUser } from "@/lib/auth/platform";
import { prisma } from "@/lib/prisma";
import BillingPlansClient from "./BillingPlansClient";

const BILLING_TERMS = [
  { id: "monthly", env: "MONTHLY" },
  { id: "quarterly", env: "3_MONTH" },
  { id: "semiannual", env: "6_MONTH" },
  { id: "annual", env: "YEARLY" },
] as const;
type BillingTerm = typeof BILLING_TERMS[number]["id"];

function getConfiguredPriceId(planName: string, term: BillingTerm) {
  const normalized = planName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const env = BILLING_TERMS.find((item) => item.id === term)!.env;
  return [
    process.env[`STRIPE_PRICE_${normalized}_${env}`],
    process.env[`${normalized}_PRICE_${env}`],
    process.env[`${normalized}_${env}_PRICE_ID`],
    term === "monthly" ? process.env[`${normalized}_PRICE_ID`] : undefined,
    term === "monthly" ? process.env[`STRIPE_PRICE_${normalized}`] : undefined,
  ].find(Boolean);
}

export default async function NewGuildBillingPage() {
  const user = await getCurrentPlatformUser();
  if (!user) redirect("/login?error=authentication_required");

  const [plans, ownedGuilds, creator] = await Promise.all([
    prisma.plan.findMany({ where: { active: true }, include: { modules: true }, orderBy: [{ priceCents: "asc" }, { name: "asc" }] }),
    prisma.guild.findMany({ where: { ownerUserId: user.id }, orderBy: { createdAt: "asc" }, include: { subscriptions: { orderBy: { createdAt: "desc" }, take: 1, include: { plan: true } } } }),
    prisma.platformGuildCreator.findUnique({ where: { discordUserId: user.discordId }, select: { active: true, maxGuilds: true, freeMonths: true } }),
  ]);

  const stripe = getStripe();
  const displayPlans = await Promise.all(plans.map(async (plan) => {
    const prices: Record<BillingTerm, { priceCents: number; currency: string } | null> = { monthly: null, quarterly: null, semiannual: null, annual: null };
    for (const term of BILLING_TERMS) {
      const priceId = getConfiguredPriceId(plan.name, term.id);
      if (stripe && priceId) {
        try {
          const price = await stripe.prices.retrieve(priceId);
          if (price.active && price.unit_amount != null) prices[term.id] = { priceCents: price.unit_amount, currency: price.currency };
        } catch (error) {
          console.error(`[BILLING PRICE] Unable to retrieve ${plan.name} ${term.id} price`, error);
        }
      }
    }
    if (!prices.monthly) prices.monthly = { priceCents: plan.priceCents, currency: plan.currency };
    for (const term of BILLING_TERMS) {
      if (!prices[term.id]) {
        const months = term.id === "monthly" ? 1 : term.id === "quarterly" ? 3 : term.id === "semiannual" ? 6 : 12;
        const discount = term.id === "monthly" ? 0 : term.id === "quarterly" ? 10 : term.id === "semiannual" ? 15 : 25;
        prices[term.id] = { priceCents: Math.round(prices.monthly!.priceCents * months * (1 - discount / 100)), currency: prices.monthly!.currency };
      }
    }
    return { id: plan.id, name: plan.name, description: plan.description, priceCents: prices.monthly!.priceCents, currency: prices.monthly!.currency, prices, billingInterval: plan.billingInterval, modules: plan.modules.map((module) => module.module) };
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
    <div className="mt-6"><BillingPlansClient plans={displayPlans} ownedGuildCount={ownedGuilds.length} guilds={guilds} complimentary={complimentaryAvailable ? { freeMonths: creator.freeMonths, remainingGuilds: creator.maxGuilds - ownedGuilds.length } : null} /></div>
  </div></main>;
}

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  return secretKey ? new Stripe(secretKey) : null;
}
