"use client";

import { useState } from "react";

type Creator = {
  id: string;
  discordUserId: string;
  discordUsername: string;
  maxGuilds: number;
  active: boolean;
  guildCount: number;
};

export default function GuildCreatorsClient({
  initialCreators,
}: {
  initialCreators: Creator[];
}) {
  const [creators, setCreators] = useState(initialCreators);
  const [discordUserId, setDiscordUserId] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");
  const [maxGuilds, setMaxGuilds] = useState("1");
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
        body: JSON.stringify({ discordUserId, discordUsername, maxGuilds: Number(maxGuilds) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to add creator.");

      setCreators((current) => [...current, { ...payload.creator, guildCount: 0 }].sort((a, b) => a.discordUsername.localeCompare(b.discordUsername)));
      setDiscordUserId("");
      setDiscordUsername("");
      setMaxGuilds("1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add creator.");
    } finally {
      setSaving(false);
    }
  }

  async function updateCreator(creator: Creator, changes: Partial<Creator>) {
    setError("");
    const response = await fetch("/api/admin/guild-creators", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: creator.id, ...changes }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Failed to update creator.");
      return;
    }
    setCreators((current) => current.map((item) => item.id === creator.id ? { ...payload.creator, guildCount: item.guildCount } : item));
  }

  async function removeCreator(id: string) {
    if (!window.confirm("Remove this guild creator? They will no longer be allowed to create new guilds.")) return;
    const response = await fetch(`/api/admin/guild-creators?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Failed to remove creator.");
      return;
    }
    setCreators((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className="space-y-8">
      <form onSubmit={addCreator} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold">Add Guild Creator</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_160px_auto]">
          <input value={discordUserId} onChange={(event) => setDiscordUserId(event.target.value)} placeholder="Discord User ID" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500" required />
          <input value={discordUsername} onChange={(event) => setDiscordUsername(event.target.value)} placeholder="Discord username" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500" required />
          <input value={maxGuilds} onChange={(event) => setMaxGuilds(event.target.value)} type="number" min="1" placeholder="Max guilds" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500" required />
          <button disabled={saving} className="rounded-lg bg-white px-5 py-2 text-sm font-medium text-black disabled:opacity-50">{saving ? "Adding…" : "Add"}</button>
        </div>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </form>

      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 px-6 py-4">
          <h2 className="font-semibold">Authorized Creators</h2>
        </div>
        {creators.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-zinc-500">No guild creators configured.</p>
        ) : (
          <div className="divide-y divide-zinc-800">
            {creators.map((creator) => (
              <div key={creator.id} className="grid gap-4 px-6 py-5 md:grid-cols-[1fr_180px_120px_100px] md:items-center">
                <div>
                  <p className="font-medium">{creator.discordUsername}</p>
                  <p className="mt-1 text-xs text-zinc-500">{creator.discordUserId}</p>
                </div>
                <div className="text-sm">
                  <p className="text-zinc-400">Guilds</p>
                  <p className="mt-1 font-medium">{creator.guildCount} / {creator.maxGuilds}</p>
                </div>
                <label className="text-sm text-zinc-400">
                  Max guilds
                  <input type="number" min="1" value={creator.maxGuilds} onChange={(event) => void updateCreator(creator, { maxGuilds: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                </label>
                <button onClick={() => void updateCreator(creator, { active: !creator.active })} className={`rounded-lg border px-3 py-2 text-sm ${creator.active ? "border-emerald-900 text-emerald-400" : "border-zinc-700 text-zinc-500"}`}>
                  {creator.active ? "Active" : "Disabled"}
                </button>
                <button onClick={() => void removeCreator(creator.id)} className="text-sm text-red-400 hover:text-red-300">Remove</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
