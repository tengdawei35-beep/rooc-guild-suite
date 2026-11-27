import { redirect } from "next/navigation";
import Link from "next/link";

import { getCurrentPlatformUser } from "@/lib/auth/platform";
import { prisma } from "@/lib/prisma";
import ComplimentaryGuildForm from "./ComplimentaryGuildForm";

export default async function CreateGuildPage() {
  const user = await getCurrentPlatformUser();
  if (!user) redirect("/login?error=authentication_required");

  const creator = await prisma.platformGuildCreator.findUnique({
    where: { discordUserId: user.discordId },
    select: { active: true, maxGuilds: true, freeMonths: true },
  });
  if (!creator?.active) redirect("/billing/new?error=complimentary_access_unavailable");

  const [ownedGuildCount, plans] = await Promise.all([
    prisma.guild.count({ where: { ownerUserId: user.id } }),
    prisma.plan.findMany({
      where: { active: true },
      include: { modules: true },
      orderBy: [{ priceCents: "asc" }, { name: "asc" }],
    }),
  ]);
  const remainingGuilds = Math.max(0, creator.maxGuilds - ownedGuildCount);
  if (remainingGuilds === 0) redirect("/guild/select?error=guild_limit_reached");

  return (
    <main className="hmdl-billing-workspace min-h-screen bg-zinc-950 px-4 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/guild/select" className="text-sm text-zinc-500 hover:text-white">← Back to guild selection</Link>
        <header className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">HEIMDALL · CREATOR ACCESS</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Create your guild</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Set up your guild workspace in one step. Your approved creator access will be applied automatically — no billing flow or checkout required.</p>
        </header>
        {plans.length ? <ComplimentaryGuildForm plans={plans.map((plan) => ({ id: plan.id, name: plan.name, description: plan.description, modules: plan.modules.map((module) => module.module) }))} freeMonths={creator.freeMonths} remainingGuilds={remainingGuilds} /> : <div className="mt-8 rounded-xl border border-amber-800/60 bg-amber-950/20 p-5 text-sm text-amber-200">Guild plans are not configured yet. Please contact Heimdall support before creating your guild.</div>}
      </div>
    </main>
  );
}
