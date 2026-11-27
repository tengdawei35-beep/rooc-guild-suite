"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Plan = { id: string; name: string; description: string | null; modules: string[] };

export default function ComplimentaryGuildForm({ plans, freeMonths, remainingGuilds }: {
  plans: Plan[];
  freeMonths: number;
  remainingGuilds: number;
}) {
  const router = useRouter();
  const [guildName, setGuildName] = useState("");
  const [discordGuildId, setDiscordGuildId] = useState("");
  const [gameType, setGameType] = useState<"ROOC" | "RO3">("ROOC");
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createGuild(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!planId) { setError("No active guild plan is available. Please contact Heimdall support."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/billing/complimentary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, guildName: guildName.trim(), discordGuildId: discordGuildId.trim(), gameType }),
      });
      const data = await response.json() as { guildId?: string; error?: string };
      if (!response.ok || !data.guildId) {
        const messages: Record<string, string> = {
          COMPLIMENTARY_ACCESS_NOT_AVAILABLE: "Complimentary creator access is no longer active for this account.",
          GUILD_CREATION_LIMIT_REACHED: "You have used all of your available guild creation slots.",
          DISCORD_GUILD_ALREADY_REGISTERED: "That Discord server is already registered with Heimdall.",
          INVALID_DISCORD_GUILD_ID: "Enter a valid Discord Server ID (17–20 digits).",
          INVALID_GUILD_NAME: "Guild name must be between 2 and 100 characters.",
          INVALID_PLAN: "That plan is no longer available. Refresh and try again.",
        };
        throw new Error(messages[data.error ?? ""] ?? data.error ?? "Unable to create your guild.");
      }
      router.push("/guild/select");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create your guild.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={createGuild} className="mt-8 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-zinc-300">Guild name</span>
          <input required minLength={2} maxLength={100} value={guildName} onChange={(event) => setGuildName(event.target.value)} placeholder="Your guild name" className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-cyan-500" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-300">Discord Server ID</span>
          <input required inputMode="numeric" minLength={17} maxLength={20} value={discordGuildId} onChange={(event) => setDiscordGuildId(event.target.value.replace(/\D/g, ""))} placeholder="123456789012345678" className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-cyan-500" />
          <span className="mt-1 block text-xs text-zinc-500">Enable Developer Mode in Discord, then copy your server ID.</span>
        </label>
      </div>

      <label className="block max-w-sm">
        <span className="text-sm font-medium text-zinc-300">Game</span>
        <select value={gameType} onChange={(event) => setGameType(event.target.value as "ROOC" | "RO3")} className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white">
          <option value="ROOC">ROO Classic</option>
          <option value="RO3">Ragnarok Online 3</option>
        </select>
      </label>

      <fieldset>
        <legend className="text-sm font-medium text-zinc-300">Guild plan</legend>
        <p className="mt-1 text-xs text-zinc-500">Choose which features your complimentary guild will start with. No payment details are required.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {plans.map((plan) => (
            <label key={plan.id} className={`cursor-pointer rounded-xl border p-4 transition ${planId === plan.id ? "border-cyan-500 bg-cyan-950/30" : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"}`}>
              <span className="flex items-center gap-2">
                <input type="radio" name="plan" value={plan.id} checked={planId === plan.id} onChange={() => setPlanId(plan.id)} className="accent-cyan-400" />
                <strong className="text-white">{plan.name}</strong>
              </span>
              {plan.description && <span className="mt-2 block text-sm text-zinc-400">{plan.description}</span>}
              <span className="mt-3 block text-xs text-zinc-500">{plan.modules.map((module) => module === "CORE" ? "Core Guild Management" : module === "RESOURCE_SUITE" ? "Resources, Bidding & Allocation" : module).join(" · ")}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/25 p-4">
        <p className="font-semibold text-emerald-200">Complimentary creator access</p>
        <p className="mt-1 text-sm leading-6 text-emerald-100/70">This guild will receive {freeMonths} month{freeMonths === 1 ? "" : "s"} of complimentary access. You can create {remainingGuilds} more guild{remainingGuilds === 1 ? "" : "s"} under your creator allowance.</p>
        <p className="mt-2 text-xs text-emerald-100/50">No checkout, payment method or subscription purchase is needed.</p>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</p>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => router.back()} className="rounded-lg border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-300 hover:border-zinc-500">Cancel</button>
        <button type="submit" disabled={loading || !plans.length} className="rounded-lg bg-cyan-200 px-6 py-3 text-sm font-semibold text-zinc-950 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Creating guild…" : "Create guild with complimentary access →"}</button>
      </div>
    </form>
  );
}
