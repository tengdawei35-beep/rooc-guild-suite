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
        value={overrideJob ?? submittedJob ?? ""}
        disabled={saving}
        onChange={(event) => updateJob(event.target.value)}
        title={
          overrideJob
            ? "Roster-specific job override"
            : "Change job for this roster only"
        }
        style={{ colorScheme: "dark" }}
        className={`min-w-0 max-w-full cursor-pointer appearance-auto rounded border px-2 py-1 text-xs outline-none transition disabled:cursor-wait disabled:opacity-50 ${
          overrideJob
            ? "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600 focus:border-zinc-500"
            : "border-transparent bg-zinc-900 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400 focus:border-zinc-600"
        }`}
      >
        <option value="">
          {submittedJob
            ? `${submittedJob} (default)`
            : "Unknown Job"}
        </option>

        {JOBS.filter(
          (job) => job !== submittedJob
        ).map((job) => (
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