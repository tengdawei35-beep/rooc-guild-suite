import { redirect } from "next/navigation";
import { getCurrentPlatformUser } from "@/lib/auth/platform";
import { prisma } from "@/lib/prisma";
import BillingPlansClient from "./BillingPlansClient";

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

  const now = new Date();
  const guilds = ownedGuilds.map((guild) => {
    const subscription = guild.subscriptions[0] ?? null;
    const active = subscription?.status === "ACTIVE" || subscription?.status === "TRIALING";
    const periodActive = !subscription?.currentPeriodEnd || subscription.currentPeriodEnd > now;
    return { id: guild.id, name: guild.name, discordGuildId: guild.discordGuildId, planName: subscription?.plan.name ?? null, active: active && periodActive, expiresAt: subscription?.currentPeriodEnd?.toISOString() ?? null };
  });

  const complimentaryAvailable = creator?.active === true && ownedGuilds.length < creator.maxGuilds;
  return <BillingPlansClient
    plans={plans.map((plan) => ({ id: plan.id, name: plan.name, description: plan.description, priceCents: plan.priceCents, currency: plan.currency, billingInterval: plan.billingInterval, modules: plan.modules.map((module) => module.module) }))}
    ownedGuildCount={ownedGuilds.length}
    guilds={guilds}
    complimentary={complimentaryAvailable ? { freeMonths: creator.freeMonths, remainingGuilds: creator.maxGuilds - ownedGuilds.length } : null}
  />;
}
