"use client";

import { useState } from "react";

type Leave = {
  id: string;
  date: string;
  reason: string | null;
};

export default function LeaveApplicationClient({
  memberId,
  initialLeaves,
}: {
  memberId: string;
  initialLeaves: Leave[];
}) {
  const [leaves, setLeaves] = useState(initialLeaves);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!date) {
      setError("Please select a leave date.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/guild/members/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, date, reason: reason.trim() || null }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to apply leave.");
      }

      setLeaves((current) => [...current, data.leave].sort((a, b) => a.date.localeCompare(b.date)));
      setDate("");
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply leave.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this leave date?")) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/guild/members/leave?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to remove leave.");
      }

      setLeaves((current) => current.filter((leave) => leave.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove leave.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="font-semibold">New leave date</h2>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm text-zinc-400">Date</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-400"
            />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-400">Reason (optional)</span>
            <input
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. unavailable for guild event"
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-700 focus:border-zinc-400"
            />
          </label>
          {error && <p className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Apply Leave"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="font-semibold">Upcoming leave</h2>
        {leaves.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No upcoming leave dates.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {leaves.map((leave) => (
              <div key={leave.id} className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(leave.date))}
                  </p>
                  {leave.reason && <p className="mt-1 text-xs text-zinc-500">{leave.reason}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => remove(leave.id)}
                  disabled={saving}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
