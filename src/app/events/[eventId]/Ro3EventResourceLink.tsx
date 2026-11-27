"use client";

import { useCallback, useEffect, useState } from "react";

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

  const load = useCallback(async () => {
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
  }, [eventId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

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
    <section className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto flex min-w-0 items-center gap-2">
          <span className="text-xs font-medium text-zinc-400">Resource pool</span>
          {data.season ? (
            <span className="max-w-40 truncate text-xs text-zinc-500" title={data.season.name}>
              {data.season.name}
            </span>
          ) : (
            <span className="text-xs text-amber-300">No active pool</span>
          )}
        </div>
        <select
          aria-label="Link event to resource type"
          value={selectedId}
          onChange={event => setSelectedId(event.target.value)}
          disabled={locked || !data.season || saving}
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-white disabled:opacity-50 sm:max-w-xs"
        >
          <option value="">Not linked</option>
          {data.eventTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={locked || !data.season || saving || selectedId === (data.event.ro3EventTypeId ?? "")}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
      {(locked || (!data.eventTypes.length && data.season) || message) && (
        <p className={`mt-2 text-xs ${locked || !data.eventTypes.length ? "text-amber-300" : "text-emerald-300"}`}>
          {locked
            ? "Locked: resource type cannot be changed after opt-ins or event lock."
            : !data.eventTypes.length && data.season
              ? "No event types configured. Add one under Guild Resources."
              : message}
        </p>
      )}
    </section>
  );
}
