"use client";

import { useState } from "react";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  billingInterval: "MONTH" | "YEAR";
  modules: string[];
};

type Complimentary = { freeMonths: number; remainingGuilds: number };

export default function BillingPlansClient({ plans, ownedGuildCount, complimentary }: {
  plans: Plan[];
  ownedGuildCount: number;
  complimentary: Complimentary | null;
}) {
  const [selectedPlan, setSelectedPlan] = useState(plans[0]?.id ?? "");
  const [guildName, setGuildName] = useState("");
  const [discordGuildId, setDiscordGuildId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(path: string) {
    setError("");
    if (!selectedPlan || !guildName.trim() || !discordGuildId.trim()) {
      setError("Choose a plan and enter your guild name and Discord Guild ID.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlan, guildName: guildName.trim(), discordGuildId: discordGuildId.trim() }),
      });
      const data = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to create the guild.");
      if (data.checkoutUrl) window.location.assign(data.checkoutUrl);
      else window.location.assign("/");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create the guild.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">ROO Guild Suite</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">Create your guild</h1>
          <p className="mt-3 text-zinc-400">Choose a subscription for this guild. You currently own {ownedGuildCount} guild{ownedGuildCount === 1 ? "" : "s"}.</p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const isTotal = plan.name.toLowerCase().includes("total");
            return <button key={plan.id} type="button" onClick={() => setSelectedPlan(plan.id)} className={`rounded-2xl border p-6 text-left transition ${isSelected ? "border-white bg-zinc-800" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"}`}>
              <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{plan.name}</h2>{isTotal && <span className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-black">Everything included</span>}</div><div className="text-right"><p className="text-2xl font-bold">{formatPrice(plan.priceCents, plan.currency)}</p><p className="text-xs uppercase text-zinc-500">per {plan.billingInterval.toLowerCase()}</p></div></div>
              <p className="mt-4 text-sm leading-6 text-zinc-400">{plan.description ?? "Guild management tools for your community."}</p>
              <div className="mt-5 space-y-2 text-sm">{plan.modules.map((module) => <p key={module} className="text-zinc-300">✓ {formatModule(module)}</p>)}</div>
            </button>;
          })}
        </section>

        {plans.length === 0 && <section className="mt-8 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-8 text-center text-sm text-zinc-400">No subscription plans are currently available. Please contact the application administrator.</section>}

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold">Guild details</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="block"><span className="text-sm text-zinc-400">Guild name</span><input value={guildName} onChange={(event) => setGuildName(event.target.value)} maxLength={100} placeholder="My ROO Guild" className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-400" /></label>
            <label className="block"><span className="text-sm text-zinc-400">Discord Guild ID</span><input value={discordGuildId} onChange={(event) => setDiscordGuildId(event.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={20} placeholder="123456789012345678" className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-400" /></label>
          </div>
          {error && <p className="mt-4 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</p>}
          {complimentary && <div className="mt-5 rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-4"><p className="font-semibold text-emerald-200">Complimentary access available</p><p className="mt-1 text-sm text-emerald-100/70">As an approved guild creator, you can create {complimentary.remainingGuilds === 1 ? "one" : `${complimentary.remainingGuilds}`} more guild{complimentary.remainingGuilds === 1 ? "" : "s"} with {complimentary.freeMonths} month{complimentary.freeMonths === 1 ? "" : "s"} complimentary access.</p><button disabled={loading || !plans.length} onClick={() => submit("/api/billing/complimentary")} className="mt-4 w-full rounded-lg bg-emerald-200 px-5 py-3 font-semibold text-zinc-950 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Creating guild…" : "Create with complimentary access"}</button></div>}
          {error === "" && null}
          <button disabled={loading || !plans.length} onClick={() => submit("/api/billing/checkout")} className="mt-6 w-full rounded-lg bg-white px-5 py-3 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Redirecting to Stripe…" : "Continue to secure payment"}</button>
          <p className="mt-3 text-center text-xs text-zinc-600">Payment is securely processed by Stripe.</p>
        </section>
      </div>
    </main>
  );
}

function formatPrice(cents: number, currency: string) { return new Intl.NumberFormat("en-MY", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100); }
function formatModule(module: string) { if (module === "RESOURCE_SUITE") return "Resources, Bidding & Allocation"; return "Core guild management"; }
