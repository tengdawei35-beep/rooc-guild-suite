import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageAuth } from "@/lib/auth";

export default async function Home() {
  await requirePageAuth();

  const guild = await prisma.guild.findFirst({
    include: {
      members: {
        where: {
          active: true,
        },
      },

      resources: {
        where: {
          active: true,
        },
      },

      reservedAllocations: true,

      allocationRuns: true,

      events: {
        orderBy: {
          date: "desc",
        },

        take: 5,

        include: {
          rosters: true,
        },
      },
    },
  });

  const memberCount =
    guild?.members.length ?? 0;

  const resourceCount =
    guild?.resources.length ?? 0;

  const reservationCount =
    guild?.reservedAllocations.length ?? 0;

  const allocationRunCount =
    guild?.allocationRuns.length ?? 0;

  const eventCount =
    guild?.events.length ?? 0;

  const rosterCount =
    guild?.events.reduce(
      (total, event) =>
        total + event.rosters.length,
      0
    ) ?? 0;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* =====================================================
            HEADER
        ===================================================== */}

        <header className="mb-10">
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-zinc-500">
            ROO Guild Suite
          </p>

          <h1 className="text-4xl font-bold tracking-tight">
            Guild Dashboard
          </h1>

          <p className="mt-2 text-zinc-400">
            Manage your guild, events, rosters,
            resources and allocations.
          </p>
        </header>

        {/* =====================================================
            NO GUILD
        ===================================================== */}

        {!guild ? (
          <section className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
            <h2 className="text-xl font-semibold">
              No guild configured
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              Your ROO Guild Suite database is
              connected, but no guild has been
              created yet.
            </p>

            <Link
              href="/guild"
              className="mt-6 inline-flex rounded-lg bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200"
            >
              Configure Guild
            </Link>
          </section>
        ) : (
          <>
            {/* =================================================
                GUILD INFORMATION
            ================================================= */}

            <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-sm text-zinc-500">
                Guild
              </p>

              <h2 className="mt-1 text-2xl font-semibold">
                {guild.name}
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Discord Guild ID:{" "}
                {guild.discordGuildId}
              </p>
            </section>

            {/* =================================================
                STATISTICS
            ================================================= */}

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <StatCard
                label="Active Members"
                value={memberCount}
              />

              <StatCard
                label="Active Resources"
                value={resourceCount}
              />

              <StatCard
                label="Reservations"
                value={reservationCount}
              />

              <StatCard
                label="Allocation Runs"
                value={allocationRunCount}
              />

              <StatCard
                label="Events"
                value={eventCount}
              />

              <StatCard
                label="Rosters"
                value={rosterCount}
              />
            </section>

            {/* =================================================
                EVENTS & ROSTERS
            ================================================= */}

            <section className="mt-10">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    Events & Rosters
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    Manage events, generate rosters
                    and organize parties.
                  </p>
                </div>

                <Link
                  href="/events"
                  className="text-sm font-medium text-zinc-400 hover:text-white"
                >
                  View all →
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* EVENTS */}

                <DashboardCard
                  href="/events"
                  title="Events"
                  description="Create and manage Guild League and Emperium Overrun events."
                  featured
                />

                {/* ROSTERS */}

                <DashboardCard
                  href="/events?view=rosters"
                  title="Rosters"
                  description="View events with rosters, generate automatic rosters and manage party assignments."
                />

                {/* PREFERRED ROSTERS */}

                <DashboardCard
                  href="/events?view=preferred"
                  title="Preferred Rosters"
                  description="Manage preferred roster arrangements used as the starting point for future events."
                />
              </div>
            </section>

            {/* =================================================
                GUILD MANAGEMENT
            ================================================= */}

            <section className="mt-10">
              <h2 className="mb-4 text-lg font-semibold">
                Guild Management
              </h2>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <DashboardCard
                  href="/guild/members"
                  title="Members"
                  description="Manage guild members, eligibility, priority and character information."
                />

                <DashboardCard
                  href="/guild/rankings"
                  title="Guild Rankings"
                  description="Compare overall, DPS, Tank and PvP performance across the guild."
                  featured
                />

                <DashboardCard
                  href="/guild/resources"
                  title="Resources"
                  description="Manage feathers, cards and resource limits."
                />

                <DashboardCard
                  href="/guild/reservations"
                  title="Reservations"
                  description="Manage reserved resource allocations."
                />

                <DashboardCard
                  href="/guild"
                  title="Guild Settings"
                  description="Configure your guild and Discord server."
                />
              </div>
            </section>

            {/* =================================================
                ALLOCATION
            ================================================= */}

            <section className="mt-10">
              <h2 className="mb-4 text-lg font-semibold">
                Allocation
              </h2>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <DashboardCard
                  href="/allocation"
                  title="Allocation"
                  description="Preview and run the next resource allocation."
                  featured
                />

                <DashboardCard
                  href="/allocation/history"
                  title="Allocation History"
                  description="Review previous allocation runs, results and bidding pages."
                />

                <DashboardCard
                  href="/bid-pages"
                  title="Bid Pages"
                  description="View active and previous bidding pages and find assigned slots."
                />
              </div>
            </section>

            {/* =================================================
                RECENT EVENTS
            ================================================= */}

            {guild.events.length > 0 && (
              <section className="mt-10">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Recent Events
                    </h2>

                    <p className="mt-1 text-sm text-zinc-500">
                      Your latest events and
                      available rosters.
                    </p>
                  </div>

                  <Link
                    href="/events"
                    className="text-sm font-medium text-zinc-400 hover:text-white"
                  >
                    View all →
                  </Link>
                </div>

                <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
                  <div className="divide-y divide-zinc-800">
                    {guild.events.map(
                      (event) => (
                        <Link
                          key={event.id}
                          href={`/events/${event.id}`}
                          className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-zinc-800"
                        >
                          <div>
                            <p className="font-medium">
                              {formatEventType(
                                event.type
                              )}
                            </p>

                            <p className="mt-1 text-xs text-zinc-500">
                              {formatDate(
                                event.date
                              )}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {
                                event.rosters
                                  .length
                              }
                            </p>

                            <p className="text-xs text-zinc-500">
                              {event.rosters
                                .length === 1
                                ? "Roster"
                                : "Rosters"}
                            </p>
                          </div>
                        </Link>
                      )
                    )}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// =============================================================
// STAT CARD
// =============================================================

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
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
// DASHBOARD CARD
// =============================================================

function DashboardCard({
  href,
  title,
  description,
  featured = false,
}: {
  href: string;
  title: string;
  description: string;
  featured?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group block rounded-2xl border p-6 transition ${
        featured
          ? "border-zinc-600 bg-zinc-900 hover:border-zinc-400 hover:bg-zinc-800"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-semibold">
          {title}
        </h3>

        <span className="text-zinc-600 transition group-hover:translate-x-1 group-hover:text-zinc-300">
          →
        </span>
      </div>

      <p className="mt-2 text-sm leading-6 text-zinc-400">
        {description}
      </p>
    </Link>
  );
}

// =============================================================
// EVENT HELPERS
// =============================================================

function formatEventType(type: string) {
  switch (type) {
    case "GUILD_LEAGUE":
      return "Guild League";

    case "EMPERIUM_OVERRUN":
      return "Emperium Overrun";

    default:
      return type;
  }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Bangkok",
    }
  ).format(date);
}