"use client";

import { useEffect, useRef, useState } from "react";

type Status = "AVAILABLE" | "UNAVAILABLE" | "AFK_BUSY";
type Row = { memberId: string; characterName: string; job: string | null; status: Status | null; respondedAt: string | null; discordUsername: string | null };

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
  const [responsesExpanded, setResponsesExpanded] = useState(false);
  const [responsePage, setResponsePage] = useState(1);
  const responsePageSize = 10;
  const responsePageCount = Math.max(1, Math.ceil(rows.length / responsePageSize));
  const visibleRows = rows.slice((responsePage - 1) * responsePageSize, responsePage * responsePageSize);
  const refreshInFlight = useRef(false);
  const busyRef = useRef(false);

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

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    const refresh = () => {
      if (!active || document.visibilityState !== "visible" || busyRef.current || refreshInFlight.current) return;
      refreshInFlight.current = true;
      controller = new AbortController();
      fetch(`/api/events/${eventId}/attendance`, { cache: "no-store", signal: controller.signal })
        .then(async response => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Unable to load attendance.");
          if (!active || busyRef.current) return;
          setRows(data.attendance ?? []);
          setOwnStatus(data.ownStatus ?? null);
          setCounts(data.counts ?? { available: 0, unavailable: 0, afkBusy: 0, noResponse: 0 });
          setLocked(Boolean(data.locked));
          setCanManage(Boolean(data.canManage));
          setError("");
        })
        .catch(e => {
          if (active && !(e instanceof DOMException && e.name === "AbortError")) {
            setError(e instanceof Error ? e.message : "Unable to load attendance.");
          }
        })
        .finally(() => { refreshInFlight.current = false; });
    };
    refresh();
    // Keep the HMDL panel in sync with responses submitted through Discord.
    const interval = window.setInterval(refresh, 10_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      controller?.abort();
      refreshInFlight.current = false;
    };
  }, [eventId]);

  async function respond(status: Status) {
    busyRef.current = true;
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
    finally { busyRef.current = false; setBusy(false); }
  }

  return <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Event Attendance</h2><p className="mt-1 text-sm text-zinc-500">Update your response before the attendance lock.</p></div>{locked && <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">Responses locked</span>}</div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">{options.map(option => <button key={option.status} type="button" aria-pressed={ownStatus === option.status} disabled={busy || locked} onClick={() => respond(option.status)} className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${ownStatus === option.status ? "bg-zinc-800 ring-1 ring-white/30" : "bg-zinc-950"} ${option.className}`}><span className="block font-medium">{option.label}</span><span className="mt-1 block text-xs text-zinc-500">{option.description}</span></button>)}</div>
    {ownStatus && <p className="mt-3 text-xs text-zinc-400">Your response: {options.find(x => x.status === ownStatus)?.label}</p>}
    <div className="mt-5 grid grid-cols-2 gap-2 text-center sm:grid-cols-4"><div className="rounded-lg bg-zinc-950 p-3"><strong className="block text-xl text-emerald-300">{counts.available}</strong><span className="text-xs text-zinc-500">Available</span></div><div className="rounded-lg bg-zinc-950 p-3"><strong className="block text-xl text-red-300">{counts.unavailable}</strong><span className="text-xs text-zinc-500">Unavailable</span></div><div className="rounded-lg bg-zinc-950 p-3"><strong className="block text-xl text-amber-300">{counts.afkBusy}</strong><span className="text-xs text-zinc-500">AFK / Busy</span></div><div className="rounded-lg bg-zinc-950 p-3"><strong className="block text-xl text-zinc-300">{counts.noResponse}</strong><span className="text-xs text-zinc-500">No response</span></div></div>
    {canManage && rows.length > 0 && <div className="mt-5 overflow-hidden rounded-xl border border-zinc-800"><button type="button" aria-expanded={responsesExpanded} onClick={() => setResponsesExpanded(value => !value)} className="flex w-full items-center justify-between gap-3 bg-zinc-950 px-4 py-3 text-left transition hover:bg-zinc-800/70"><span><span className="block text-sm font-medium text-zinc-200">Member Responses</span><span className="mt-0.5 block text-xs text-zinc-500">{rows.length} member responses · {responsesExpanded ? "Hide details" : "Show details"}</span></span><span aria-hidden="true" className="text-zinc-400">{responsesExpanded ? "−" : "+"}</span></button>{responsesExpanded && <div className="border-t border-zinc-800"><div className="divide-y divide-zinc-800">{visibleRows.map(row => <div key={row.memberId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><div className="min-w-0"><span className="text-zinc-200">{row.characterName}</span>{row.job && <span className="ml-2 text-xs text-zinc-500">{row.job}</span>}</div><span className="shrink-0 text-xs text-zinc-400">{row.status ? options.find(x => x.status === row.status)?.label : "No response"}</span></div>)}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 px-4 py-3"><span className="text-xs text-zinc-500">Showing {(responsePage - 1) * responsePageSize + 1}–{Math.min(responsePage * responsePageSize, rows.length)} of {rows.length}</span><div className="flex items-center gap-2"><button type="button" disabled={responsePage <= 1} onClick={() => setResponsePage(page => Math.max(1, page - 1))} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40">Previous</button><span aria-live="polite" className="text-xs text-zinc-500">Page {responsePage} of {responsePageCount}</span><button type="button" disabled={responsePage >= responsePageCount} onClick={() => setResponsePage(page => Math.min(responsePageCount, page + 1))} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40">Next</button></div></div></div>}</div>}
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
  </section>;
}
