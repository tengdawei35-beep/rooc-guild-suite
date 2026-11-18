"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Roster = {
  id: string;
  name: string;
  generationMode: "MANUAL" | "AUTOMATIC";
  memberCount: number;
  partyCount: number;
  createdAt?: string;
};

type EventResponse = {
  event: {
    finalRosterId: string | null;
  };
  rosters: Roster[];
  error?: string;
};

export default function FinalRosterControls({
  eventId,
}: {
  eventId: string;
}) {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [finalRosterId, setFinalRosterId] = useState<string | null>(null);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);

  async function load() {
    setError(null);
    try {
      const response = await fetch(`/api/events/${eventId}`, { cache: "no-store" });
      const result = (await response.json()) as EventResponse;
      if (!response.ok) throw new Error(result.error ?? "Failed to load rosters.");
      setRosters(result.rosters);
      setFinalRosterId(result.event.finalRosterId);
      setSelectedRosterId(result.event.finalRosterId ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roster status.");
    }
  }

  useEffect(() => {
    load();
  }, [eventId]);

  // The event page owns the Rosters header. Mount this compact control row
  // directly into that header instead of rendering a separate card at the
  // top of the page.
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const findTarget = () => {
      if (cancelled) return;
      const headings = Array.from(document.querySelectorAll("h2"));
      const heading = headings.find(
        (node) => node.textContent?.trim() === "Rosters"
      );
      const header = heading?.parentElement;
      if (header) {
        const target = document.createElement("div");
        target.dataset.finalRosterControls = "true";
        header.appendChild(target);
        setMount(target);
        return;
      }
      attempts += 1;
      if (attempts < 100) window.setTimeout(findTarget, 50);
    };

    findTarget();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      mount?.remove();
    };
  }, [mount]);

  async function finalize() {
    if (!selectedRosterId) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/${eventId}/final-roster`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rosterId: selectedRosterId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to finalize roster.");
      setFinalRosterId(result.finalRosterId ?? selectedRosterId);
      setSelectedRosterId(result.finalRosterId ?? selectedRosterId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finalize roster.");
    } finally {
      setSaving(false);
    }
  }

  async function unpublish() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/${eventId}/final-roster`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to unpublish roster.");
      setFinalRosterId(null);
      setSelectedRosterId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unpublish roster.");
    } finally {
      setSaving(false);
    }
  }

  async function renameSelectedRoster() {
    const roster = rosters.find((item) => item.id === selectedRosterId);
    if (!roster) return;

    const name = window.prompt("Roster name", roster.name)?.trim();
    if (!name || name === roster.name) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/${eventId}/rosters/${roster.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to rename roster.");
      setRosters((current) =>
        current.map((item) => (item.id === roster.id ? { ...item, name: result.roster.name } : item))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename roster.");
    } finally {
      setSaving(false);
    }
  }

  if (!mount) return null;

  const selectedRoster = rosters.find((roster) => roster.id === selectedRosterId);
  const finalRoster = rosters.find((roster) => roster.id === finalRosterId);

  return createPortal(
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-4">
      <span className="text-xs font-medium uppercase tracking-wider text-zinc-600">
        Published roster
      </span>

      <select
        value={selectedRosterId}
        onChange={(event) => setSelectedRosterId(event.target.value)}
        disabled={saving || rosters.length === 0}
        className="min-w-52 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500 disabled:opacity-50"
      >
        <option value="">None</option>
        {rosters.map((roster) => (
          <option key={roster.id} value={roster.id}>
            {roster.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={renameSelectedRoster}
        disabled={saving || !selectedRoster}
        className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:border-zinc-500 hover:text-white disabled:opacity-40"
      >
        Rename
      </button>

      <button
        type="button"
        onClick={finalize}
        disabled={saving || !selectedRosterId || rosters.length === 0}
        className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-black transition hover:bg-zinc-200 disabled:opacity-40"
      >
        {saving ? "Saving..." : finalRosterId === selectedRosterId ? "Published" : "Set Final"}
      </button>

      {finalRosterId && (
        <button
          type="button"
          onClick={unpublish}
          disabled={saving}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:border-zinc-500 hover:text-white disabled:opacity-40"
        >
          Unpublish
        </button>
      )}

      {finalRoster && (
        <span className="text-xs text-emerald-500">{finalRoster.name} is visible to members</span>
      )}

      {error && <span className="basis-full text-xs text-red-400">{error}</span>}
    </div>,
    mount
  );
}
