import Link from "next/link";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

const DISCORD_URL = "https://discord.gg/NrT2RKnh8M";

const moduleLabels: Record<string, string> = {
  CORE: "Core guild management",
  RESOURCE_SUITE: "Resources, bidding & allocation",
};

const TERMS = [
  { id: "monthly", label: "1 month", months: 1, days: 30, discount: 0, env: "MONTHLY" },
  { id: "quarterly", label: "3 months", months: 3, days: 90, discount: 10, env: "3_MONTH" },
  { id: "semiannual", label: "6 months", months: 6, days: 180, discount: 15, env: "6_MONTH" },
  { id: "annual", label: "1 year", months: 12, days: 365, discount: 25, env: "YEARLY" },
] as const;

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  return secretKey ? new Stripe(secretKey) : null;
}

function getPriceId(planName: string, term: (typeof TERMS)[number]) {
  const normalized = planName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const candidates = [
    process.env[`STRIPE_PRICE_${normalized}_${term.env}`],
    process.env[`${normalized}_PRICE_${term.env}`],
    process.env[`${normalized}_${term.env}_PRICE_ID`],
    term.id === "monthly" ? process.env[`STRIPE_PRICE_${normalized}`] : undefined,
    term.id === "monthly" ? process.env[`${normalized}_PRICE_ID`] : undefined,
  ];
  return candidates.find(Boolean);
}

async function getDisplayPrices(planName: string, fallbackCents: number) {
  const stripe = getStripe();
  if (!stripe) {
    return Object.fromEntries(TERMS.map((term) => [term.id, Math.round(fallbackCents * term.months * (1 - term.discount / 100))]));
  }

  const entries = await Promise.all(
    TERMS.map(async (term) => {
      const priceId = getPriceId(planName, term);
      if (!priceId) return [term.id, null] as const;
      try {
        const price = await stripe.prices.retrieve(priceId);
        return [term.id, price.unit_amount] as const;
      } catch (error) {
        console.error(`[PRICING] Failed to retrieve ${planName} ${term.id} Stripe price`, error);
        return [term.id, null] as const;
      }
    }),
  );

  const monthly = entries.find(([id]) => id === "monthly")?.[1] ?? fallbackCents;
  return Object.fromEntries(
    entries.map(([id, cents]) => {
      const term = TERMS.find((item) => item.id === id)!;
      return [id, cents ?? Math.round(monthly * term.months * (1 - term.discount / 100))];
    }),
  );
}

export default async function PricingPage() {
  const plans = await prisma.plan.findMany({
    where: { active: true },
    include: { modules: true },
    orderBy: [{ priceCents: "asc" }, { name: "asc" }],
  });

  const planPrices = await Promise.all(
    plans.map(async (plan) => ({
      plan,
      prices: await getDisplayPrices(plan.name, plan.priceCents),
    })),
  );

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

        {planPrices.length === 0 ? (
          <section className="mx-auto mt-12 max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
            Plans are being prepared. Join the HMDL Discord for updates.
          </section>
        ) : (
          <section className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-2">
            {planPrices.map(({ plan, prices }) => {
              const total = plan.name.toLowerCase().includes("total");
              const monthlyPrice = prices.monthly;

              return (
                <article key={plan.id} className={`rounded-2xl border p-7 ${total ? "border-zinc-500 bg-zinc-900" : "border-zinc-800 bg-zinc-950"}`}>
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <h2 className="text-2xl font-semibold">{plan.name}</h2>
                      {total && <span className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-black">Everything included</span>}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{formatPrice(monthlyPrice, plan.currency)}</p>
                      <p className="text-xs uppercase tracking-wide text-zinc-500">per month</p>
                    </div>
                  </div>

                  <p className="mt-5 min-h-12 text-sm leading-6 text-zinc-400">{plan.description ?? "Guild management tools for your community."}</p>

                  <div className="mt-6 border-t border-zinc-800 pt-5">
                    <p className="text-sm font-semibold text-zinc-200">Choose your billing term</p>
                    <p className="mt-1 text-xs text-zinc-500">Longer commitments save more.</p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {TERMS.map((term) => {
                        const price = prices[term.id];
                        const original = monthlyPrice * term.months;
                        const daily = price / term.days;
                        const monthlyEquivalent = price / term.months;

                        return (
                          <div key={term.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-white">{term.label}</p>
                                {term.discount > 0 ? (
                                  <span className="mt-1 inline-flex rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] font-semibold text-zinc-300">
                                    Save {term.discount}%
                                  </span>
                                ) : (
                                  <span className="mt-1 text-[11px] text-zinc-500">Standard price</span>
                                )}
                              </div>
                              <div className="text-right">
                                {term.discount > 0 && (
                                  <p className="text-xs text-zinc-600 line-through">{formatPrice(original, plan.currency)}</p>
                                )}
                                <p className="text-lg font-bold">{formatPrice(price, plan.currency)}</p>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-3 text-xs text-zinc-500">
                              <span>{formatPrice(monthlyEquivalent, plan.currency)}/month equivalent</span>
                              <span>{formatPrice(daily, plan.currency)}/day</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

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

        <p className="mt-10 text-center text-xs text-zinc-600">Monthly subscriptions are 50% off for the first month during the launch offer. Longer subscriptions receive the advertised commitment discount. Secure checkout is handled after Discord login.</p>
      </div>
    </main>
  );
}

function formatPrice(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(value / 100);
}
