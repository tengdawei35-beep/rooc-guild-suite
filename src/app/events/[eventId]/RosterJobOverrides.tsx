"use client";

import { useEffect, useMemo, useState } from "react";

type Assignment = {
  rosterId: string;
  rosterName: string;
  rosterCreatedAt: string;
  partyId: string;
  partyNumber: number;
  battlefield: string;
  assignmentId: string;
  slotNumber: number;
  memberId: string;
  characterName: string | null;
  submittedJob: string | null;
  overrideJob: string | null;
};

export default function RosterJobOverrides({ eventId }: { eventId: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/${eventId}/roster-job-overrides`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to load roster jobs.");
      const next = result.assignments as Assignment[];
      setAssignments(next);
      setSelectedRosterId((current) => current || next[0]?.rosterId || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roster jobs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [eventId]);

  const rosters = useMemo(() => {
    const map = new Map<string, { id: string; name: string; createdAt: string }>();
    for (const assignment of assignments) {
      if (!map.has(assignment.rosterId)) {
        map.set(assignment.rosterId, {
          id: assignment.rosterId,
          name: assignment.rosterName,
          createdAt: assignment.rosterCreatedAt,
        });
      }
    }
    return Array.from(map.values());
  }, [assignments]);

  const selectedAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.rosterId === selectedRosterId),
    [assignments, selectedRosterId]
  );

  const jobOptions = useMemo(() => {
    const jobs = new Set<string>();
    for (const assignment of assignments) {
      if (assignment.submittedJob) jobs.add(assignment.submittedJob);
      if (assignment.overrideJob) jobs.add(assignment.overrideJob);
    }
    return Array.from(jobs).sort((a, b) => a.localeCompare(b));
  }, [assignments]);

  async function updateJob(assignment: Assignment, job: string) {
    setSavingId(assignment.assignmentId);
    setError(null);
    try {
      const response = await fetch(`/api/events/${eventId}/roster-job-overrides`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: assignment.assignmentId, job }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to update roster job.");

      setAssignments((current) =>
        current.map((item) =>
          item.assignmentId === assignment.assignmentId
            ? { ...item, overrideJob: result.overrideJob }
            : item
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update roster job.");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-sm text-zinc-500">Loading roster job assignments…</p>
      </section>
    );
  }

  if (rosters.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">Roster Jobs</p>
          <h2 className="mt-1 text-xl font-semibold">Assign jobs for this roster</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Override a player’s submitted job for this roster only. Their member profile is unchanged.
          </p>
        </div>
        <select
          value={selectedRosterId}
          onChange={(event) => setSelectedRosterId(event.target.value)}
          className="min-w-64 cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500"
        >
          {rosters.map((roster) => (
            <option key={roster.id} value={roster.id}>{roster.name}</option>
          ))}
        </select>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-3">Party</th>
              <th className="px-3 py-3">Player</th>
              <th className="px-3 py-3">Submitted</th>
              <th className="px-3 py-3">Roster Job</th>
            </tr>
          </thead>
          <tbody>
            {selectedAssignments.map((assignment) => {
              const value = assignment.overrideJob ?? assignment.submittedJob ?? "";
              return (
                <tr key={assignment.assignmentId} className="border-b border-zinc-900">
                  <td className="px-3 py-3 text-zinc-500">
                    {assignment.battlefield.replace("BATTLEFIELD_", "BF ")} · P{assignment.partyNumber} · S{assignment.slotNumber}
                  </td>
                  <td className="px-3 py-3 font-medium text-white">{assignment.characterName ?? "Unnamed"}</td>
                  <td className="px-3 py-3 text-zinc-400">{assignment.submittedJob ?? "—"}</td>
                  <td className="px-3 py-3">
                    <select
                      value={value}
                      disabled={savingId === assignment.assignmentId}
                      onChange={(event) => updateJob(assignment, event.target.value)}
                      className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition hover:border-zinc-500 focus:border-zinc-400 disabled:opacity-50"
                    >
                      <option value={assignment.submittedJob ?? ""}>
                        {assignment.submittedJob ? `${assignment.submittedJob} (default)` : "Use submitted job"}
                      </option>
                      {jobOptions
                        .filter((job) => job !== assignment.submittedJob)
                        .map((job) => (
                          <option key={job} value={job}>{job}</option>
                        ))}
                    </select>
                    {assignment.overrideJob && (
                      <button
                        type="button"
                        onClick={() => updateJob(assignment, "")}
                        disabled={savingId === assignment.assignmentId}
                        className="ml-2 text-xs text-zinc-500 underline decoration-zinc-700 underline-offset-2 hover:text-white disabled:opacity-50"
                      >
                        Reset
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </section>
  );
}
