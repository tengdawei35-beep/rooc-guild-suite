"use client";

import { useEffect, useState } from "react";

type EventType = { id: string; name: string };
type LinkData = {
  event: { id: string; ro3EventTypeId: string | null; locked: boolean; hasOptIns: boolean };
  season: { id: string; name: string } | null;
  eventTypes: EventType[];
};

export default function Ro3EventResourceLink({ eventId }: { eventId: string }) {
  const [data, setData] = useState<LinkData | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`/api/events/${eventId}/ro3-resource-type`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409 || response.status === 403) return;
        throw new Error(result.error || "Unable to load event resource settings.");
      }
      setData(result);
      setSelectedId(result.event.ro3EventTypeId ?? "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load event resource settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [eventId]);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/events/${eventId}/ro3-resource-type`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ro3EventTypeId: selectedId || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to link event.");
      setData(current => current ? { ...current, event: { ...current.event, ro3EventTypeId: result.event.ro3EventTypeId } } : current);
      setMessage("Event resource type saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to link event.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !data) return null;
  const locked = data.event.locked || data.event.hasOptIns;
  return (
    <section className="mb-6 rounded-2xl border border-indigo-900/70 bg-indigo-950/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-white">RO3 Resource Event</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Link this event to an event type in the active Resources pool so members can see its Event Opt-ins.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {data.season ? `Active pool: ${data.season.name}` : "No active Resources pool is configured."}
          </p>
        </div>
        <div className="flex min-w-64 flex-1 flex-wrap gap-2 sm:max-w-xl">
          <select
            value={selectedId}
            onChange={event => setSelectedId(event.target.value)}
            disabled={locked || !data.season || saving}
            className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            <option value="">Not linked</option>
            {data.eventTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
          <button
            type="button"
            onClick={save}
            disabled={locked || !data.season || saving || selectedId === (data.event.ro3EventTypeId ?? "")}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
      {locked && <p className="mt-3 text-xs text-amber-300">This event already has Event Opt-ins or has been locked, so its resource type cannot be changed.</p>}
      {!data.eventTypes.length && data.season && <p className="mt-3 text-xs text-amber-300">No active event types are configured in this pool. Add one under Guild Resources first.</p>}
      {message && <p className="mt-3 text-sm text-zinc-300">{message}</p>}
    </section>
  );
}
