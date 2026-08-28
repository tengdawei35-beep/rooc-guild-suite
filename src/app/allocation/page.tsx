"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type EventOption = {
  id: string;
  type: "GUILD_LEAGUE" | "EMPERIUM_OVERRUN";
  date: string;
};

type Assignment = {
  memberId: string;
  memberName: string;
  resourceId: string;
  resourceName: string;
  reservedQuantity: number;
  assignedQuantity: number;
};

type ResourceResult = {
  resourceId: string;
  resourceName: string;
  type: "FEATHER" | "CARD";
  total: number;
  reserved: number;
  allocated: number;
  overflow: number;
  selectedMembers: {
    id: string;
    characterName: string;
  }[];
  assignments: Assignment[];
};

type AllocationResult = {
  guildId: string;
  guildName: string;
  nonReservedMemberCount: number;
  resources: ResourceResult[];
};

type AllocationRun = {
  id: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
};

export default function AllocationPage() {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState("");

  const [eventsLoading, setEventsLoading] =
    useState(true);

  const [memberCount, setMemberCount] =
    useState("");

  const [preview, setPreview] =
    useState<AllocationResult | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [running, setRunning] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<AllocationRun | null>(null);

  // ==========================================================
  // LOAD EVENTS
  // ==========================================================

  useEffect(() => {
    async function loadEvents() {
      setEventsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          "/api/events",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ??
              "Failed to load events."
          );
        }

        const loadedEvents =
          Array.isArray(data.events)
            ? data.events
            : [];

        setEvents(loadedEvents);

        // Select the most recent event by default.
        if (
          loadedEvents.length > 0
        ) {
          setEventId(
            loadedEvents[0].id
          );
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load events."
        );
      } finally {
        setEventsLoading(false);
      }
    }

    loadEvents();
  }, []);

  // ==========================================================
  // EVENT CHANGE
  // ==========================================================

  function handleEventChange(
    value: string
  ) {
    setEventId(value);

    // A preview belongs to a specific event.
    // Changing event invalidates the old preview.
    setPreview(null);
    setSuccess(null);
    setError(null);
  }

  // ==========================================================
  // PREVIEW
  // ==========================================================

  async function handlePreview() {
    setError(null);
    setSuccess(null);
    setPreview(null);

    if (!eventId) {
      setError(
        "Select an event before generating an allocation preview."
      );
      return;
    }

    const count = Number(memberCount);

    if (
      !Number.isInteger(count) ||
      count < 0
    ) {
      setError(
        "Enter a valid number of non-reserved members."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/allocation/preview",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            eventId,
            nonReservedMemberCount:
              count,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Failed to build allocation preview."
        );
      }

      setPreview(data.preview);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to build allocation preview."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================
  // RUN ALLOCATION
  // ==========================================================

  async function handleRunAllocation() {
    setError(null);
    setSuccess(null);

    if (!eventId) {
      setError(
        "Select an event before running the allocation."
      );
      return;
    }

    const count = Number(memberCount);

    if (
      !Number.isInteger(count) ||
      count < 0
    ) {
      setError(
        "Enter a valid number of non-reserved members."
      );
      return;
    }

    if (!preview) {
      setError(
        "Generate an allocation preview before running the allocation."
      );
      return;
    }

    const confirmed =
      window.confirm(
        "Run this allocation?\n\nThe allocation will be permanently recorded and rotation states will be advanced."
      );

    if (!confirmed) {
      return;
    }

    setRunning(true);

    try {
      const response = await fetch(
        "/api/allocation/run",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            eventId,
            nonReservedMemberCount:
              count,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Failed to run allocation."
        );
      }

      setSuccess(
        data.allocationRun
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to run allocation."
      );
    } finally {
      setRunning(false);
    }
  }

  const selectedEvent =
    events.find(
      (event) => event.id === eventId
    );

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-white"
        >
          ← Dashboard
        </Link>

        <header className="mt-6 mb-8">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
            ROO Guild Suite
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Allocation
          </h1>

          <p className="mt-2 text-zinc-400">
            Preview the next resource allocation before
            committing it.
          </p>
        </header>

        {/* =====================================================
            CONFIGURATION
        ===================================================== */}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold">
            Allocation Settings
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            Select the event this allocation is being
            generated for.
          </p>

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {/* EVENT */}

            <div>
              <label
                htmlFor="event"
                className="block text-sm font-medium text-zinc-300"
              >
                Event
              </label>

              <select
                id="event"
                value={eventId}
                onChange={(event) =>
                  handleEventChange(
                    event.target.value
                  )
                }
                disabled={
                  eventsLoading ||
                  loading ||
                  running
                }
                className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">
                  {eventsLoading
                    ? "Loading events..."
                    : events.length === 0
                      ? "No events available"
                      : "Select an event"}
                </option>

                {events.map((event) => (
                  <option
                    key={event.id}
                    value={event.id}
                  >
                    {formatEventType(
                      event.type
                    )}{" "}
                    —{" "}
                    {formatEventDate(
                      event.date
                    )}
                  </option>
                ))}
              </select>

              {selectedEvent && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                    {formatEventType(
                      selectedEvent.type
                    )}
                  </span>

                  <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
                    {formatEventDate(
                      selectedEvent.date
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* MEMBER COUNT */}

            <div>
              <label
                htmlFor="memberCount"
                className="block text-sm font-medium text-zinc-300"
              >
                Non-reserved members
              </label>

              <input
                id="memberCount"
                type="number"
                min={0}
                value={memberCount}
                onChange={(event) => {
                  setMemberCount(
                    event.target.value
                  );

                  setPreview(null);
                  setSuccess(null);
                }}
                placeholder="e.g. 10"
                disabled={
                  loading || running
                }
                className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
              />

              <p className="mt-2 text-xs text-zinc-600">
                Members on leave for the selected event
                date will automatically be excluded.
              </p>
            </div>

            {/* PREVIEW BUTTON */}

            <div className="flex items-end">
              <button
                type="button"
                onClick={handlePreview}
                disabled={
                  loading ||
                  running ||
                  eventsLoading ||
                  !eventId
                }
                className="w-full rounded-lg bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Calculating..."
                  : "Preview Allocation"}
              </button>
            </div>
          </div>

          {selectedEvent && (
            <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">
                Allocation Event
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="font-semibold">
                  {formatEventType(
                    selectedEvent.type
                  )}
                </span>

                <span className="text-zinc-700">
                  •
                </span>

                <span className="text-sm text-zinc-400">
                  {formatEventDate(
                    selectedEvent.date
                  )}
                </span>
              </div>

              <p className="mt-2 text-xs text-zinc-600">
                Leave availability will be evaluated
                against this event date.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-5 rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-4">
              <p className="font-medium text-emerald-400">
                Allocation completed successfully.
              </p>

              <p className="mt-1 text-sm text-emerald-500/80">
                Run ID: {success.id}
              </p>
            </div>
          )}
        </section>

        {/* =====================================================
            RESULTS
        ===================================================== */}

        {preview && (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-3">
              <SummaryCard
                label="Resources"
                value={
                  preview.resources.length
                }
              />

              <SummaryCard
                label="Participants"
                value={
                  preview.nonReservedMemberCount
                }
              />

              <SummaryCard
                label="Overflow"
                value={preview.resources.reduce(
                  (sum, resource) =>
                    sum + resource.overflow,
                  0
                )}
              />
            </section>

            <section className="mt-8">
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    Allocation Preview
                  </h2>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    {selectedEvent && (
                      <>
                        <span className="text-zinc-300">
                          {formatEventType(
                            selectedEvent.type
                          )}
                        </span>

                        <span className="text-zinc-700">
                          •
                        </span>

                        <span className="text-zinc-500">
                          {formatEventDate(
                            selectedEvent.date
                          )}
                        </span>

                        <span className="text-zinc-700">
                          •
                        </span>
                      </>
                    )}

                    <span className="text-zinc-500">
                      {preview.guildName}
                    </span>
                  </div>
                </div>

                <span className="w-fit rounded-full border border-amber-900 bg-amber-950/40 px-3 py-1 text-xs text-amber-400">
                  Preview Only
                </span>
              </div>

              <div className="space-y-4">
                {preview.resources.map(
                  (resource) => (
                    <ResourceCard
                      key={
                        resource.resourceId
                      }
                      resource={resource}
                    />
                  )
                )}
              </div>

              {/* RUN ALLOCATION */}

              <div className="mt-6 flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-semibold">
                    Ready to run?
                  </h3>

                  <p className="mt-1 text-sm text-zinc-500">
                    This will permanently record the
                    allocation for{" "}
                    {selectedEvent
                      ? formatEventType(
                          selectedEvent.type
                        )
                      : "this event"}{" "}
                    and advance resource rotation.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    handleRunAllocation
                  }
                  disabled={
                    loading ||
                    running ||
                    success !== null
                  }
                  className="rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {running
                    ? "Running Allocation..."
                    : success
                      ? "Allocation Completed"
                      : "Run Allocation"}
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

// =============================================================
// HELPERS
// =============================================================

function formatEventType(
  type: EventOption["type"]
) {
  if (type === "GUILD_LEAGUE") {
    return "Guild League";
  }

  return "Emperium Overrun";
}

function formatEventDate(
  value: string
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(
    undefined,
    {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );
}

// =============================================================
// SUMMARY CARD
// =============================================================

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <p className="text-sm text-zinc-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold">
        {value}
      </p>
    </div>
  );
}

