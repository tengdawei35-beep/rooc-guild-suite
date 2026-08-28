"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

type EventType =
  | "GUILD_LEAGUE"
  | "EMPERIUM_OVERRUN";

type EventsView =
  | "events"
  | "rosters"
  | "preferred";

type EventItem = {
  id: string;
  guildId: string;
  type: EventType;
  date: string;
  participationCount: number;
  rosterCount: number;
  allocationRunCount: number;
};

type PreferredRoster = {
  id: string;
  guildId: string;
  type: EventType;
  partyCount: number;
  createdAt: string;
  updatedAt: string;
};

const EMPTY_FORM = {
  type: "GUILD_LEAGUE" as EventType,
  date: "",
};

export default function EventsClient({
  initialView = "events",
}: {
  initialView?: EventsView;
}) {
  const [events, setEvents] =
    useState<EventItem[]>([]);

  const [preferredRosters, setPreferredRosters] =
    useState<PreferredRoster[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [creating, setCreating] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<string | null>(null);

  const [form, setForm] =
    useState(EMPTY_FORM);

  const [view, setView] =
    useState<EventsView>(initialView);

  // ==========================================================
  // INITIAL VIEW
  // ==========================================================

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  // ==========================================================
  // LOAD EVENTS
  // ==========================================================

  async function loadEvents() {
    setLoading(true);
    setError(null);

    try {
      const response =
        await fetch("/api/events", {
          cache: "no-store",
        });

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Failed to load events."
        );
      }

      setEvents(
        Array.isArray(data.events)
          ? data.events
          : []
      );

      setPreferredRosters(
        Array.isArray(
          data.preferredRosters
        )
          ? data.preferredRosters
          : []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load events."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  // ==========================================================
  // CREATE EVENT
  // ==========================================================

  async function handleCreate(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setError(null);
    setSuccess(null);

    if (!form.date) {
      setError(
        "Select an event date."
      );
      return;
    }

    setCreating(true);

    try {
      const response =
        await fetch("/api/events", {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            type: form.type,
            date: form.date,
          }),
        });

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Failed to create event."
        );
      }

      setSuccess(
        `${formatEventType(
          form.type
        )} created successfully.`
      );

      setForm(EMPTY_FORM);

      await loadEvents();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create event."
      );
    } finally {
      setCreating(false);
    }
  }

  // ==========================================================
  // DATE GROUPS
  // ==========================================================

  const upcomingEvents =
    useMemo(() => {
      const now =
        new Date();

      now.setHours(
        0,
        0,
        0,
        0
      );

      return events
        .filter(
          (event) =>
            new Date(event.date) >=
            now
        )
        .sort(
          (a, b) =>
            new Date(
              a.date
            ).getTime() -
            new Date(
              b.date
            ).getTime()
        );
    }, [events]);

  const pastEvents =
    useMemo(() => {
      const now =
        new Date();

      now.setHours(
        0,
        0,
        0,
        0
      );

      return events
        .filter(
          (event) =>
            new Date(event.date) <
            now
        )
        .sort(
          (a, b) =>
            new Date(
              b.date
            ).getTime() -
            new Date(
              a.date
            ).getTime()
        );
    }, [events]);

  // ==========================================================
  // EVENTS WITH ROSTERS
  // ==========================================================

  const rosterUpcomingEvents =
    useMemo(
      () =>
        upcomingEvents.filter(
          (event) =>
            event.rosterCount > 0
        ),
      [upcomingEvents]
    );

  const rosterPastEvents =
    useMemo(
      () =>
        pastEvents.filter(
          (event) =>
            event.rosterCount > 0
        ),
      [pastEvents]
    );

  // ==========================================================
  // PAGE INFORMATION
  // ==========================================================

  const pageTitle =
    view === "events"
      ? "Events"
      : view === "rosters"
        ? "Rosters"
        : "Preferred Rosters";

  const pageDescription =
    view === "events"
      ? "Manage Guild League and Emperium Overrun events."
      : view === "rosters"
        ? "Select an event to view and manage its rosters."
        : "Manage the guild-wide preferred roster for each event type.";

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* ====================================================
            HEADER
        ==================================================== */}

        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/"
              className="text-sm text-zinc-500 transition hover:text-white"
            >
              ← Dashboard
            </Link>

            <p className="mt-6 text-sm font-medium uppercase tracking-widest text-zinc-500">
              ROO Guild Suite
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {pageTitle}
            </h1>

            <p className="mt-2 text-zinc-400">
              {pageDescription}
            </p>
          </div>
        </div>

        {/* ====================================================
            NAVIGATION
        ==================================================== */}

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/events"
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              view === "events"
                ? "border-white bg-white text-black"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"
            }`}
          >
            Events
          </Link>

          <Link
            href="/events?view=rosters"
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              view === "rosters"
                ? "border-white bg-white text-black"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"
            }`}
          >
            Rosters
          </Link>

          <Link
            href="/events?view=preferred"
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              view === "preferred"
                ? "border-white bg-white text-black"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"
            }`}
          >
            Preferred Rosters
          </Link>
        </div>

        {/* ====================================================
            EVENTS VIEW
        ==================================================== */}

        {view === "events" && (
          <>
            {/* ==================================================
                CREATE EVENT
            ================================================== */}

            <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div>
                <h2 className="text-lg font-semibold">
                  Create Event
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Create the event that will
                  be used for participation,
                  rosters and allocation.
                </p>
              </div>

              <form
                onSubmit={handleCreate}
                className="mt-6"
              >
                <div className="grid gap-5 lg:grid-cols-3">
                  {/* EVENT TYPE */}

                  <div>
                    <label
                      htmlFor="eventType"
                      className="block text-sm font-medium text-zinc-300"
                    >
                      Event Type
                    </label>

                    <select
                      id="eventType"
                      value={form.type}
                      onChange={(event) => {
                        setForm({
                          ...form,
                          type:
                            event.target
                              .value as EventType,
                        });

                        setError(null);
                        setSuccess(null);
                      }}
                      disabled={creating}
                      className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-zinc-400 disabled:opacity-50"
                    >
                      <option value="GUILD_LEAGUE">
                        Guild League
                      </option>

                      <option value="EMPERIUM_OVERRUN">
                        Emperium Overrun
                      </option>
                    </select>
                  </div>

                  {/* DATE */}

                  <div>
                    <label
                      htmlFor="eventDate"
                      className="block text-sm font-medium text-zinc-300"
                    >
                      Date
                    </label>

                    <input
                      id="eventDate"
                      type="date"
                      value={form.date}
                      onChange={(event) => {
                        setForm({
                          ...form,
                          date:
                            event.target
                              .value,
                        });

                        setError(null);
                        setSuccess(null);
                      }}
                      disabled={creating}
                      className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-zinc-400 disabled:opacity-50"
                    />

                    <p className="mt-2 text-xs text-zinc-600">
                      {getScheduleDescription(
                        form.type
                      )}
                    </p>
                  </div>

                  {/* CREATE */}

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={
                        creating ||
                        !form.date
                      }
                      className="w-full rounded-lg bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {creating
                        ? "Creating..."
                        : "Create Event"}
                    </button>
                  </div>
                </div>

                {/* EVENT RULES */}

                <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                  <EventRules
                    type={form.type}
                  />
                </div>
              </form>

              {error && (
                <div className="mt-5 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              {success && (
                <div className="mt-5 rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-400">
                  {success}
                </div>
              )}
            </section>

            {/* ==================================================
                UPCOMING EVENTS
            ================================================== */}

            <EventSection
              title="Upcoming Events"
              description="Events available for participation, rosters and allocation."
              events={upcomingEvents}
              loading={loading}
              onRefresh={loadEvents}
            />

            {/* ==================================================
                PAST EVENTS
            ================================================== */}

            <section className="mt-12">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">
                  Past Events
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Historical event activity.
                </p>
              </div>

              {pastEvents.length ===
              0 ? (
                <EmptyState text="No past events." />
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {pastEvents.map(
                    (event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        past
                      />
                    )
                  )}
                </div>
              )}
            </section>
          </>
        )}

        {/* ====================================================
            ROSTERS VIEW
        ==================================================== */}

        {view === "rosters" && (
          <>
            <EventSection
              title="Upcoming Events with Rosters"
              description="Select an event to view and edit its generated or manually managed rosters."
              events={
                rosterUpcomingEvents
              }
              loading={loading}
              onRefresh={loadEvents}
              emptyText="No upcoming events have rosters yet."
              rosterView
            />

            <section className="mt-12">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">
                  Past Events with Rosters
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Historical rosters and party
                  arrangements.
                </p>
              </div>

              {rosterPastEvents.length ===
              0 ? (
                <EmptyState text="No past events have rosters." />
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {rosterPastEvents.map(
                    (event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        past
                        rosterView
                      />
                    )
                  )}
                </div>
              )}
            </section>

            <section className="mt-12 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 p-6">
              <h2 className="text-base font-semibold">
                Need to create a roster?
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Open an event from the Events
                page and generate or create a
                roster there.
              </p>

              <Link
                href="/events"
                className="mt-4 inline-flex rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
              >
                Browse Events
              </Link>
            </section>
          </>
        )}

        {/* ====================================================
            PREFERRED ROSTERS VIEW
        ==================================================== */}

        {view === "preferred" && (
          <>
            <section className="mt-8">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">
                  Preferred Rosters
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Guild-wide preferred party
                  arrangements by event type.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <PreferredRosterCard
                  type="GUILD_LEAGUE"
                  preferredRoster={
                    preferredRosters.find(
                      (roster) =>
                        roster.type ===
                        "GUILD_LEAGUE"
                    ) ?? null
                  }
                  events={events}
                />

                <PreferredRosterCard
                  type="EMPERIUM_OVERRUN"
                  preferredRoster={
                    preferredRosters.find(
                      (roster) =>
                        roster.type ===
                        "EMPERIUM_OVERRUN"
                    ) ?? null
                  }
                  events={events}
                />
              </div>
            </section>

            <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-lg font-semibold">
                How Preferred Rosters Work
              </h2>

              <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-400">
                <p>
                  A preferred roster is saved
                  at the guild level for each
                  event type.
                </p>

                <p>
                  It can be used as the starting
                  arrangement when preparing a
                  future event roster.
                </p>

                <p className="text-zinc-500">
                  Open an event to create or
                  update its preferred roster.
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

// =============================================================
// EVENT SECTION
// =============================================================

function EventSection({
  title,
  description,
  events,
  loading,
  onRefresh,
  emptyText,
  rosterView = false,
  preferredView = false,
}: {
  title: string;
  description: string;
  events: EventItem[];
  loading: boolean;
  onRefresh: () => void;
  emptyText?: string;
  rosterView?: boolean;
  preferredView?: boolean;
}) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">
            {title}
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            {description}
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="shrink-0 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:opacity-50"
        >
          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      {loading ? (
        <EmptyState text="Loading events..." />
      ) : events.length === 0 ? (
        <EmptyState
          text={
            emptyText ??
            "No events found."
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              rosterView={
                rosterView
              }
              preferredView={
                preferredView
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

// =============================================================
// EVENT CARD
// =============================================================

function EventCard({
  event,
  past = false,
  rosterView = false,
  preferredView = false,
}: {
  event: EventItem;
  past?: boolean;
  rosterView?: boolean;
  preferredView?: boolean;
}) {
  const actionText =
    preferredView
      ? "Open preferred roster →"
      : rosterView
        ? "Open rosters →"
        : "Open event →";

  return (
    <Link
      href={`/events/${event.id}`}
      className="group block rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-zinc-600 hover:bg-zinc-900/80"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-400">
            {formatEventType(
              event.type
            )}
          </span>

          <h3 className="mt-4 text-lg font-semibold transition group-hover:text-zinc-300">
            {formatEventDate(
              event.date
            )}
          </h3>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs ${
            past
              ? "bg-zinc-800 text-zinc-500"
              : "bg-emerald-950 text-emerald-400"
          }`}
        >
          {past
            ? "Completed"
            : "Upcoming"}
        </span>
      </div>

      <div className="mt-6">
        <EventRules
          type={event.type}
          compact
        />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 border-t border-zinc-800 pt-5">
        <Metric
          label="Participants"
          value={
            event.participationCount
          }
        />

        <Metric
          label="Rosters"
          value={
            event.rosterCount
          }
        />

        <Metric
          label="Allocations"
          value={
            event.allocationRunCount
          }
        />
      </div>

      <div className="mt-5 text-sm text-zinc-600 transition group-hover:text-zinc-400">
        {actionText}
      </div>
    </Link>
  );
}

