"use client";

import { useEffect, useState } from "react";

type Status = "AVAILABLE" | "UNAVAILABLE" | "AFK_BUSY";
type Row = { memberId: string; characterName: string; job: string | null; status: Status; respondedAt: string; discordUsername: string | null };

const options: { status: Status; label: string; description: string; className: string }[] = [
  { status: "AVAILABLE", label: "🟢 Available", description: "Eligible for normal roster assignment.", className: "border-emerald-800 text-emerald-300" },
  { status: "UNAVAILABLE", label: "🔴 Unavailable", description: "Excluded from event participation.", className: "border-red-900 text-red-300" },
  { status: "AFK_BUSY", label: "🟡 AFK / Busy", description: "Excluded from active parties but retained for rewards.", className: "border-amber-800 text-amber-300" },
];

export default function EventAttendancePanel({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [ownStatus, setOwnStatus] = useState<Status | null>(null);
  const [counts, setCounts] = useState({ available: 0, unavailable: 0, afkBusy: 0, noResponse: 0 });
  const [locked, setLocked] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch(`/api/events/${eventId}/attendance`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load attendance.");
    setRows(data.attendance ?? []);
    setOwnStatus(data.ownStatus ?? null);
    setCounts(data.counts ?? { available: 0, unavailable: 0, afkBusy: 0, noResponse: 0 });
    setLocked(Boolean(data.locked));
    setCanManage(Boolean(data.canManage));
  }

  useEffect(() => { load().catch(e => setError(e instanceof Error ? e.message : "Unable to load attendance.")); }, [eventId]);

  async function respond(status: Status) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/events/${eventId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save attendance.");
      setOwnStatus(status);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save attendance."); }
    finally { setBusy(false); }
  }

  return <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Event Attendance</h2><p className="mt-1 text-sm text-zinc-500">Update your response before the attendance lock.</p></div>{locked && <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">Responses locked</span>}</div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">{options.map(option => <button key={option.status} disabled={busy || locked} onClick={() => respond(option.status)} className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${ownStatus === option.status ? "bg-zinc-800 ring-1 ring-white/30" : "bg-zinc-950"} ${option.className}`}><span className="block font-medium">{option.label}</span><span className="mt-1 block text-xs text-zinc-500">{option.description}</span></button>)}</div>
    {ownStatus && <p className="mt-3 text-xs text-zinc-400">Your response: {options.find(x => x.status === ownStatus)?.label}</p>}
    <div className="mt-5 grid grid-cols-2 gap-2 text-center sm:grid-cols-4"><div className="rounded-lg bg-zinc-950 p-3"><strong className="block text-xl text-emerald-300">{counts.available}</strong><span className="text-xs text-zinc-500">Available</span></div><div className="rounded-lg bg-zinc-950 p-3"><strong className="block text-xl text-red-300">{counts.unavailable}</strong><span className="text-xs text-zinc-500">Unavailable</span></div><div className="rounded-lg bg-zinc-950 p-3"><strong className="block text-xl text-amber-300">{counts.afkBusy}</strong><span className="text-xs text-zinc-500">AFK / Busy</span></div><div className="rounded-lg bg-zinc-950 p-3"><strong className="block text-xl text-zinc-300">{counts.noResponse}</strong><span className="text-xs text-zinc-500">No response</span></div></div>
    {canManage && rows.length > 0 && <div className="mt-5"><h3 className="mb-2 text-sm font-medium text-zinc-300">Member Responses</h3><div className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">{rows.map(row => <div key={row.memberId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><div><span className="text-zinc-200">{row.characterName}</span>{row.job && <span className="ml-2 text-xs text-zinc-500">{row.job}</span>}</div><span className="text-xs text-zinc-400">{options.find(x => x.status === row.status)?.label}</span></div>)}</div></div>}
    {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
  </section>;
}
