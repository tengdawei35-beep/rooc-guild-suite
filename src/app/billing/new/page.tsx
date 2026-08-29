import { redirect } from "next/navigation";

import { getCurrentPlatformUser } from "@/lib/auth/platform";
import { prisma } from "@/lib/prisma";
import BillingPlansClient from "./BillingPlansClient";

export default async function NewGuildBillingPage() {
  const user = await getCurrentPlatformUser();
  if (!user) redirect("/login?error=authentication_required");

  const creator = await prisma.platformGuildCreator.findUnique({
    where: { discordUserId: user.discordId },
  });

  if (!creator?.active) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
        <section className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">ROO Guild Suite</p>
          <h1 className="mt-3 text-2xl font-semibold">Guild creation access required</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Your Discord account is authenticated, but it has not been authorized to create a guild yet.
          </p>
        </section>
      </main>
    );
  }

  const plans = await prisma.plan.findMany({
    where: { active: true },
    include: { modules: true },
    orderBy: [{ priceCents: "asc" }, { name: "asc" }],
  });

  return <BillingPlansClient plans={plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    priceCents: plan.priceCents,
    currency: plan.currency,
    billingInterval: plan.billingInterval,
    modules: plan.modules.map((module) => module.module),
  }))} maxGuilds={creator.maxGuilds} />;
}