// =============================================================
// PREFERRED ROSTER CARD
// =============================================================

function PreferredRosterCard({
  type,
  preferredRoster,
  events,
}: {
  type: EventType;
  preferredRoster:
    | PreferredRoster
    | null;
  events: EventItem[];
}) {
  const latestEvent =
    events.find(
      (event) =>
        event.type === type
    );

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-400">
            {formatEventType(
              type
            )}
          </span>

          <h3 className="mt-4 text-lg font-semibold">
            Preferred Roster
          </h3>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            preferredRoster
              ? "bg-emerald-950 text-emerald-400"
              : "bg-zinc-800 text-zinc-500"
          }`}
        >
          {preferredRoster
            ? "Configured"
            : "Not configured"}
        </span>
      </div>

      {preferredRoster ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-600">
                Parties
              </p>

              <p className="mt-1 text-lg font-semibold text-zinc-200">
                {
                  preferredRoster.partyCount
                }
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-600">
                Last Updated
              </p>

              <p className="mt-1 text-sm font-medium text-zinc-300">
                {formatShortDate(
                  preferredRoster.updatedAt
                )}
              </p>
            </div>
          </div>

          <p className="mt-5 text-sm text-zinc-500">
            This preferred roster is available
            for {formatEventType(type)} events.
          </p>

          {latestEvent && (
            <Link
              href={`/events/${latestEvent.id}`}
              className="mt-6 inline-flex rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
            >
              Open Event →
            </Link>
          )}
        </>
      ) : (
        <div className="mt-6">
          <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-950 p-4">
            <p className="text-sm text-zinc-500">
              No preferred roster has been
              configured for this event type.
            </p>
          </div>

          {latestEvent && (
            <Link
              href={`/events/${latestEvent.id}`}
              className="mt-4 inline-flex rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
            >
              Open Event →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================
// EVENT RULES
// =============================================================

function EventRules({
  type,
  compact = false,
}: {
  type: EventType;
  compact?: boolean;
}) {
  if (
    type ===
    "GUILD_LEAGUE"
  ) {
    return (
      <div
        className={
          compact
            ? "space-y-2 text-sm"
            : "grid gap-3 sm:grid-cols-4"
        }
      >
        <Rule
          label="Schedule"
          value="Tue / Thu"
        />

        <Rule
          label="Battlefields"
          value="2"
        />

        <Rule
          label="Players"
          value="40 / field"
        />

        <Rule
          label="Parties"
          value="8 / field"
        />
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? "space-y-2 text-sm"
          : "grid gap-3 sm:grid-cols-4"
      }
    >
      <Rule
        label="Schedule"
        value="Sunday"
      />

      <Rule
        label="Players"
        value="80"
      />

      <Rule
        label="Parties"
        value="16"
      />

      <Rule
        label="Party Size"
        value="5"
      />
    </div>
  );
}

// =============================================================
// RULE
// =============================================================

function Rule({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-zinc-600">
        {label}
      </p>

      <p className="mt-1 font-medium text-zinc-300">
        {value}
      </p>
    </div>
  );
}

// =============================================================
// METRIC
// =============================================================

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-600">
        {label}
      </p>

      <p className="mt-1 font-semibold text-zinc-200">
        {value}
      </p>
    </div>
  );
}

// =============================================================
// EMPTY STATE
// =============================================================

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 px-6 py-12 text-center text-sm text-zinc-600">
      {text}
    </div>
  );
}

// =============================================================
// HELPERS
// =============================================================

function formatEventType(
  type: EventType
) {
  return type ===
    "GUILD_LEAGUE"
    ? "Guild League"
    : "Emperium Overrun";
}

function formatEventDate(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Asia/Bangkok",

      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function formatShortDate(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone:
        "Asia/Bangkok",
    }
  ).format(date);
}

function getScheduleDescription(
  type: EventType
) {
  return type ===
    "GUILD_LEAGUE"
    ? "Guild League is held every Tuesday and Thursday."
    : "Emperium Overrun is held every Sunday.";
}