import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageAuth } from "@/lib/auth";
export default async function AllocationHistoryPage() {
  await requirePageAuth();
  const guild = await prisma.guild.findFirst({
    select: {
      id: true,
      name: true,
    },
  });

  if (!guild) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-white"
          >
            ← Dashboard
          </Link>

          <div className="mt-8 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
            <h1 className="text-xl font-semibold">
              No guild configured
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              Configure your guild before viewing allocation history.
            </p>

            <Link
              href="/guild"
              className="mt-6 inline-flex rounded-lg bg-white px-5 py-3 font-medium text-black hover:bg-zinc-200"
            >
              Configure Guild
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const runs = await prisma.allocationRun.findMany({
    where: {
      guildId: guild.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      resourceResults: {
        include: {
          resource: {
            select: {
              name: true,
              type: true,
            },
          },
        },
      },

      allocationResults: {
        include: {
          member: {
            select: {
              characterName: true,
            },
          },

          resource: {
            select: {
              name: true,
              type: true,
            },
          },
        },
      },

      bidPages: {
        select: {
          id: true,
          type: true,
          pageNumber: true,
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* BACK NAVIGATION */}

        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-white"
        >
          ← Dashboard
        </Link>

        {/* HEADER */}

        <header className="mt-6 mb-8">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
            {guild.name}
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Allocation History
          </h1>

          <p className="mt-2 text-zinc-400">
            Review previous allocation runs and their results.
          </p>
        </header>

        {/* NO RUNS */}

        {runs.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
            <h2 className="text-xl font-semibold">
              No allocation runs yet
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              Completed allocations will appear here.
            </p>

            <Link
              href="/allocation"
              className="mt-6 inline-flex rounded-lg bg-white px-5 py-3 font-medium text-black hover:bg-zinc-200"
            >
              Create Allocation
            </Link>
          </section>
        ) : (
          <div className="space-y-4">
            {runs.map((run) => {
              const totalAllocated =
                run.resourceResults.reduce(
                  (sum, resource) =>
                    sum + resource.allocated,
                  0
                );

              const totalReserved =
                run.resourceResults.reduce(
                  (sum, resource) =>
                    sum + resource.reserved,
                  0
                );

              const totalOverflow =
                run.resourceResults.reduce(
                  (sum, resource) =>
                    sum + resource.overflow,
                  0
                );

              const featherPages =
                run.bidPages.filter(
                  (page) =>
                    page.type === "FEATHER"
                ).length;

              const cardPages =
                run.bidPages.filter(
                  (page) =>
                    page.type === "CARD"
                ).length;

              const hasBidPages =
                run.bidPages.length > 0;

              return (
                <section
                  key={run.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
                >
                  {/* RUN HEADER */}

                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="font-semibold">
                          Allocation Run
                        </h2>

                        <StatusBadge
                          status={run.status}
                        />
                      </div>

                      <p className="mt-2 font-mono text-xs text-zinc-600">
                        {run.id}
                      </p>

                      <p className="mt-2 text-sm text-zinc-500">
                        {formatDate(
                          run.createdAt
                        )}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                      <HistoryStat
                        label="Resources"
                        value={
                          run.resourceResults.length
                        }
                      />

                      <HistoryStat
                        label="Allocated"
                        value={
                          totalAllocated
                        }
                      />

                      <HistoryStat
                        label="Overflow"
                        value={
                          totalOverflow
                        }
                      />
                    </div>
                  </div>

                  {/* SUMMARY */}

                  <div className="mt-6 border-t border-zinc-800 pt-5">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <SummaryItem
                        label="Reserved"
                        value={
                          totalReserved
                        }
                      />

                      <SummaryItem
                        label="Member allocations"
                        value={
                          run
                            .allocationResults
                            .length
                        }
                      />

                      <SummaryItem
                        label="Completed"
                        value={
                          run.completedAt
                            ? formatDate(
                                run.completedAt
                              )
                            : "—"
                        }
                      />
                    </div>
                  </div>

                  {/* RESOURCE RESULTS */}

                  <div className="mt-6 border-t border-zinc-800 pt-5">
                    <h3 className="text-sm font-medium text-zinc-300">
                      Resource Results
                    </h3>

                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-zinc-800 text-zinc-500">
                            <th className="px-3 py-3 font-medium">
                              Resource
                            </th>

                            <th className="px-3 py-3 font-medium">
                              Type
                            </th>

                            <th className="px-3 py-3 font-medium">
                              Total
                            </th>

                            <th className="px-3 py-3 font-medium">
                              Reserved
                            </th>

                            <th className="px-3 py-3 font-medium">
                              Allocated
                            </th>

                            <th className="px-3 py-3 font-medium">
                              Overflow
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {run.resourceResults.map(
                            (resource) => (
                              <tr
                                key={
                                  resource.id
                                }
                                className="border-b border-zinc-900 last:border-0"
                              >
                                <td className="px-3 py-3 font-medium text-white">
                                  {
                                    resource
                                      .resource
                                      .name
                                  }
                                </td>

                                <td className="px-3 py-3 text-zinc-500">
                                  {resource
                                    .resource
                                    .type ===
                                  "FEATHER"
                                    ? "Feather"
                                    : "Card"}
                                </td>

                                <td className="px-3 py-3 text-zinc-400">
                                  {
                                    resource.total
                                  }
                                </td>

                                <td className="px-3 py-3 text-zinc-400">
                                  {
                                    resource.reserved
                                  }
                                </td>

                                <td className="px-3 py-3 text-zinc-400">
                                  {
                                    resource.allocated
                                  }
                                </td>

                                <td className="px-3 py-3">
                                  <span
                                    className={
                                      resource.overflow >
                                      0
                                        ? "text-amber-400"
                                        : "text-zinc-400"
                                    }
                                  >
                                    {
                                      resource.overflow
                                    }
                                  </span>
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* MEMBER ALLOCATIONS */}

                  <div className="mt-6 border-t border-zinc-800 pt-5">
                    <h3 className="text-sm font-medium text-zinc-300">
                      Member Allocations
                    </h3>

                    {run.allocationResults.length ===
                    0 ? (
                      <p className="mt-3 text-sm text-zinc-600">
                        No member allocations were
                        recorded.
                      </p>
                    ) : (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-zinc-800 text-zinc-500">
                              <th className="px-3 py-3 font-medium">
                                Member
                              </th>

                              <th className="px-3 py-3 font-medium">
                                Resource
                              </th>

                              <th className="px-3 py-3 font-medium">
                                Reserved
                              </th>

                              <th className="px-3 py-3 font-medium">
                                Additional
                              </th>

                              <th className="px-3 py-3 font-medium">
                                Total
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {run.allocationResults.map(
                              (
                                allocation
                              ) => {
                                const total =
                                  allocation.reservedQuantity +
                                  allocation.assignedQuantity;

                                return (
                                  <tr
                                    key={
                                      allocation.id
                                    }
                                    className="border-b border-zinc-900 last:border-0"
                                  >
                                    <td className="px-3 py-3 font-medium text-white">
                                      {
                                        allocation
                                          .member
                                          .characterName
                                      }
                                    </td>

                                    <td className="px-3 py-3 text-zinc-400">
                                      {
                                        allocation
                                          .resource
                                          .name
                                      }
                                    </td>

                                    <td className="px-3 py-3 text-zinc-400">
                                      {
                                        allocation.reservedQuantity
                                      }
                                    </td>

                                    <td className="px-3 py-3 text-zinc-400">
                                      {
                                        allocation.assignedQuantity
                                      }
                                    </td>

                                    <td className="px-3 py-3 font-semibold">
                                      {total}
                                    </td>
                                  </tr>
                                );
                              }
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* ROTATION */}

                  <RotationSummary
                    before={
                      run.rotationIndexBefore
                    }
                    after={
                      run.rotationIndexAfter
                    }
                  />

                  {/* BID PAGES */}

                  <div className="mt-6 border-t border-zinc-800 pt-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-zinc-300">
                          Bid Pages
                        </h3>

                        {hasBidPages ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-400">
                              {featherPages}{" "}
                              Feather{" "}
                              {featherPages ===
                              1
                                ? "Page"
                                : "Pages"}
                            </span>

                            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-400">
                              {cardPages}{" "}
                              Card{" "}
                              {cardPages ===
                              1
                                ? "Page"
                                : "Pages"}
                            </span>
                          </div>
                        ) : (
                          <p className="mt-1 text-sm text-zinc-600">
                            Bid pages were not generated
                            for this run.
                          </p>
                        )}
                      </div>

                      {hasBidPages && (
                        <Link
                          href={`/allocation/${run.id}/bids`}
                          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
                        >
                          View Bid Pages →
                        </Link>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function HistoryStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-500">
        {label}
      </p>

      <p className="mt-1 text-xl font-semibold">
        {value}
      </p>
    </div>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs text-zinc-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  if (status === "COMPLETED") {
    return (
      <span className="rounded-full border border-emerald-900 bg-emerald-950/40 px-3 py-1 text-xs text-emerald-400">
        Completed
      </span>
    );
  }

  if (status === "FAILED") {
    return (
      <span className="rounded-full border border-red-900 bg-red-950/40 px-3 py-1 text-xs text-red-400">
        Failed
      </span>
    );
  }

  return (
    <span className="rounded-full border border-amber-900 bg-amber-950/40 px-3 py-1 text-xs text-amber-400">
      Running
    </span>
  );
}

function RotationSummary({
  before,
  after,
}: {
  before: unknown;
  after: unknown;
}) {
  if (
    !before ||
    typeof before !== "object" ||
    !after ||
    typeof after !== "object"
  ) {
    return null;
  }

  const beforeMap =
    before as Record<string, unknown>;

  const afterMap =
    after as Record<string, unknown>;

  const resourceIds = Array.from(
    new Set([
      ...Object.keys(beforeMap),
      ...Object.keys(afterMap),
    ])
  );

  if (resourceIds.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 border-t border-zinc-800 pt-5">
      <h3 className="text-sm font-medium text-zinc-300">
        Rotation State
      </h3>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {resourceIds.map(
          (resourceId) => (
            <div
              key={resourceId}
              className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
            >
              <p className="truncate font-mono text-xs text-zinc-600">
                {resourceId}
              </p>

              <div className="mt-2 flex items-center gap-3 text-sm">
                <span className="text-zinc-500">
                  {String(
                    beforeMap[
                      resourceId
                    ] ?? "—"
                  )}
                </span>

                <span className="text-zinc-700">
                  →
                </span>

                <span className="font-semibold">
                  {String(
                    afterMap[
                      resourceId
                    ] ?? "—"
                  )}
                </span>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function formatDate(value: Date) {
  return value.toLocaleString(
    "en-SG",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
}