import { redirect } from "next/navigation";

import { getCurrentPlatformUser } from "@/lib/auth/platform";
import { prisma } from "@/lib/prisma";
import BillingPlansClient from "./BillingPlansClient";

export default async function NewGuildBillingPage() {
  const user = await getCurrentPlatformUser();
  if (!user) redirect("/login?error=authentication_required");

  const plans = await prisma.plan.findMany({
    where: { active: true },
    include: { modules: true },
    orderBy: [{ priceCents: "asc" }, { name: "asc" }],
  });

  const ownedGuildCount = await prisma.guild.count({
    where: { ownerUserId: user.id },
  });

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
    />
  );
}
