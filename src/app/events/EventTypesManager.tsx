"use client";

import { useEffect, useState } from "react";

type EventType = {
  id: string; name: string; active: boolean; battlefieldCount: number;
  partiesPerBattlefield: number; weekdays: number[]; startTime: string; timeZone: string;
};
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const empty = { name: "", battlefieldCount: 2, partiesPerBattlefield: 4, weekdays: [2, 4], startTime: "20:00" };

export default function EventTypesManager() {
  const [items, setItems] = useState<EventType[]>([]);
  const [timeZone, setTimeZone] = useState("");
  const [timeZones, setTimeZones] = useState<string[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/events/types", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load event types.");
    setItems(data.eventTypes || []);
    const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    setTimeZone(data.timeZone || detectedTimeZone);
    if (!data.timeZone) {
      await fetch("/api/events/types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setTimeZone", timeZone: detectedTimeZone }) });
    }
  }

  useEffect(() => {
    try {
      const supported = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
      setTimeZones(supported.length ? supported : ["UTC", "Asia/Kuala_Lumpur", "Asia/Singapore", "Asia/Bangkok", "Asia/Manila", "Europe/London", "America/Los_Angeles", "America/New_York"]);
    } catch { setTimeZones(["UTC", "Asia/Kuala_Lumpur", "Asia/Singapore", "Asia/Bangkok"]); }
    load().catch(e => setError(e instanceof Error ? e.message : "Unable to load event types."));
  }, []);

  async function saveTimeZone() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/events/types", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setTimeZone", timeZone }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to save timezone.");
      setMessage("Timezone saved. New recurring events will use this timezone.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save timezone."); }
    finally { setBusy(false); }
  }

  async function saveType() {
    setBusy(true); setError(""); setMessage("");
    try {
      const body = { ...form, timeZone };
      const response = await fetch("/api/events/types", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing ? { ...body, id: editing } : body) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to save event type.");
      setForm(empty); setEditing(""); await load(); setMessage("Event type saved. Changes apply to future events only.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save event type."); }
    finally { setBusy(false); }
  }

  async function toggle(item: EventType) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/events/types", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, active: !item.active }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to update event type.");
      await load(); setMessage(item.active ? "Event type disabled. Historical events are retained." : "Event type enabled.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update event type."); }
    finally { setBusy(false); }
  }

  function edit(item: EventType) {
    setEditing(item.id);
    setForm({ name: item.name, battlefieldCount: item.battlefieldCount, partiesPerBattlefield: item.partiesPerBattlefield, weekdays: item.weekdays, startTime: item.startTime });
  }

  function toggleDay(day: number) {
    setForm(current => ({ ...current, weekdays: current.weekdays.includes(day) ? current.weekdays.filter(x => x !== day) : [...current.weekdays, day].sort() }));
  }

  return <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-xl font-semibold">RO3 Event Type Management</h2><p className="mt-1 text-sm text-zinc-400">Configure recurring event formats. Changes affect future events only.</p></div>
      <div className="min-w-64"><label className="block text-xs text-zinc-400">Guild event timezone</label><div className="mt-1 flex gap-2"><select value={timeZone} onChange={e => setTimeZone(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">{timeZones.map(tz => <option key={tz} value={tz}>{tz}</option>)}{timeZone && !timeZones.includes(timeZone) && <option value={timeZone}>{timeZone}</option>}</select><button disabled={busy || !timeZone} onClick={saveTimeZone} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs disabled:opacity-40">Save</button></div><p className="mt-1 text-xs text-zinc-600">Initially detected from your computer. You can change it here.</p></div>
    </div>
    <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-3">
        <h3 className="font-medium">{editing ? "Edit event type" : "Create event type"}</h3>
        <label className="block text-sm text-zinc-400">Event name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={80} placeholder="e.g. Guild War" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm text-zinc-400">Battlefields<input type="number" min="1" max="20" value={form.battlefieldCount} onChange={e => setForm({ ...form, battlefieldCount: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" /></label>
          <label className="block text-sm text-zinc-400">Parties per battlefield<input type="number" min="1" max="20" value={form.partiesPerBattlefield} onChange={e => setForm({ ...form, partiesPerBattlefield: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" /></label>
        </div>
        <label className="block text-sm text-zinc-400">Recurring start time<input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" /></label>
        <div><p className="mb-2 text-sm text-zinc-400">Recurring weekdays</p><div className="flex flex-wrap gap-2">{days.map((day, index) => <button type="button" key={day} onClick={() => toggleDay(index)} className={`rounded-lg border px-3 py-2 text-xs ${form.weekdays.includes(index) ? "border-white bg-white text-black" : "border-zinc-700 text-zinc-400"}`}>{day.slice(0, 3)}</button>)}</div></div>
        <div className="flex gap-2"><button disabled={busy || !form.name.trim() || !form.weekdays.length || !timeZone} onClick={saveType} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40">{busy ? "Saving…" : editing ? "Save changes" : "Create event type"}</button>{editing && <button disabled={busy} onClick={() => { setEditing(""); setForm(empty); }} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm">Cancel</button>}</div>
      </div>
      <div className="space-y-3"><h3 className="font-medium">Configured event types</h3>{items.length === 0 && <p className="text-sm text-zinc-500">No custom event types yet.</p>}{items.map(item => <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{item.name}</p><p className="mt-1 text-xs text-zinc-500">{item.battlefieldCount} battlefields · {item.partiesPerBattlefield} parties each · {item.startTime} ({item.timeZone})</p><p className="mt-1 text-xs text-zinc-500">{item.weekdays.map(day => days[day]?.slice(0, 3)).join(", ") || "No recurrence"}</p></div><span className={`rounded-full px-2 py-1 text-xs ${item.active ? "bg-emerald-950 text-emerald-300" : "bg-zinc-800 text-zinc-500"}`}>{item.active ? "Active" : "Disabled"}</span></div><div className="mt-3 flex gap-3 text-xs"><button onClick={() => edit(item)} className="text-zinc-300 underline">Edit</button><button disabled={busy} onClick={() => toggle(item)} className="text-zinc-400 underline">{item.active ? "Disable" : "Enable"}</button></div></div>)}</div>
    </div>
    {(error || message) && <p className={`mt-4 rounded-lg border p-3 text-sm ${error ? "border-red-900 bg-red-950/40 text-red-300" : "border-emerald-900 bg-emerald-950/40 text-emerald-300"}`}>{error || message}</p>}
  </section>;
}
