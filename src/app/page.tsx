import { prisma } from "@/lib/prisma";

export default async function Home() {
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
    },
  });

  const memberCount = guild?.members.length ?? 0;
  const resourceCount = guild?.resources.length ?? 0;
  const reservationCount = guild?.reservedAllocations.length ?? 0;
  const allocationRunCount = guild?.allocationRuns.length ?? 0;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-10">
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-zinc-500">
            ROO Guild Suite
          </p>

          <h1 className="text-4xl font-bold tracking-tight">
            Guild Dashboard
          </h1>

          <p className="mt-2 text-zinc-400">
            Manage your guild, members, resources and allocations.
          </p>
        </header>

        {!guild ? (
          <section className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
            <h2 className="text-xl font-semibold">
              No guild configured
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              Your ROO Guild Suite database is connected, but no guild has
              been created yet.
            </p>
          </section>
        ) : (
          <>
            <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-sm text-zinc-500">
                Guild
              </p>

              <h2 className="mt-1 text-2xl font-semibold">
                {guild.name}
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Discord Guild ID: {guild.discordGuildId}
              </p>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Active Members"
                value={memberCount}
              />

              <StatCard
                label="Active Resources"
                value={resourceCount}
              />

              <StatCard
                label="Reserved Allocations"
                value={reservationCount}
              />

              <StatCard
                label="Allocation Runs"
                value={allocationRunCount}
              />
            </section>

            <section className="mt-10">
              <h2 className="mb-4 text-lg font-semibold">
                Guild Management
              </h2>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <DashboardCard
                  title="Members"
                  description="Manage guild members, eligibility and priority."
                />

                <DashboardCard
                  title="Resources"
                  description="Manage feathers, cards and resource limits."
                />

                <DashboardCard
                  title="Reservations"
                  description="Manage reserved resource allocations."
                />

                <DashboardCard
                  title="Bid Automation"
                  description="Run allocation rounds and generate bid pages."
                />

                <DashboardCard
                  title="Allocation History"
                  description="Review previous allocation runs and results."
                />

                <DashboardCard
                  title="Settings"
                  description="Configure your guild and automation settings."
                />
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function StatCard({
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

function DashboardCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition-colors hover:border-zinc-600">
      <h3 className="font-semibold">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-zinc-400">
        {description}
      </p>
    </div>
  );
}