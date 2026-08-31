"use client";

import { useEffect, useState } from "react";

type Roster = {
  id: string;
  name: string;
  generationMode: "MANUAL" | "AUTOMATIC";
  memberCount: number;
  partyCount: number;
};

type EventResponse = {
  event: {
    finalRosterId: string | null;
  };
  rosters: Roster[];
};

export default function FinalRosterControls({
  eventId,
}: {
  eventId: string;
}) {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [finalRosterId, setFinalRosterId] = useState<string | null>(null);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as EventResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to load rosters.");
      }

      setRosters(result.rosters);
      setFinalRosterId(result.event.finalRosterId);
      setSelectedRosterId(result.event.finalRosterId ?? "");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load roster status."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [eventId]);

  async function finalize() {
    if (!selectedRosterId) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/events/${eventId}/final-roster`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rosterId: selectedRosterId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to finalize roster.");
      }

      setFinalRosterId(result.finalRosterId ?? selectedRosterId);
      setSelectedRosterId(result.finalRosterId ?? selectedRosterId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to finalize roster."
      );
    } finally {
      setSaving(false);
    }
  }

  async function unpublish() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/events/${eventId}/final-roster`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to unpublish roster.");
      }

      setFinalRosterId(null);
      setSelectedRosterId("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to unpublish roster."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-sm text-zinc-500">Loading roster publication status...</p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">Final Roster</h2>
            <span
              className={`rounded-full px-2.5 py-1 text-xs ${
                finalRosterId
                  ? "bg-emerald-950 text-emerald-400"
                  : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {finalRosterId ? "Published" : "Not published"}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Select the roster that should be displayed to guild members. Preferred is the default starting arrangement; it is not published automatically.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={selectedRosterId}
            onChange={(event) => setSelectedRosterId(event.target.value)}
            disabled={saving || rosters.length === 0}
            className="min-w-64 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white outline-none focus:border-zinc-500 disabled:opacity-50"
          >
            <option value="">No final roster</option>
            {rosters.map((roster) => (
              <option key={roster.id} value={roster.id}>
                {roster.name} — {roster.memberCount} members / {roster.partyCount} parties
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={finalize}
            disabled={saving || !selectedRosterId || rosters.length === 0}
            className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving..." : "Finalize Roster"}
          </button>

          {finalRosterId && (
            <button
              type="button"
              onClick={unpublish}
              disabled={saving}
              className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:opacity-40"
            >
              Unpublish
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}

      {!finalRosterId && (
        <p className="mt-4 text-xs text-zinc-600">
          No roster is currently published. Guild members will not see a roster until one is finalized.
        </p>
      )}
    </section>
  );
}
