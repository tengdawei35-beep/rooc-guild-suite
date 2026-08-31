"use client";

import { useEffect, useMemo, useState } from "react";
import { JOBS } from "@/lib/constants/jobs";

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

export default function RosterJobOverrides({
  eventId,
}: {
  eventId: string;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/events/${eventId}/roster-job-overrides`,
        {
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "Failed to load roster jobs."
        );
      }

      const next = result.assignments as Assignment[];

      setAssignments(next);
      setSelectedRosterId((current) => {
        if (current && next.some((item) => item.rosterId === current)) {
          return current;
        }

        return next[0]?.rosterId ?? "";
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load roster jobs."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [eventId]);

  const rosters = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        createdAt: string;
      }
    >();

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
    () =>
      assignments
        .filter(
          (assignment) => assignment.rosterId === selectedRosterId
        )
        .sort((a, b) => {
          if (a.battlefield !== b.battlefield) {
            return a.battlefield.localeCompare(b.battlefield);
          }

          if (a.partyNumber !== b.partyNumber) {
            return a.partyNumber - b.partyNumber;
          }

          return a.slotNumber - b.slotNumber;
        }),
    [assignments, selectedRosterId]
  );

  async function updateJob(
    assignment: Assignment,
    job: string
  ) {
    setSavingId(assignment.assignmentId);
    setError(null);

    try {
      const response = await fetch(
        `/api/events/${eventId}/roster-job-overrides`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assignmentId: assignment.assignmentId,
            job,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "Failed to update roster job."
        );
      }

      setAssignments((current) =>
        current.map((item) =>
          item.assignmentId === assignment.assignmentId
            ? {
                ...item,
                overrideJob: result.overrideJob,
              }
            : item
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update roster job."
      );
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-sm text-zinc-500">
          Loading roster jobs…
        </p>
      </section>
    );
  }

  if (rosters.length === 0) {
    return null;
  }

  return (
    <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">
              Roster Jobs
            </p>

            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Optional
            </span>
          </div>

          <p className="mt-1 text-xs text-zinc-500">
            Assign a different job for this roster only.
          </p>
        </div>

        <select
          value={selectedRosterId}
          onChange={(event) =>
            setSelectedRosterId(event.target.value)
          }
          className="w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition hover:border-zinc-500 focus:border-zinc-400 sm:w-auto sm:min-w-56"
        >
          {rosters.map((roster) => (
            <option key={roster.id} value={roster.id}>
              {roster.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-950/50">
        {selectedAssignments.map((assignment) => {
          const displayedJob =
            assignment.overrideJob ??
            assignment.submittedJob ??
            "";

          const hasOverride = Boolean(assignment.overrideJob);
          const isSaving =
            savingId === assignment.assignmentId;

          return (
            <div
              key={assignment.assignmentId}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-white">
                    {assignment.characterName ?? "Unnamed"}
                  </p>

                  {hasOverride && (
                    <span className="shrink-0 rounded-full border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-zinc-400">
                      Override
                    </span>
                  )}
                </div>

                <p className="mt-0.5 text-[11px] text-zinc-600">
                  {assignment.battlefield.replace(
                    "BATTLEFIELD_",
                    "BF "
                  )}{" "}
                  · P{assignment.partyNumber} · S
                  {assignment.slotNumber}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={displayedJob}
                  disabled={isSaving}
                  onChange={(event) =>
                    updateJob(
                      assignment,
                      event.target.value
                    )
                  }
                  className="w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-white outline-none transition hover:border-zinc-500 focus:border-zinc-400 disabled:cursor-wait disabled:opacity-50 sm:w-52"
                >
                  {!assignment.submittedJob && (
                    <option value="">
                      Select job…
                    </option>
                  )}

                  {JOBS.map((job) => (
                    <option key={job} value={job}>
                      {job}
                    </option>
                  ))}
                </select>

                {hasOverride && (
                  <button
                    type="button"
                    onClick={() =>
                      updateJob(assignment, "")
                    }
                    disabled={isSaving}
                    title="Restore submitted job"
                    className="shrink-0 cursor-pointer rounded-lg border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-white disabled:cursor-wait disabled:opacity-50"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {selectedAssignments.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-zinc-500">
            No players assigned to this roster.
          </p>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2">
          <p className="text-xs text-red-400">
            {error}
          </p>

          <button
            type="button"
            onClick={() => load()}
            className="shrink-0 cursor-pointer text-xs text-zinc-400 underline underline-offset-2 hover:text-white"
          >
            Retry
          </button>
        </div>
      )}
    </section>
  );
}