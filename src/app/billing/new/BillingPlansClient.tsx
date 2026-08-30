"use client";
import { useState } from "react";

type Plan = { id: string; name: string; description: string | null; priceCents: number; currency: string; billingInterval: "MONTH" | "YEAR"; modules: string[] };
type Guild = { id: string; name: string; discordGuildId: string; planName: string | null; active: boolean; expiresAt: string | null; providerCustomerId: string | null; cancelAtPeriodEnd: boolean };
type Complimentary = { freeMonths: number; remainingGuilds: number };
type BillingTerm = "monthly" | "quarterly" | "semiannual" | "annual";

const TERMS: { id: BillingTerm; label: string; months: number; discount: number }[] = [
  { id: "monthly", label: "1 month", months: 1, discount: 0 },
  { id: "quarterly", label: "3 months", months: 3, discount: 10 },
  { id: "semiannual", label: "6 months", months: 6, discount: 15 },
  { id: "annual", label: "1 year", months: 12, discount: 25 },
];

export default function BillingPlansClient({ plans, ownedGuildCount, guilds, complimentary }: { plans: Plan[]; ownedGuildCount: number; guilds: Guild[]; complimentary: Complimentary | null }) {
  const renewableGuilds = guilds.filter((guild) => !guild.active);
  const activeGuilds = guilds.filter((guild) => guild.active);
  const [selectedPlan, setSelectedPlan] = useState(plans[0]?.id ?? "");
  const [billingTerm, setBillingTerm] = useState<BillingTerm>("monthly");
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [discordGuildId, setDiscordGuildId] = useState("");
  const [loading, setLoading] = useState(false);
  const [portalGuildId, setPortalGuildId] = useState("");
  const [error, setError] = useState("");

  const renewing = selectedGuildId !== "";
  const selectedGuild = guilds.find((guild) => guild.id === selectedGuildId);
  const selectedTerm = TERMS.find((term) => term.id === billingTerm)!;

  function selectGuild(id: string) {
    setSelectedGuildId(id);
    const guild = guilds.find((item) => item.id === id);
    if (guild) { setGuildName(guild.name); setDiscordGuildId(guild.discordGuildId); }
    else { setGuildName(""); setDiscordGuildId(""); }
    setError("");
  }

  async function openPortal(guildId: string) {
    setError(""); setPortalGuildId(guildId);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guildId }) });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "Unable to open subscription management.");
      window.location.assign(data.url);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to open subscription management."); setPortalGuildId(""); }
  }

  async function submit(path: string) {
    setError("");
    if (!selectedPlan) { setError("Choose a plan."); return; }
    if (!renewing && (!guildName.trim() || !discordGuildId.trim())) { setError("Enter your guild name and Discord Guild ID."); return; }
    setLoading(true);
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: selectedPlan, billingTerm, ...(renewing ? { guildId: selectedGuildId } : { guildName: guildName.trim(), discordGuildId: discordGuildId.trim() }) }) });
      const data = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to update the subscription.");
      if (data.checkoutUrl) window.location.assign(data.checkoutUrl); else window.location.assign("/");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update the subscription."); setLoading(false); }
  }

  return <div className="text-white">
    <header className="max-w-3xl"><p className="text-sm font-medium uppercase tracking-widest text-zinc-500">ROO Guild Suite</p><h1 className="mt-3 text-4xl font-bold tracking-tight">Subscriptions</h1><p className="mt-3 text-zinc-400">Manage your guild subscriptions. You currently own {ownedGuildCount} guild{ownedGuildCount === 1 ? "" : "s"}.</p></header>

    {activeGuilds.length > 0 && <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"><h2 className="text-lg font-semibold">Current subscriptions</h2><p className="mt-1 text-sm text-zinc-500">Your active guilds are renewed automatically. Use Manage subscription to update payment details, change or cancel the subscription, or resume a scheduled cancellation.</p><div className="mt-4 space-y-3">{activeGuilds.map((guild) => <div key={guild.id} className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{guild.name}</p><p className="mt-1 text-sm text-zinc-500">{guild.planName ?? "Subscription"}{guild.expiresAt ? ` • Renews ${new Date(guild.expiresAt).toLocaleDateString()}` : ""}{guild.cancelAtPeriodEnd ? " • Scheduled to cancel" : ""}</p></div><button disabled={portalGuildId === guild.id || !guild.providerCustomerId} onClick={() => openPortal(guild.id)} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-white hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50">{portalGuildId === guild.id ? "Opening…" : "Manage subscription"}</button></div>)}</div></section>}

    {renewableGuilds.length > 0 && <section className="mt-8 rounded-2xl border border-amber-800/60 bg-amber-950/20 p-6"><h2 className="text-lg font-semibold text-amber-200">Renew an existing guild</h2><p className="mt-1 text-sm text-amber-100/70">Select an expired or cancelled guild to restore access. You do not need to re-enter its Discord details.</p><select value={selectedGuildId} onChange={(event) => selectGuild(event.target.value)} className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"><option value="">Select a guild…</option>{renewableGuilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}{guild.planName ? ` — ${guild.planName}` : ""}</option>)}</select>{selectedGuild && <p className="mt-2 text-xs text-zinc-500">Discord Guild ID: {selectedGuild.discordGuildId}{selectedGuild.expiresAt ? ` • Expired ${new Date(selectedGuild.expiresAt).toLocaleDateString()}` : ""}</p>}</section>}

    <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"><h2 className="text-lg font-semibold">Choose your billing term</h2><p className="mt-1 text-sm text-zinc-500">Longer commitments receive an automatic discount.</p><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">{TERMS.map((term) => <button key={term.id} type="button" onClick={() => setBillingTerm(term.id)} className={`rounded-xl border p-4 text-left ${billingTerm === term.id ? "border-white bg-zinc-800" : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"}`}><p className="font-semibold">{term.label}</p><p className="mt-1 text-xs text-zinc-500">{term.discount ? `${term.discount}% off` : "Standard price"}</p></button>)}</div></section>

    <section className="mt-4 grid gap-4 md:grid-cols-2">{plans.map((plan) => { const isSelected = selectedPlan === plan.id; const base = plan.priceCents; const total = Math.round(base * selectedTerm.months * (1 - selectedTerm.discount / 100)); const isMonthly = billingTerm === "monthly"; const isTotal = plan.name.toLowerCase().includes("total"); return <button key={plan.id} type="button" onClick={() => setSelectedPlan(plan.id)} className={`rounded-2xl border p-6 text-left transition ${isSelected ? "border-white bg-zinc-800" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"}`}><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{plan.name}</h2>{isTotal && <span className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-black">Everything included</span>}</div><div className="text-right"><p className="text-xs text-zinc-500">{selectedTerm.label}</p>{isMonthly ? <><p className="text-2xl font-bold">{formatPrice(Math.round(base / 2), plan.currency)}</p><p className="text-xs text-zinc-500"><span className="line-through">{formatPrice(base, plan.currency)}</span> · first month 50% off</p></> : <><p className="text-2xl font-bold">{formatPrice(total, plan.currency)}</p><p className="text-xs text-zinc-500">{formatPrice(Math.round(total / selectedTerm.months), plan.currency)}/month · {selectedTerm.discount}% off</p></>}</div></div><p className="mt-4 text-sm leading-6 text-zinc-400">{plan.description ?? "Guild management tools for your community."}</p><div className="mt-5 space-y-2 text-sm">{plan.modules.map((module) => <p key={module} className="text-zinc-300">✓ {formatModule(module)}</p>)}{plan.modules.length === 1 && plan.modules[0] === "CORE" && <p className="text-zinc-500">— Resources, Bidding & Allocation not included</p>}</div></button>; })}</section>

    {!renewing && <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"><h2 className="text-lg font-semibold">New guild details</h2><div className="mt-5 grid gap-5 md:grid-cols-2"><label className="block"><span className="text-sm text-zinc-400">Guild name</span><input value={guildName} onChange={(event) => setGuildName(event.target.value)} maxLength={100} placeholder="My ROO Guild" className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-400" /></label><label className="block"><span className="text-sm text-zinc-400">Discord Guild ID</span><input value={discordGuildId} onChange={(event) => setDiscordGuildId(event.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={20} placeholder="123456789012345678" className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-400" /></label></div>{complimentary && <div className="mt-5 rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-4"><p className="font-semibold text-emerald-200">Complimentary access available</p><p className="mt-1 text-sm text-emerald-100/70">As an approved guild creator, you can create {complimentary.remainingGuilds} more guild{complimentary.remainingGuilds === 1 ? "" : "s"} with {complimentary.freeMonths} month{complimentary.freeMonths === 1 ? "" : "s"} complimentary access.</p><button disabled={loading || !plans.length} onClick={() => submit("/api/billing/complimentary")} className="mt-4 w-full rounded-lg bg-emerald-200 px-5 py-3 font-semibold text-zinc-950 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Creating guild…" : "Create with complimentary access"}</button></div>}</section>}

    {renewing && <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"><p className="text-sm text-zinc-400">Renewing <span className="font-semibold text-white">{selectedGuild?.name}</span>. Its existing Discord Guild ID and ownership will be retained.</p></section>}
    {error && <p className="mt-4 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</p>}
    <button disabled={loading || !plans.length} onClick={() => submit("/api/billing/checkout")} className="mt-6 w-full rounded-lg bg-white px-5 py-3 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Redirecting to Stripe…" : renewing ? "Renew subscription" : `Continue with ${selectedTerm.label}`}</button>
    <p className="mt-3 text-center text-xs text-zinc-600">Payment is securely processed by Stripe. The 50% launch offer applies only to the first month of monthly subscriptions.</p>
  </div>;
}

function formatPrice(cents: number, currency: string) { return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100); }
function formatModule(module: string) { if (module === "RESOURCE_SUITE") return "Resources, Bidding & Allocation"; if (module === "CORE") return "Core guild management"; return module; }