// =============================================================
// RESOURCE CARD
// =============================================================

function ResourceCard({
  resource,
}: {
  resource: ResourceResult;
}) {
  const normalAssignments =
    resource.assignments.filter(
      (assignment) =>
        assignment.assignedQuantity > 0
    );

  const reservations =
    resource.assignments.filter(
      (assignment) =>
        assignment.reservedQuantity > 0
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      {/* RESOURCE HEADER */}

      <div className="border-b border-zinc-800 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold">
                {resource.resourceName}
              </h3>

              <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
                {resource.type ===
                "FEATHER"
                  ? "Feather"
                  : "Card"}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-6 text-sm">
              <Stat
                label="Total"
                value={resource.total}
              />

              <Stat
                label="Reserved"
                value={resource.reserved}
              />

              <Stat
                label="Allocated"
                value={resource.allocated}
              />

              <Stat
                label="Overflow"
                value={resource.overflow}
              />
            </div>
          </div>
        </div>
      </div>

      {/* SELECTED MEMBERS */}

      <div className="border-b border-zinc-800 p-6">
        <h4 className="text-sm font-medium text-zinc-300">
          Normal Allocation Participants
        </h4>

        {resource.selectedMembers.length ===
        0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            No non-reserved members selected.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {resource.selectedMembers.map(
              (member) => (
                <span
                  key={member.id}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                >
                  {member.characterName}
                </span>
              )
            )}
          </div>
        )}
      </div>

      {/* RESERVATIONS */}

      {reservations.length > 0 && (
        <div className="border-b border-zinc-800 p-6">
          <h4 className="text-sm font-medium text-zinc-300">
            Reservations
          </h4>

          <div className="mt-3 space-y-2">
            {reservations.map(
              (assignment) => (
                <AssignmentRow
                  key={`${assignment.memberId}-reserved`}
                  name={
                    assignment.memberName
                  }
                  quantity={
                    assignment.reservedQuantity
                  }
                  type="Reserved"
                />
              )
            )}
          </div>
        </div>
      )}

      {/* NORMAL ALLOCATIONS */}

      <div className="p-6">
        <h4 className="text-sm font-medium text-zinc-300">
          Allocations
        </h4>

        {normalAssignments.length ===
        0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            No normal allocations.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {normalAssignments.map(
              (assignment) => (
                <AssignmentRow
                  key={`${assignment.memberId}-assigned`}
                  name={
                    assignment.memberName
                  }
                  quantity={
                    assignment.assignedQuantity
                  }
                  type="Allocated"
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================
// ASSIGNMENT ROW
// =============================================================

function AssignmentRow({
  name,
  quantity,
  type,
}: {
  name: string;
  quantity: number;
  type: "Reserved" | "Allocated";
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
      <span className="text-sm">
        {name}
      </span>

      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500">
          {type}
        </span>

        <span className="font-semibold">
          ×{quantity}
        </span>
      </div>
    </div>
  );
}

// =============================================================
// STAT
// =============================================================

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <p className="text-zinc-500">
        {label}
      </p>

      <p className="mt-1 font-semibold">
        {value}
      </p>
    </div>
  );
}