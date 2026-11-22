import Link from "next/link";
import ManagementPageHeader from "@/app/ManagementPageHeader";

import { prisma } from "@/lib/prisma";
import { requirePageAuth } from "@/lib/auth";

import {
  hasGuildModule,
  RESOURCE_SUITE_MODULE,
} from "@/lib/auth/modules";

export default async function AllocationHistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const requestedPage = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const PAGE_SIZE = 10;
  const auth =
    await requirePageAuth();

  if (
    !(await hasGuildModule(
      auth.guild.id,
      RESOURCE_SUITE_MODULE
    ))
  ) {
    return (
      <main className="hmdl-management hmdl-history-workspace min-h-screen bg-zinc-950 text-white">
        <div className="hmdl-page">

          <section className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
            <h1 className="text-xl font-semibold">
              Resource Suite required
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              Allocation History is part of the Resource Suite and is not enabled for this guild.
            </p>
          </section>
        </div>
      </main>
    );
  }  

  const guild =
    await prisma.guild.findUnique({
      where: {
        id: auth.guild.id,
      },

      select: {
        id: true,
        name: true,
      },
    });

  if (!guild) {
    return (
      <main className="hmdl-management hmdl-history-workspace min-h-screen bg-zinc-950 text-white">
        <div className="hmdl-page">

          <div className="mt-8 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
            <h1 className="text-xl font-semibold">
              No guild configured
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              Configure your guild before viewing allocation history.
            </p>

            <Link
              href="/guild"
              className="mt-6 inline-flex rounded-lg hmdl-btn hmdl-btn-primary px-5 py-3 font-medium"
            >
              Configure Guild
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const [totalRuns, cumulativeGroups] = await Promise.all([
    prisma.allocationRun.count({ where: { guildId: auth.guild.id } }),
    prisma.allocationResult.groupBy({
      by: ["memberId", "resourceId"],
      where: { allocationRun: { guildId: auth.guild.id } },
      _sum: { reservedQuantity: true, assignedQuantity: true },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalRuns / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const runs =
    await prisma.allocationRun.findMany({
      where: {
        guildId:
          auth.guild.id,
      },

      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,

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
  const memberIds = [...new Set(cumulativeGroups.map(row => row.memberId))];
  const resourceIds = [...new Set(cumulativeGroups.map(row => row.resourceId))];
  const [members, resources] = await Promise.all([
    memberIds.length ? prisma.guildMember.findMany({ where: { id: { in: memberIds }, guildId: auth.guild.id }, select: { id: true, characterName: true } }) : Promise.resolve([]),
    resourceIds.length ? prisma.resource.findMany({ where: { id: { in: resourceIds }, guildId: auth.guild.id }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const memberNames = new Map(members.map(member => [member.id, member.characterName ?? "Unknown"]));
  const resourceNames = new Map(resources.map(resource => [resource.id, resource.name]));
  const cumulativeTotals = cumulativeGroups
    .map(row => ({
      memberId: row.memberId,
      memberName: memberNames.get(row.memberId) ?? "Unknown",
      resourceName: resourceNames.get(row.resourceId) ?? "Unknown resource",
      quantity: (row._sum.reservedQuantity ?? 0) + (row._sum.assignedQuantity ?? 0),
    }))
    .filter(row => row.quantity > 0)
    .sort((a, b) => a.memberName.localeCompare(b.memberName) || a.resourceName.localeCompare(b.resourceName));

  return (
    <main className="hmdl-management hmdl-history-workspace min-h-screen bg-zinc-950 text-white">
      <div className="hmdl-page">
        {/* HEADER */}

        <ManagementPageHeader eyebrow="RESOURCE ALLOCATION" title="Allocation History" description="Review previous allocation runs and their results." />

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
              className="mt-6 inline-flex rounded-lg hmdl-btn hmdl-btn-primary px-5 py-3 font-medium"
            >
              Create Allocation
            </Link>
          </section>
        ) : (
          <>
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

              const astrocorePages = run.bidPages.filter((page) => page.type === "ASTROCORE").length;

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
                      <table aria-label="Resource results for this allocation" className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-zinc-800 text-zinc-500">
                            <th scope="col" className="px-3 py-3 font-medium">
                              Resource
                            </th>

                            <th scope="col" className="px-3 py-3 font-medium">
                              Type
                            </th>

                            <th scope="col" className="px-3 py-3 font-medium">
                              Total
                            </th>

                            <th scope="col" className="px-3 py-3 font-medium">
                              Reserved
                            </th>

                            <th scope="col" className="px-3 py-3 font-medium">
                              Allocated
                            </th>

                            <th scope="col" className="px-3 py-3 font-medium">
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
                        <table aria-label="Member allocations for this run" className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-zinc-800 text-zinc-500">
                              <th scope="col" className="px-3 py-3 font-medium">
                                Member
                              </th>

                              <th scope="col" className="px-3 py-3 font-medium">
                                Resource
                              </th>

                              <th scope="col" className="px-3 py-3 font-medium">
                                Reserved
                              </th>

                              <th scope="col" className="px-3 py-3 font-medium">
                                Additional
                              </th>

                              <th scope="col" className="px-3 py-3 font-medium">
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
                          className="inline-flex shrink-0 items-center justify-center rounded-lg hmdl-btn hmdl-btn-primary px-5 py-3 text-sm font-medium transition"
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

          {totalPages > 1 && <nav aria-label="Allocation history pages" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3">
            <span className="text-xs text-zinc-500">Page {page} of {totalPages} · {totalRuns.toLocaleString()} allocation runs</span>
            <div className="flex gap-2">
              {page > 1 ? <Link href={`/allocation/history?page=${page - 1}`} className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800">Previous</Link> : <span className="rounded-md border border-zinc-800 px-3 py-2 text-xs text-zinc-600">Previous</span>}
              {page < totalPages ? <Link href={`/allocation/history?page=${page + 1}`} className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800">Next</Link> : <span className="rounded-md border border-zinc-800 px-3 py-2 text-xs text-zinc-600">Next</span>}
            </div>
          </nav>}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold">Cumulative Member Totals</h2>
            <p className="mt-1 text-sm text-zinc-500">All-time totals across every allocation run. These totals are aggregated independently of the history page currently displayed.</p>
            {cumulativeTotals.length === 0 ? <p className="mt-4 text-sm text-zinc-600">No member allocations were recorded.</p> : <div className="mt-4 overflow-x-auto">
              <table aria-label="All-time allocation totals by member and resource" className="w-full text-left text-sm">
                <thead><tr className="border-b border-zinc-800 text-zinc-500"><th scope="col" className="px-3 py-3 font-medium">Member</th><th scope="col" className="px-3 py-3 font-medium">Resource</th><th scope="col" className="px-3 py-3 text-right font-medium">Total received</th></tr></thead>
                <tbody>{cumulativeTotals.map((row, index) => <tr key={row.memberId + "-" + row.resourceName + "-" + index} className="border-b border-zinc-900 last:border-0"><td className="px-3 py-3 font-medium text-white">{row.memberName}</td><td className="px-3 py-3 text-zinc-400">{row.resourceName}</td><td className="px-3 py-3 text-right font-semibold">{row.quantity}</td></tr>)}</tbody>
              </table>
            </div>}
          </section>
          </>
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