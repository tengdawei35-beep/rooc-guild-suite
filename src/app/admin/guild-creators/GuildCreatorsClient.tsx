"use client";

import { useState } from "react";

type Creator = {
  id: string;
  discordUserId: string;
  discordUsername: string;
  maxGuilds: number;
  freeMonths: number;
  active: boolean;
  guildCount: number;
};

type PlanOption = { id: string; name: string };
type GuildAccess = {
  id: string;
  name: string;
  discordGuildId: string;
  planName: string | null;
  status: string | null;
  provider: string | null;
  expiresAt: string | null;
  cancelAtPeriodEnd: boolean;
};

const inputClass = "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500";

export default function GuildCreatorsClient({
  initialCreators,
  plans,
  initialGuilds,
}: {
  initialCreators: Creator[];
  plans: PlanOption[];
  initialGuilds: GuildAccess[];
}) {
  const [creators, setCreators] = useState(initialCreators);
  const [guilds, setGuilds] = useState(initialGuilds);
  const [discordUserId, setDiscordUserId] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");
  const [maxGuilds, setMaxGuilds] = useState("1");
  const [freeMonths, setFreeMonths] = useState("1");
  const [selectedPlan, setSelectedPlan] = useState(plans.find((plan) => plan.name.toLowerCase().includes("total"))?.id ?? plans[0]?.id ?? "");
  const [duration, setDuration] = useState("permanent");
  const [grantingGuildId, setGrantingGuildId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function addCreator(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/guild-creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordUserId, discordUsername, maxGuilds: Number(maxGuilds), freeMonths: Number(freeMonths) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to add creator.");
      setCreators((current) => [...current, { ...payload.creator, guildCount: 0 }].sort((a, b) => a.discordUsername.localeCompare(b.discordUsername)));
      setDiscordUserId(""); setDiscordUsername(""); setMaxGuilds("1"); setFreeMonths("1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add creator.");
    } finally { setSaving(false); }
  }

  async function updateCreator(creator: Creator, changes: Partial<Creator>) {
    setError("");
    const response = await fetch("/api/admin/guild-creators", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: creator.id, ...changes }),
    });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error ?? "Failed to update creator."); return; }
    setCreators((current) => current.map((item) => item.id === creator.id ? { ...payload.creator, guildCount: item.guildCount } : item));
  }

  async function grantAccess(guild: GuildAccess) {
    if (!selectedPlan) { setError("No active plans are available."); return; }
    setError("");
    setGrantingGuildId(guild.id);
    try {
      const response = await fetch("/api/admin/guild-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId: guild.id, planId: selectedPlan, durationMonths: duration === "permanent" ? "permanent" : Number(duration) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to grant guild access.");
      setGuilds((current) => current.map((item) => item.id === guild.id ? {
        ...item,
        planName: payload.subscription.planName,
        status: "ACTIVE",
        provider: "complimentary",
        expiresAt: payload.subscription.expiresAt,
        cancelAtPeriodEnd: false,
      } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grant guild access.");
    } finally { setGrantingGuildId(""); }
  }

  async function removeCreator(id: string) {
    if (!window.confirm("Remove this guild creator? They will no longer be allowed to create new guilds.")) return;
    const response = await fetch(`/api/admin/guild-creators?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error ?? "Failed to remove creator."); return; }
    setCreators((current) => current.filter((item) => item.id !== id));
  }

  function accessLabel(guild: GuildAccess) {
    if (!guild.planName) return "No subscription";
    if (guild.provider === "complimentary" && guild.expiresAt === null) return `${guild.planName} • Permanent complimentary`;
    if (guild.provider === "complimentary" && guild.expiresAt) return `${guild.planName} • Complimentary until ${new Date(guild.expiresAt).toLocaleDateString()}`;
    return `${guild.planName} • ${guild.status ?? "Unknown"}`;
  }

  return (
    <div className="space-y-8">
      <form onSubmit={addCreator} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold">Add Guild Creator</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_140px_140px_auto]">
          <input value={discordUserId} onChange={(event) => setDiscordUserId(event.target.value)} placeholder="Discord User ID" className={inputClass} required />
          <input value={discordUsername} onChange={(event) => setDiscordUsername(event.target.value)} placeholder="Discord username" className={inputClass} required />
          <label className="text-xs text-zinc-400">Max guilds<input value={maxGuilds} onChange={(event) => setMaxGuilds(event.target.value)} type="number" min="1" className={`mt-1 w-full ${inputClass}`} required /></label>
          <label className="text-xs text-zinc-400">Free duration (months)<input value={freeMonths} onChange={(event) => setFreeMonths(event.target.value)} type="number" min="1" className={`mt-1 w-full ${inputClass}`} required /></label>
          <button disabled={saving} className="rounded-lg bg-white px-5 py-2 text-sm font-medium text-black disabled:opacity-50">{saving ? "Adding…" : "Add"}</button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">The duration applies when this creator provisions a complimentary guild subscription.</p>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </form>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div>
          <h2 className="text-lg font-semibold">Guild Access</h2>
          <p className="mt-1 text-sm text-zinc-500">Grant or extend complimentary access for existing guilds. Permanent access has no expiry.</p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_180px_180px]">
          <label className="text-sm text-zinc-400">Plan<select value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value)} className={`mt-1 w-full ${inputClass}`}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
          <label className="text-sm text-zinc-400">Complimentary duration<select value={duration} onChange={(event) => setDuration(event.target.value)} className={`mt-1 w-full ${inputClass}`}><option value="permanent">Permanent</option><option value="1">1 month</option><option value="3">3 months</option><option value="6">6 months</option><option value="12">12 months</option></select></label>
        </div>
        <div className="mt-5 divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {guilds.length === 0 ? <p className="px-5 py-8 text-center text-sm text-zinc-500">No guilds configured.</p> : guilds.map((guild) => (
            <div key={guild.id} className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div><p className="font-medium">{guild.name}</p><p className="mt-1 text-xs text-zinc-500">{guild.discordGuildId} • {accessLabel(guild)}</p></div>
              <button disabled={grantingGuildId === guild.id || !selectedPlan} onClick={() => void grantAccess(guild)} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-50">{grantingGuildId === guild.id ? "Applying…" : guild.provider === "complimentary" ? "Grant / Extend" : "Grant complimentary"}</button>
            </div>
          ))}
        </div>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 px-6 py-4"><h2 className="font-semibold">Authorized Creators</h2></div>
        {creators.length === 0 ? <p className="px-6 py-10 text-center text-sm text-zinc-500">No guild creators configured.</p> : <div className="divide-y divide-zinc-800">
          {creators.map((creator) => <div key={creator.id} className="grid gap-4 px-6 py-5 md:grid-cols-[1fr_150px_150px_120px_100px] md:items-center">
            <div><p className="font-medium">{creator.discordUsername}</p><p className="mt-1 text-xs text-zinc-500">{creator.discordUserId}</p></div>
            <div className="text-sm"><p className="text-zinc-400">Guilds</p><p className="mt-1 font-medium">{creator.guildCount} / {creator.maxGuilds}</p></div>
            <label className="text-sm text-zinc-400">Max guilds<input type="number" min="1" value={creator.maxGuilds} onChange={(event) => void updateCreator(creator, { maxGuilds: Number(event.target.value) })} className={`mt-1 w-full ${inputClass}`} /></label>
            <label className="text-sm text-zinc-400">Free months<input type="number" min="1" value={creator.freeMonths} onChange={(event) => void updateCreator(creator, { freeMonths: Number(event.target.value) })} className={`mt-1 w-full ${inputClass}`} /></label>
            <button onClick={() => void updateCreator(creator, { active: !creator.active })} className={`rounded-lg border px-3 py-2 text-sm ${creator.active ? "border-emerald-900 text-emerald-400" : "border-zinc-700 text-zinc-500"}`}>{creator.active ? "Active" : "Disabled"}</button>
            <button onClick={() => void removeCreator(creator.id)} className="text-sm text-red-400 hover:text-red-300">Remove</button>
          </div>)}
        </div>}
      </section>
    </div>
  );
}
