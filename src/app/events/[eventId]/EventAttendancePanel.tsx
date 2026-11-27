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
  useEffect(() => { setResponsePage(page => Math.min(page, responsePageCount)); }, [responsePageCount]);
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

  return <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-3"><h2 className="text-sm font-semibold">Attendance</h2>{locked && <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">Locked</span>}{ownStatus && <span className="text-[11px] text-zinc-500">Your response: {options.find(x => x.status === ownStatus)?.label}</span>}</div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-emerald-300">{counts.available} Available</span><span className="text-red-300">{counts.unavailable} Unavailable</span><span className="text-amber-300">{counts.afkBusy} AFK / Busy</span><span className="text-zinc-400">{counts.noResponse} No response</span>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2">{options.map(option => <button key={option.status} type="button" aria-pressed={ownStatus === option.status} disabled={busy || locked} onClick={() => respond(option.status)} className={`min-h-10 rounded-lg border px-4 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${ownStatus === option.status ? "bg-zinc-800 ring-1 ring-white/30" : "bg-zinc-950"} ${option.className}`}>{option.label}</button>)}</div>
    {canManage && rows.length > 0 && <div className="mt-3 overflow-hidden rounded-lg border border-zinc-800"><button type="button" aria-expanded={responsesExpanded} onClick={() => setResponsesExpanded(value => !value)} className="flex w-full items-center justify-between gap-3 bg-zinc-950 px-3 py-2 text-left transition hover:bg-zinc-800/70"><span className="text-xs font-medium text-zinc-300">Member responses · {rows.length}</span><span aria-hidden="true" className="text-zinc-400">{responsesExpanded ? "−" : "+"}</span></button>{responsesExpanded && <div className="border-t border-zinc-800"><div className="divide-y divide-zinc-800">{visibleRows.map(row => <div key={row.memberId} className="flex items-center justify-between gap-3 px-3 py-2 text-xs"><div className="min-w-0"><span className="text-zinc-200">{row.characterName}</span>{row.job && <span className="ml-2 text-zinc-500">{row.job}</span>}</div><span className="shrink-0 text-zinc-400">{row.status ? options.find(x => x.status === row.status)?.label : "No response"}</span></div>)}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 px-3 py-2"><span className="text-[11px] text-zinc-500">Showing {(responsePage - 1) * responsePageSize + 1}–{Math.min(responsePage * responsePageSize, rows.length)} of {rows.length}</span><div className="flex items-center gap-2"><button type="button" disabled={responsePage <= 1} onClick={() => setResponsePage(page => Math.max(1, page - 1))} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-40">Previous</button><span aria-live="polite" className="text-xs text-zinc-500">Page {responsePage} of {responsePageCount}</span><button type="button" disabled={responsePage >= responsePageCount} onClick={() => setResponsePage(page => Math.min(responsePageCount, page + 1))} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-40">Next</button></div></div></div>}</div>}
    {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
  </section>;
