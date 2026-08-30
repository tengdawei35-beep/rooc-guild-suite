import Link from "next/link";
import { prisma } from "@/lib/prisma";

const DISCORD_URL = "https://discord.gg/48yTtF9UxP";

const moduleLabels: Record<string, string> = {
  CORE: "Core guild management",
  RESOURCE_SUITE: "Resources, bidding & allocation",
};

export default async function PricingPage() {
  const plans = await prisma.plan.findMany({
    where: { active: true },
    include: { modules: true },
    orderBy: [{ priceCents: "asc" }, { name: "asc" }],
  });

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white sm:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold tracking-tight">HMDL</Link>
          <div className="flex items-center gap-5 text-sm">
            <Link href="/login" className="text-zinc-400 hover:text-white">Login</Link>
            <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-white">Discord ↗</a>
          </div>
        </header>

        <section className="mx-auto mt-16 max-w-3xl text-center">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-zinc-500">HMDL · Heimdall</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Choose the tools your guild needs.</h1>
          <p className="mt-5 text-zinc-400">Start with core guild management or unlock the full resource, bidding and allocation suite.</p>
        </section>

        {plans.length === 0 ? (
          <section className="mx-auto mt-12 max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
            Plans are being prepared. Join the HMDL Discord for updates.
          </section>
        ) : (
          <section className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-2">
            {plans.map((plan) => {
              const total = plan.name.toLowerCase().includes("total");
              return (
                <article key={plan.id} className={`rounded-2xl border p-7 ${total ? "border-zinc-500 bg-zinc-900" : "border-zinc-800 bg-zinc-950"}`}>
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <h2 className="text-2xl font-semibold">{plan.name}</h2>
                      {total && <span className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-black">Everything included</span>}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{formatPrice(plan.priceCents, plan.currency)}</p>
                      <p className="text-xs uppercase tracking-wide text-zinc-500">per {plan.billingInterval.toLowerCase()}</p>
                    </div>
                  </div>
                  <p className="mt-5 min-h-12 text-sm leading-6 text-zinc-400">{plan.description ?? "Guild management tools for your community."}</p>
                  <div className="mt-6 space-y-3 border-t border-zinc-800 pt-5">
                    {plan.modules.map((module) => (
                      <p key={module.module} className="text-sm text-zinc-200">✓ {moduleLabels[module.module] ?? module.module}</p>
                    ))}
                    {plan.modules.length === 1 && plan.modules[0].module === "CORE" && (
                      <p className="text-sm text-zinc-600">— Resources, bidding & allocation not included</p>
                    )}
                  </div>
                  <Link href="/login" className={`mt-8 flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold ${total ? "bg-white text-black hover:bg-zinc-200" : "border border-zinc-700 text-white hover:bg-zinc-800"}`}>
                    Get started with {plan.name}
                  </Link>
                </article>
              );
            })}
          </section>
        )}

        <p className="mt-10 text-center text-xs text-zinc-600">Secure subscription checkout is handled after Discord login.</p>
      </div>
    </main>
  );
}

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}
