"use client";

import { useState } from "react";
import { JOBS } from "@/lib/constants/jobs";

type Props = {
  eventId: string;
  assignmentId: string;
  submittedJob: string | null;
  overrideJob: string | null;
  canEdit: boolean;
  onSaved: (assignmentId: string, overrideJob: string | null) => void;
};

export default function RosterJobOverrides({
  eventId,
  assignmentId,
  submittedJob,
  overrideJob,
  canEdit,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);

  const effectiveJob = overrideJob ?? submittedJob ?? "Unknown Job";

  async function updateJob(job: string) {
    if (!canEdit || saving) return;

    setSaving(true);

    try {
      const response = await fetch(
        `/api/events/${eventId}/roster-job-overrides`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assignmentId,
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

      onSaved(
        assignmentId,
        result.overrideJob ?? null
      );
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Failed to update roster job."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return (
      <p className="truncate text-xs text-zinc-600">
        {effectiveJob}
      </p>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <select
        value={overrideJob ?? ""}
        disabled={saving}
        onChange={(event) => updateJob(event.target.value)}
        title={
          overrideJob
            ? "Roster-specific job override"
            : "Change job for this roster only"
        }
        style={{ colorScheme: "dark" }}
        className={`min-w-0 max-w-full cursor-pointer appearance-auto rounded border bg-zinc-950 px-1 py-0.5 text-xs outline-none transition hover:border-zinc-600 focus:border-zinc-500 disabled:cursor-wait disabled:opacity-50 ${
          overrideJob
            ? "border-zinc-700 text-zinc-300"
            : "border-transparent text-zinc-600 hover:text-zinc-400"
        }`}
      >
        <option value="">
          {submittedJob
            ? `${submittedJob} (default)`
            : "Unknown Job"}
        </option>

        {JOBS.map((job) => (
          <option key={job} value={job}>
            {job}
          </option>
        ))}
      </select>

      {overrideJob && (
        <span
          className="shrink-0 text-[9px] uppercase tracking-wider text-zinc-600"
          title="This job is overridden for this roster only."
        >
          override
        </span>
      )}
    </div>
  );
}
