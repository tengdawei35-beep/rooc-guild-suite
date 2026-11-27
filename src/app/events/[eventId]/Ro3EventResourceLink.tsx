"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

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
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [mount, setMount] = useState<HTMLElement | null>(null);

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

  // Mount this small control inside the Event Rules card instead of adding
  // another full-width panel above the event content.
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const attach = () => {
      if (cancelled) return;
      const heading = Array.from(document.querySelectorAll("h2")).find(
        node => node.textContent?.trim() === "Event Rules"
      );
      const section = heading?.closest("section");
      if (section) {
        const target = document.createElement("div");
        target.dataset.ro3ResourcePoolControl = "true";
        section.appendChild(target);
        setMount(target);
        return;
      }
      timer = window.setTimeout(attach, 50);
    };

    attach();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => () => mount?.remove(), [mount]);

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
      setData(current => current ? {
        ...current,
        event: { ...current.event, ro3EventTypeId: result.event.ro3EventTypeId },
      } : current);
      setMessage("Event resource type saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to link event.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !data || !mount) return null;

  const locked = data.event.locked || data.event.hasOptIns;
  const selectedType = data.eventTypes.find(type => type.id === selectedId);
  const currentLabel = selectedType?.name ?? (selectedId ? "Unknown resource type" : "Not linked");

  return createPortal(
    <div className="mt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`event-resource-pool-${eventId}`}
        onClick={() => {
          setOpen(value => !value);
          setMessage("");
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-white"
      >
        <span>Resource pool</span>
        <span className="text-zinc-200">{currentLabel}</span>
        <span className="text-zinc-600">{open ? "−" : "Change"}</span>
      </button>

      {open && (
        <div
          id={`event-resource-pool-${eventId}`}
          className="mt-2 flex max-w-2xl flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2"
        >
          <label htmlFor={`event-resource-type-${eventId}`} className="text-xs text-zinc-500">
            Link event to
          </label>
          <select
            id={`event-resource-type-${eventId}`}
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
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {locked && (
            <p className="basis-full text-xs text-amber-300">
              Locked: resource type cannot be changed after opt-ins or event lock.
            </p>
          )}
          {!locked && !data.season && (
            <p className="basis-full text-xs text-amber-300">No active resource pool.</p>
          )}
          {!locked && data.season && !data.eventTypes.length && (
            <p className="basis-full text-xs text-amber-300">No event types configured. Add one under Guild Resources.</p>
          )}
          {message && (
            <p role="status" className="basis-full text-xs text-emerald-300">{message}</p>
          )}
        </div>
      )}
    </div>,
    mount
  );
}
