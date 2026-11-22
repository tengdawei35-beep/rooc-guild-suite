"use client";

import { useEffect, useMemo, useState } from "react";

type Category = "CARD" | "EQUIPMENT" | "ECHO";
type CapMode = "TOTAL" | "PER_CATEGORY" | "COMBINED";
type Resource = { id: string; name: string; category: Category; active: boolean };
type Reward = { resourceId: string; quantity: number; resource: { id: string; name: string; category: Category } };
type EventType = { id: string; name: string; active: boolean; guildEventTypeId: string | null; rewardPool: Reward[] };
type Season = {
  id: string; name: string; updatedAt: string; status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  capMode: CapMode; totalOptInCap: number | null; cardOptInCap: number | null;
  equipmentOptInCap: number | null; echoOptInCap: number | null;
  resources: Resource[]; eventTypes: EventType[];
};

const categories: Category[] = ["CARD", "EQUIPMENT", "ECHO"];
const labels: Record<Category, string> = { CARD: "Cards", EQUIPMENT: "Equipment", ECHO: "Echoes" };

export default function Ro3ResourcesClient({ initialSeasons }: { initialSeasons: Season[] }) {
  const [seasons, setSeasons] = useState(initialSeasons);
  const [selectedId, setSelectedId] = useState(initialSeasons.find(s => s.status === "ACTIVE")?.id ?? initialSeasons[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [seasonName, setSeasonName] = useState("");
  const [resourceName, setResourceName] = useState("");
  const [category, setCategory] = useState<Category>("CARD");
  const [configuredEventTypes, setConfiguredEventTypes] = useState<{ id: string; name: string; active: boolean }[]>([]);
  const [selectedConfiguredTypeId, setSelectedConfiguredTypeId] = useState("");

  const selected = useMemo(() => seasons.find(s => s.id === selectedId) ?? null, [seasons, selectedId]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/events/types", { cache: "no-store" }).then(async response => {
      if (!response.ok) return null;
      return response.json();
    }).then(data => {
      if (!cancelled && data) setConfiguredEventTypes((data.eventTypes ?? []).filter((item: { active: boolean }) => item.active));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  async function call(method: "POST" | "PATCH", body: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/guild/resources/ro3", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save resource settings.");
      const refreshed = await fetch("/api/guild/resources/ro3");
      const data = await refreshed.json();
      if (!refreshed.ok) throw new Error(data.error || "Unable to refresh resource pools.");
      setSeasons(data.seasons);
      if (result.season?.id) setSelectedId(result.season.id);
      if (result.resource?.seasonId) setSelectedId(result.resource.seasonId);
      if (result.eventType?.id) setSelectedId(result.eventType.seasonId ?? selectedId);
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save resource settings."); return false; }
    finally { setBusy(false); }
  }

  async function createSeason() {
    if (!seasonName.trim()) return;
    const ok = await call("POST", { action: "createSeason", name: seasonName });
    if (ok) setSeasonName("");
  }
  async function createResource() {
    if (!selected || !resourceName.trim()) return;
    const ok = await call("POST", { action: "createResource", seasonId: selected.id, name: resourceName, category });
    if (ok) setResourceName("");
  }
  async function createEventType() {
    if (!selected || !selectedConfiguredTypeId) return;
    const ok = await call("POST", { action: "createEventType", seasonId: selected.id, guildEventTypeId: selectedConfiguredTypeId });
    if (ok) setSelectedConfiguredTypeId("");
  }

  return <div className="mt-8 space-y-6">
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-lg font-semibold">Resource Pools</h2><p className="mt-1 text-sm text-zinc-400">Create separate pools for different seasons. Only one pool can be active at a time.</p></div>
        <div className="flex flex-wrap gap-2">
          <input value={seasonName} onChange={e => setSeasonName(e.target.value)} placeholder="New pool name" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
          <button disabled={busy || !seasonName.trim()} onClick={createSeason} className="rounded-lg hmdl-btn hmdl-btn-primary px-4 py-2 text-sm font-medium disabled:opacity-40">Create Pool</button>
        </div>
      </div>
      {seasons.length > 0 && <div className="mt-5 flex flex-wrap items-center gap-3">
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="min-w-64 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
          {seasons.map(s => <option key={s.id} value={s.id}>{s.name} · {s.status}</option>)}
        </select>
        {selected && selected.status !== "ACTIVE" && selected.status !== "ARCHIVED" && <button disabled={busy} onClick={() => call("PATCH", { action: "setSeasonStatus", seasonId: selected.id, status: "ACTIVE" })} className="rounded-lg border border-emerald-800 px-3 py-2 text-sm text-emerald-300">Activate Pool</button>}
        {selected && selected.status === "ACTIVE" && <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs text-emerald-300">Active pool</span>}
        {selected && selected.status !== "ARCHIVED" && <button disabled={busy} onClick={() => call("PATCH", { action: "setSeasonStatus", seasonId: selected.id, status: "ARCHIVED" })} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300">Archive Pool</button>}
      </div>}
      {error && <p className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}
      {!seasons.length && <p className="mt-5 text-sm text-zinc-500">No resource pools yet. Create one to configure its item pool and event rewards.</p>}
    </section>

    {selected && <><section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold">Opt-in Limits</h2>
      <p className="mt-1 text-sm text-zinc-400">One shared cap applies across Persistent Opt-ins and Event Opt-ins. Each distinct resource counts once, even if selected through both methods.</p>
      <CapSettings key={selected.id + selected.updatedAt} season={selected} busy={busy} save={body => call("PATCH", { action: "updateSeason", seasonId: selected.id, name: selected.name, ...body })} />
    </section>

    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Item Pool</h2><p className="mt-1 text-sm text-zinc-400">Add the individual Cards, Equipment and Echoes available in this pool.</p></div>
        {selected.status !== "ARCHIVED" && <div className="flex flex-wrap gap-2"><input value={resourceName} onChange={e => setResourceName(e.target.value)} placeholder="Item name" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" /><select value={category} onChange={e => setCategory(e.target.value as Category)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">{categories.map(c => <option key={c} value={c}>{labels[c]}</option>)}</select><button disabled={busy || !resourceName.trim()} onClick={createResource} className="rounded-lg hmdl-btn hmdl-btn-primary px-4 py-2 text-sm font-medium disabled:opacity-40">Add Item</button></div>}
      </div>
      <div className="mt-5 space-y-4">{categories.map(c => <div key={c}><h3 className="mb-2 text-sm font-medium text-zinc-300">{labels[c]}</h3>
        <div className="flex flex-wrap gap-2">{selected.resources.filter(r => r.category === c).map(r => <span key={r.id} className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">{r.name}<span className={r.active ? "text-emerald-400" : "text-zinc-500"}>{r.active ? "Active" : "Inactive"}</span>{selected.status !== "ARCHIVED" && <button disabled={busy} onClick={() => call("PATCH", { action: "setResourceActive", resourceId: r.id, active: !r.active })} className="text-xs text-zinc-400 underline">{r.active ? "Disable" : "Enable"}</button>}</span>)}
          {!selected.resources.some(r => r.category === c) && <span className="text-sm text-zinc-600">No items added.</span>}</div></div>)}</div>
    </section>

    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Event Types & Reward Quantities</h2><p className="mt-1 text-sm text-zinc-400">Select event types created under Events, then configure the reward quantities for this resource pool.</p></div>
        {selected.status !== "ARCHIVED" && <div className="flex flex-wrap gap-2"><select value={selectedConfiguredTypeId} onChange={e => setSelectedConfiguredTypeId(e.target.value)} className="min-w-56 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"><option value="">Select an Events event type</option>{configuredEventTypes.filter(item => !selected.eventTypes.some(existing => existing.guildEventTypeId === item.id)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button disabled={busy || !selectedConfiguredTypeId} onClick={createEventType} className="rounded-lg hmdl-btn hmdl-btn-primary px-4 py-2 text-sm font-medium disabled:opacity-40">Add Reward Configuration</button></div>}
      </div>
      <div className="mt-5 space-y-4">{selected.eventTypes.map(et => <div key={et.id} className="rounded-xl border border-zinc-800 p-4"><div className="flex items-center justify-between"><h3 className="font-medium">{et.name}</h3>{selected.status !== "ARCHIVED" && <button disabled={busy} onClick={() => call("PATCH", { action: "setEventTypeActive", eventTypeId: et.id, active: !et.active })} className="text-xs text-zinc-400 underline">{et.active ? "Disable" : "Enable"}</button>}</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{selected.resources.filter(r => r.active).map(r => { const reward = et.rewardPool.find(x => x.resourceId === r.id); return <RewardEditor key={et.id + r.id} name={r.name} category={labels[r.category]} quantity={reward?.quantity ?? 0} disabled={busy || selected.status === "ARCHIVED"} save={quantity => call("POST", { action: "saveReward", eventTypeId: et.id, resourceId: r.id, quantity })} />; })}</div>
        {selected.resources.filter(r => r.active).length === 0 && <p className="mt-3 text-sm text-zinc-500">Add active items to this pool to configure rewards.</p>}
      </div>)}
      {!selected.eventTypes.length && <p className="text-sm text-zinc-500">No event types configured for this pool.</p>}</div>
    </section></>}
  </div>;
}

function CapSettings({ season, busy, save }: { season: Season; busy: boolean; save: (body: Record<string, unknown>) => Promise<boolean> }) {
  const [mode, setMode] = useState<CapMode>(season.capMode);
  const [total, setTotal] = useState(season.totalOptInCap?.toString() ?? "");
  const [card, setCard] = useState(season.cardOptInCap?.toString() ?? "");
  const [equipment, setEquipment] = useState(season.equipmentOptInCap?.toString() ?? "");
  const [echo, setEcho] = useState(season.echoOptInCap?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const archived = season.status === "ARCHIVED";
  async function submit() { setSaving(true); setMessage(""); const ok = await save({ capMode: mode, totalOptInCap: total === "" ? null : Number(total), cardOptInCap: card === "" ? null : Number(card), equipmentOptInCap: equipment === "" ? null : Number(equipment), echoOptInCap: echo === "" ? null : Number(echo) }); setMessage(ok ? "Saved." : "Could not save limits."); setSaving(false); }
  const input = (value: string, setter: (v: string) => void, label: string) => <label className="block text-sm text-zinc-400">{label}<input type="number" min="1" value={value} onChange={e => setter(e.target.value)} disabled={archived} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white disabled:opacity-50" /></label>;
  return <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="block text-sm text-zinc-400">Cap Mode<select value={mode} onChange={e => setMode(e.target.value as CapMode)} disabled={archived} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"><option value="TOTAL">Total Cap</option><option value="PER_CATEGORY">Per-Category Cap</option><option value="COMBINED">Combined Cap</option></select></label>
    {(mode === "TOTAL" || mode === "COMBINED") && input(total, setTotal, "Overall distinct-resource cap")}
    {(mode === "PER_CATEGORY" || mode === "COMBINED") && <>{input(card, setCard, "Cards cap")}{input(equipment, setEquipment, "Equipment cap")}{input(echo, setEcho, "Echoes cap")}</>}
    <div className="flex items-end gap-3"><button disabled={busy || saving || archived} onClick={submit} className="rounded-lg hmdl-btn hmdl-btn-primary px-4 py-2 text-sm font-medium disabled:opacity-40">Save Limits</button>{message && <span className="text-sm text-zinc-400">{message}</span>}</div>
  </div>;
}

function RewardEditor({ name, category, quantity, disabled, save }: { name: string; category: string; quantity: number; disabled: boolean; save: (n: number) => Promise<boolean> }) {
  const [value, setValue] = useState(String(quantity));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  async function submit() { const n = Number(value); if (!Number.isInteger(n) || n < 0) return; setSaving(true); setSaved(await save(n)); setSaving(false); }
  return <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3"><p className="text-sm font-medium">{name}</p><p className="text-xs text-zinc-500">{category}</p><div className="mt-2 flex gap-2"><input type="number" min="0" value={value} onChange={e => { setValue(e.target.value); setSaved(false); }} disabled={disabled} className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm" /><button disabled={disabled || saving || !Number.isInteger(Number(value)) || Number(value) < 0} onClick={submit} className="rounded border border-zinc-700 px-3 py-1 text-xs disabled:opacity-40">{saving ? "..." : "Save"}</button></div>{saved && <p className="mt-1 text-xs text-emerald-400">Saved</p>}</div>;
}
