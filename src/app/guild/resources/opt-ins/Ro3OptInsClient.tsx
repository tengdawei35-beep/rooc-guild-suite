"use client";

import { useEffect, useState } from "react";

type Resource = { id: string; name: string; category: "CARD" | "EQUIPMENT" | "ECHO"; persistent: boolean };
type Reward = { id: string; name: string; category: Resource["category"]; selected: boolean; accepted: boolean; persistent: boolean };
type EventItem = { id: string; date: string; typeName: string; locked: boolean; rewards: Reward[] };
type Data = {
  member: { id: string };
  season: { id: string; name: string; capMode: string; totalOptInCap: number | null; cardOptInCap: number | null; equipmentOptInCap: number | null; echoOptInCap: number | null };
  resources: Resource[];
  events: EventItem[];
  usage: { distinct: number; categories: { CARD: number; EQUIPMENT: number; ECHO: number }; remainingTotal: number | null };
};

const categoryLabels = { CARD: "Cards", EQUIPMENT: "Equipment", ECHO: "Echoes" } as const;

export default function Ro3OptInsClient() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/guild/resources/ro3/opt-ins", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load opt-ins.");
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load opt-ins.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function setSelection(action: "persistent" | "event", resourceId: string, selected: boolean, eventId?: string) {
    const key = `${action}:${eventId ?? "season"}:${resourceId}`;
    setBusyKey(key); setError(""); setNotice("");
    try {
      const response = await fetch("/api/guild/resources/ro3/opt-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, resourceId, selected, ...(eventId ? { eventId } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update opt-in.");
      setNotice("Opt-in updated.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update opt-in.");
    } finally {
      setBusyKey("");
    }
  }

  if (loading && !data) return <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-400">Loading your opt-ins…</div>;
  if (error && !data) return <div className="mt-8 rounded-xl border border-red-900 bg-zinc-900 p-6"><p className="text-sm text-red-300">{error}</p><button onClick={() => void refresh()} className="mt-3 rounded-lg border border-zinc-700 px-3 py-2 text-sm">Retry</button></div>;
  if (!data) return null;

  const groups = (["CARD", "EQUIPMENT", "ECHO"] as const).map(category => ({
    category,
    items: data.resources.filter(resource => resource.category === category),
  }));

  return <div className="mt-8 space-y-6">
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-lg font-semibold">Your Opt-in Limits</h2><p className="mt-1 text-sm text-zinc-400">{data.season.name} · {data.season.capMode.replaceAll("_", " ")}</p></div>
        <div className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-right"><p className="text-2xl font-semibold">{data.usage.distinct}</p><p className="text-xs text-zinc-500">Distinct resources selected</p>{data.usage.remainingTotal !== null && <p className="mt-1 text-xs text-zinc-400">{data.usage.remainingTotal} overall slots remaining</p>}</div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">{groups.map(group => {
        const cap = group.category === "CARD" ? data.season.cardOptInCap : group.category === "EQUIPMENT" ? data.season.equipmentOptInCap : data.season.echoOptInCap;
        return <div key={group.category} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3"><p className="text-sm text-zinc-400">{categoryLabels[group.category]}</p><p className="mt-1 font-medium">{data.usage.categories[group.category]}{cap !== null ? ` / ${cap}` : ""}</p></div>;
      })}</div>
      <p className="mt-4 text-xs text-zinc-500">Persistent Opt-ins have priority. Event Opt-ins use only remaining cap space. The same resource counts once even if selected more than once.</p>
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}
      {notice && <p className="mt-4 text-sm text-emerald-400">{notice}</p>}
    </section>

    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold">Persistent Opt-ins</h2>
      <p className="mt-1 text-sm text-zinc-400">These selections carry forward to upcoming events in the active resource pool. Changes apply immediately to upcoming events.</p>
      <div className="mt-5 space-y-5">{groups.map(group => <div key={group.category}><h3 className="mb-2 text-sm font-medium text-zinc-300">{categoryLabels[group.category]}</h3>
        {group.items.length === 0 ? <p className="text-sm text-zinc-600">No active resources.</p> : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{group.items.map(resource => {
          const key = `persistent:season:${resource.id}`;
          return <label key={resource.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm"><input type="checkbox" checked={resource.persistent} disabled={busyKey === key} onChange={e => void setSelection("persistent", resource.id, e.target.checked)} className="h-4 w-4 accent-white" /><span className="flex-1">{resource.name}</span>{busyKey === key && <span className="text-xs text-zinc-500">Saving…</span>}</label>;
        })}</div>}
      </div>)}</div>
    </section>

    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold">Upcoming Event Opt-ins</h2>
      <p className="mt-1 text-sm text-zinc-400">Choose additional rewards for a specific event. You can change these selections until guild management initializes the rotation.</p>
      {data.events.length === 0 ? <p className="mt-5 text-sm text-zinc-500">There are no upcoming events configured for this resource pool.</p> : <div className="mt-5 space-y-4">{data.events.map(event => <div key={event.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-medium">{event.typeName}</h3><p className="mt-1 text-xs text-zinc-500">{new Date(event.date).toLocaleString()}</p></div>{event.locked && <span className="rounded-full bg-amber-950 px-3 py-1 text-xs text-amber-300">Opt-ins locked</span>}</div>
        {event.rewards.length === 0 ? <p className="mt-3 text-sm text-zinc-600">No rewards configured for this event.</p> : <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{event.rewards.map(reward => {
          const key = `event:${event.id}:${reward.id}`;
          return <div key={reward.id} className="rounded-lg border border-zinc-800 p-3"><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={reward.selected} disabled={event.locked || busyKey === key} onChange={e => void setSelection("event", reward.id, e.target.checked, event.id)} className="h-4 w-4 accent-white" /><span className="flex-1">{reward.name}</span></label><div className="mt-2 flex flex-wrap gap-2 text-xs">{reward.persistent && <span className="text-sky-300">Persistent</span>}{reward.selected && reward.accepted && !reward.persistent && <span className="text-emerald-400">Within cap</span>}{reward.selected && !reward.accepted && <span className="text-amber-300">Over cap priority limit</span>}</div></div>;
        })}</div>}
      </div>)}</div>}
    </section>
  </div>;
}
