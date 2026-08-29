import { redirect } from "next/navigation";

import { getCurrentPlatformUser } from "@/lib/auth/platform";
import { prisma } from "@/lib/prisma";
import BillingPlansClient from "./BillingPlansClient";

export default async function NewGuildBillingPage() {
  const user = await getCurrentPlatformUser();
  if (!user) redirect("/login?error=authentication_required");

  const [plans, ownedGuildCount, creator] = await Promise.all([
    prisma.plan.findMany({
      where: { active: true },
      include: { modules: true },
      orderBy: [{ priceCents: "asc" }, { name: "asc" }],
    }),
    prisma.guild.count({ where: { ownerUserId: user.id } }),
    prisma.platformGuildCreator.findUnique({
      where: { discordUserId: user.discordId },
      select: { active: true, maxGuilds: true, freeMonths: true },
    }),
  ]);

  const complimentaryAvailable =
    creator?.active === true && ownedGuildCount < creator.maxGuilds;

  return (
    <BillingPlansClient
      plans={plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        priceCents: plan.priceCents,
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        modules: plan.modules.map((module) => module.module),
      }))}
      ownedGuildCount={ownedGuildCount}
      complimentary={complimentaryAvailable ? {
        freeMonths: creator.freeMonths,
        remainingGuilds: creator.maxGuilds - ownedGuildCount,
      } : null}
    />
  );
}
