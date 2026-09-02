"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type EventOption = { id: string; type: "GUILD_LEAGUE" | "EMPERIUM_OVERRUN"; date: string };
type MemberOption = { id: string; characterName: string | null };
type Assignment = { memberId: string; memberName: string | null; resourceId: string; resourceName: string; reservedQuantity: number; assignedQuantity: number };
type ResourceResult = { resourceId: string; resourceName: string; type: "FEATHER" | "CARD"; total: number; reserved: number; allocated: number; overflow: number; selectedMembers: MemberOption[]; assignments: Assignment[] };
type AllocationResult = { guildId: string; guildName: string; nonReservedMemberCount: number; eligibleMembers: MemberOption[]; resources: ResourceResult[] };
type AllocationRun = { id: string; status: string; createdAt: string; completedAt: string | null };
type Override = { resourceId: string; assignments: { memberId: string; assignedQuantity: number }[] };

export default function AllocationPage() {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState("");
  const [eventsLoading, setEventsLoading] = useState(true);
  const [memberCount, setMemberCount] = useState("");
  const [preview, setPreview] = useState<AllocationResult | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<AllocationRun | null>(null);

  useEffect(() => {
    async function loadEvents() {
      try {
        const response = await fetch("/api/events", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Failed to load events.");
        const loaded = Array.isArray(data.events) ? data.events : [];
        setEvents(loaded);
        if (loaded.length) setEventId(loaded[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load events.");
      } finally {
        setEventsLoading(false);
      }
    }
    loadEvents();
  }, []);

  function invalidate() { setPreview(null); setSuccess(null); setError(null); }

  async function handlePreview() {
    setError(null); setSuccess(null); setPreview(null);
    const count = Number(memberCount);
    if (!eventId) return setError("Select an event before generating an allocation preview.");
    if (!Number.isInteger(count) || count < 0) return setError("Enter a valid number of non-reserved members.");
    setLoading(true);
    try {
      const response = await fetch("/api/allocation/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId, nonReservedMemberCount: count }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to build allocation preview.");
      setPreview(data.preview);
      setCanEdit(Boolean(data.canEdit));
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to build allocation preview."); }
    finally { setLoading(false); }
  }

  function updateResource(resourceId: string, updater: (resource: ResourceResult) => ResourceResult) {
    setPreview((current) => current ? { ...current, resources: current.resources.map((r) => r.resourceId === resourceId ? updater(r) : r) } : current);
    setSuccess(null); setError(null);
  }

  function updateAssignment(resourceId: string, index: number, patch: Partial<Assignment>) {
    updateResource(resourceId, (resource) => ({ ...resource, assignments: resource.assignments.map((a, i) => i === index ? { ...a, ...patch } : a) }));
  }

  function removeAssignment(resourceId: string, index: number) {
    updateResource(resourceId, (resource) => ({ ...resource, assignments: resource.assignments.filter((_, i) => i !== index) }));
  }

  function getOverrides(): Override[] {
    if (!preview) return [];
    return preview.resources.map((resource) => ({
      resourceId: resource.resourceId,
      assignments: resource.assignments.filter((a) => a.reservedQuantity === 0 && a.assignedQuantity > 0).map((a) => ({ memberId: a.memberId, assignedQuantity: a.assignedQuantity })),
    }));
  }

  function editedResources() {
    return preview?.resources.map((resource) => {
      const normal = resource.assignments.filter((a) => a.reservedQuantity === 0 && a.assignedQuantity > 0);
      const reserved = resource.assignments.filter((a) => a.reservedQuantity > 0);
      const reservedTotal = reserved.reduce((s, a) => s + a.reservedQuantity, 0);
      const normalTotal = normal.reduce((s, a) => s + a.assignedQuantity, 0);
      const reservedOverflow = reserved.reduce((s, a) => s + a.assignedQuantity, 0);
      const allocated = reservedTotal + normalTotal + reservedOverflow;
      return { ...resource, allocated, overflow: Math.max(resource.total - allocated, 0), selectedMembers: normal.map((a) => ({ id: a.memberId, characterName: a.memberName })) };
    }) ?? [];
  }

  async function handleRunAllocation() {
    setError(null); setSuccess(null);
    if (!eventId || !preview) return setError(!eventId ? "Select an event before running the allocation." : "Generate an allocation preview before running the allocation.");
    const count = Number(memberCount);
    if (!Number.isInteger(count) || count < 0) return setError("Enter a valid number of non-reserved members.");
    if (!window.confirm("Run this allocation?\n\nThe allocation will be permanently recorded and rotation states will be advanced.")) return;
    setRunning(true);
    try {
      const response = await fetch("/api/allocation/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId, nonReservedMemberCount: count, overrides: getOverrides() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to run allocation.");
      setSuccess(data.allocationRun);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to run allocation."); }
    finally { setRunning(false); }
  }

  const selectedEvent = events.find((e) => e.id === eventId);
  const resources = editedResources();
  const totalOverflow = resources.reduce((s, r) => s + r.overflow, 0);
  const totalParticipants = resources.reduce((s, r) => s + r.selectedMembers.length, 0);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/" className="text-sm text-zinc-500 hover:text-white">← Dashboard</Link>
        <header className="mb-5 mt-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-medium uppercase tracking-widest text-zinc-600">ROO Guild Suite</p><h1 className="text-2xl font-bold tracking-tight">Allocation</h1><p className="mt-1 text-sm text-zinc-500">Preview and adjust the next resource allocation before committing it.</p></div>
          {selectedEvent && <span className="w-fit rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">{formatEventType(selectedEvent.type)} · {formatEventDate(selectedEvent.date)}</span>}
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_auto] md:items-end">
            <Field label="Event"><select value={eventId} onChange={(e) => { setEventId(e.target.value); invalidate(); }} disabled={eventsLoading || loading || running} className={inputClass}><option value="">{eventsLoading ? "Loading events..." : "Select an event"}</option>{events.map((e) => <option key={e.id} value={e.id}>{formatEventType(e.type)} — {formatEventDate(e.date)}</option>)}</select></Field>
            <Field label="Non-reserved members"><input type="number" min={0} value={memberCount} onChange={(e) => { setMemberCount(e.target.value); invalidate(); }} placeholder="e.g. 10" disabled={loading || running} className={inputClass} /></Field>
            <button type="button" onClick={handlePreview} disabled={loading || running || eventsLoading || !eventId} className="rounded-lg bg-white px-5 py-2.5 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Calculating..." : "Preview Allocation"}</button>
          </div>
          <p className="mt-2 text-xs text-zinc-600">Members on leave for the selected event date are automatically excluded.</p>
          {error && <div className="mt-3 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-400">{error}</div>}
          {success && <div className="mt-3 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-400">Allocation completed · Run ID: {success.id}</div>}
        </section>

        {preview && <section className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Allocation Preview</h2><p className="text-xs text-zinc-600">{preview.guildName} · {totalParticipants} active allocation entries</p></div>{canEdit && <span className="rounded-full border border-emerald-900 bg-emerald-950/30 px-2.5 py-1 text-xs text-emerald-400">Editable</span>}</div>
          <div className="grid gap-3 sm:grid-cols-3"><SummaryCard label="Resources" value={resources.length}/><SummaryCard label="Participants" value={totalParticipants}/><SummaryCard label="Overflow" value={totalOverflow}/></div>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {resources.map((resource) => <ResourceCard key={resource.resourceId} resource={resource} members={preview.eligibleMembers} editable={canEdit && !running} onChange={updateAssignment} onRemove={removeAssignment} />)}
          </div>
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h3 className="font-semibold">Ready to run?</h3><p className="text-xs text-zinc-500">Changes above are preview-only until you run the allocation.</p></div>
            <button type="button" onClick={handleRunAllocation} disabled={loading || running || success !== null} className="rounded-lg bg-emerald-500 px-5 py-2.5 font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">{running ? "Running..." : success ? "Completed" : "Run Allocation"}</button>
          </div>
        </section>}
      </div>
    </main>
  );
}

const inputClass = "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50";
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="block text-xs font-medium text-zinc-400">{label}</label>{children}</div>; }
function formatEventType(type: EventOption["type"]) { return type === "GUILD_LEAGUE" ? "Guild League" : "Emperium Overrun"; }
function formatEventDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" }); }
function SummaryCard({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>; }

function ResourceCard({ resource, members, editable, onChange, onRemove }: { resource: ResourceResult; members: MemberOption[]; editable: boolean; onChange: (resourceId: string, index: number, patch: Partial<Assignment>) => void; onRemove: (resourceId: string, index: number) => void }) {
  const reservations = resource.assignments.filter((a) => a.reservedQuantity > 0);
  const normal = resource.assignments.map((a, index) => ({ a, index })).filter(({ a }) => a.reservedQuantity === 0 && a.assignedQuantity > 0);
  return <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3"><div className="flex items-center gap-2"><h3 className="font-semibold">{resource.resourceName}</h3><span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">{resource.type === "FEATHER" ? "Feather" : "Card"}</span></div><div className="flex gap-3 text-xs text-zinc-500"><span>Total <b className="text-zinc-300">{resource.total}</b></span><span>Reserved <b className="text-zinc-300">{resource.reserved}</b></span><span>Allocated <b className="text-zinc-300">{resource.allocated}</b></span><span>Overflow <b className="text-zinc-300">{resource.overflow}</b></span></div></div>
    <div className="divide-y divide-zinc-800">
      {reservations.map((a, i) => <div key={`r-${a.memberId}-${i}`} className="flex items-center justify-between px-4 py-2.5 text-sm"><span>{a.memberName ?? "Unknown"}</span><span className="text-xs text-zinc-500">Reserved · ×{a.reservedQuantity}</span></div>)}
      {normal.length === 0 && <p className="px-4 py-4 text-sm text-zinc-600">No normal allocations.</p>}
      {normal.map(({ a, index }) => <div key={`a-${a.memberId}-${index}`} className="grid grid-cols-[minmax(0,1fr)_76px_auto] items-center gap-2 px-4 py-2.5">
        {editable ? <select value={a.memberId} onChange={(e) => onChange(resource.resourceId, index, { memberId: e.target.value, memberName: members.find((m) => m.id === e.target.value)?.characterName ?? null })} className="min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-white outline-none focus:border-zinc-400">{members.map((m) => <option key={m.id} value={m.id}>{m.characterName ?? "Unnamed member"}</option>)}</select> : <span className="truncate text-sm">{a.memberName ?? "Unknown"}</span>}
        {editable ? <input type="number" min={0} value={a.assignedQuantity} onChange={(e) => onChange(resource.resourceId, index, { assignedQuantity: Math.max(0, Number(e.target.value) || 0) })} className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-sm text-white outline-none focus:border-zinc-400" /> : <span className="text-right text-sm font-semibold">×{a.assignedQuantity}</span>}
        {editable ? <button type="button" onClick={() => onRemove(resource.resourceId, index)} className="rounded-md px-2 py-2 text-xs text-zinc-500 hover:bg-red-950/40 hover:text-red-400">Remove</button> : <span className="text-right text-xs text-zinc-500">Allocated</span>}
      </div>)}
    </div>
  </div>;
}
