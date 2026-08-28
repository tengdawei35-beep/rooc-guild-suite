"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type RankingCategory =
  | "OVERALL"
  | "DPS"
  | "TANK"
  | "PVP";

type RankingMember = {
  id: string;

  displayName: string;
  characterName: string | null;
  job: string | null;

  active: boolean;
  eligible: boolean;

  priority:
    | "LEADER"
    | "OFFICER"
    | "COUNCIL"
    | "MEMBER";

  guildPercentile: number;

  tankScore: number;
  tankPercentile: number;

  dpsScore: number;
  dpsPercentile: number;

  pvpScore: number;
  pvpPercentile: number;

  event: {
    id: string;
    type:
      | "GUILD_LEAGUE"
      | "EMPERIUM_OVERRUN";
    date: string;
  } | null;

  overallRank: number;
  totalRanked: number;
};

type RankingsResponse = {
  rankings: RankingMember[];

  stats: {
    totalMembers: number;
    rankedMembers: number;
    unrankedMembers: number;
    activeRanked: number;
    inactiveRanked: number;
  };
};

export default function RankingsClient() {
  const [data, setData] =
    useState<RankingsResponse | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [category, setCategory] =
    useState<RankingCategory>(
      "OVERALL"
    );

  const [search, setSearch] =
    useState("");

  const [jobFilter, setJobFilter] =
    useState("ALL");

  const [statusFilter, setStatusFilter] =
    useState("ACTIVE");

  const rankings =
    data?.rankings ?? [];

  // ============================================================
  // LOAD RANKINGS
  // ============================================================

  async function loadRankings() {
    try {
      setLoading(true);
      setError(null);

      const response =
        await fetch(
          "/api/guild/rankings",
          {
            cache: "no-store",
          }
        );

      const result =
        (await response.json()) as
          | RankingsResponse
          | {
              error?: string;
            };

      if (!response.ok) {
        throw new Error(
          "error" in result &&
          result.error
            ? result.error
            : "Failed to load guild rankings."
        );
      }

      setData(
        result as RankingsResponse
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load guild rankings."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRankings();
  }, []);

  // ============================================================
  // JOB LIST
  // ============================================================

  const jobs = useMemo(() => {
    return [
      ...new Set(
        (data?.rankings ?? [])
          .map(
            (member) =>
              member.job
          )
          .filter(
            (
              job
            ): job is string =>
              Boolean(job)
          )
      ),
    ].sort();
  }, [data]);

  // ============================================================
  // FILTER + SORT
  // ============================================================

  const filteredRankings =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      const filtered =
        (data?.rankings ?? []).filter(
          (member) => {
            const matchesSearch =
              !query ||
              member.displayName
                .toLowerCase()
                .includes(query) ||
              (
                member.characterName ??
                ""
              )
                .toLowerCase()
                .includes(query) ||
              (
                member.job ??
                ""
              )
                .toLowerCase()
                .includes(query);

            const matchesJob =
              jobFilter ===
                "ALL" ||
              member.job ===
                jobFilter;

            const matchesStatus =
              statusFilter ===
                "ALL" ||
              (
                statusFilter ===
                  "ACTIVE" &&
                member.active
              ) ||
              (
                statusFilter ===
                  "INACTIVE" &&
                !member.active
              );

            return (
              matchesSearch &&
              matchesJob &&
              matchesStatus
            );
          }
        );

      return sortRankings(
        filtered,
        category
      );
    }, [
      data,
      search,
      jobFilter,
      statusFilter,
      category,
    ]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <main className="min-h-screen bg-[#0b0b0b] px-4 py-6 text-gray-100 md:px-6">
      <div className="mx-auto max-w-7xl">
        {/* ==================================================== */}
        {/* HEADER */}
        {/* ==================================================== */}

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              Guild Rankings
            </h1>

            <p className="mt-1 text-sm text-gray-400">
              Compare guild performance
              across overall, DPS, tank
              and PvP metrics.
            </p>
          </div>

          <button
            type="button"
            onClick={
              loadRankings
            }
            disabled={loading}
            className="rounded-lg border border-gray-700 bg-[#151515] px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-gray-500 hover:bg-[#1c1c1c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>

        {/* ==================================================== */}
        {/* ERROR */}
        {/* ==================================================== */}

        {error && (
          <div className="mb-6 rounded-lg border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* ==================================================== */}
        {/* SUMMARY */}
        {/* ==================================================== */}

        {data && (
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <SummaryCard
              label="Guild Members"
              value={
                data.stats
                  .totalMembers
              }
            />

            <SummaryCard
              label="Ranked"
              value={
                data.stats
                  .rankedMembers
              }
            />

            <SummaryCard
              label="Unranked"
              value={
                data.stats
                  .unrankedMembers
              }
            />

            <SummaryCard
              label="Active Ranked"
              value={
                data.stats
                  .activeRanked
              }
            />
          </div>
        )}

        {/* ==================================================== */}
        {/* MAIN CARD */}
        {/* ==================================================== */}

        <div className="overflow-hidden rounded-xl border border-gray-800 bg-[#111111] shadow-2xl">
          {/* ================================================== */}
          {/* CATEGORY TABS */}
          {/* ================================================== */}

          <div className="border-b border-gray-800 bg-[#151515] px-3 py-3">
            <div className="flex gap-1 overflow-x-auto">
              <CategoryButton
                active={
                  category ===
                  "OVERALL"
                }
                onClick={() =>
                  setCategory(
                    "OVERALL"
                  )
                }
              >
                Overall
              </CategoryButton>

              <CategoryButton
                active={
                  category === "DPS"
                }
                onClick={() =>
                  setCategory(
                    "DPS"
                  )
                }
              >
                DPS
              </CategoryButton>

              <CategoryButton
                active={
                  category ===
                  "TANK"
                }
                onClick={() =>
                  setCategory(
                    "TANK"
                  )
                }
              >
                Tank
              </CategoryButton>

              <CategoryButton
                active={
                  category === "PVP"
                }
                onClick={() =>
                  setCategory(
                    "PVP"
                  )
                }
              >
                PvP
              </CategoryButton>
            </div>
          </div>

          {/* ================================================== */}
          {/* FILTERS */}
          {/* ================================================== */}

          <div className="grid gap-3 border-b border-gray-800 bg-[#0f0f0f] p-4 md:grid-cols-3">
            <input
              value={search}
              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search character, Discord name or job..."
              className="h-10 rounded-lg border border-gray-700 bg-[#171717] px-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
            />

            <select
              value={
                jobFilter
              }
              onChange={(
                event
              ) =>
                setJobFilter(
                  event.target.value
                )
              }
              className="h-10 rounded-lg border border-gray-700 bg-[#171717] px-3 text-sm text-white outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
            >
              <option
                value="ALL"
                className="bg-[#171717]"
              >
                All Jobs
              </option>

              {jobs.map(
                (job) => (
                  <option
                    key={job}
                    value={job}
                    className="bg-[#171717]"
                  >
                    {job}
                  </option>
                )
              )}
            </select>

            <select
              value={
                statusFilter
              }
              onChange={(
                event
              ) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="h-10 rounded-lg border border-gray-700 bg-[#171717] px-3 text-sm text-white outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
            >
              <option
                value="ACTIVE"
                className="bg-[#171717]"
              >
                Active
              </option>

              <option
                value="INACTIVE"
                className="bg-[#171717]"
              >
                Inactive
              </option>

              <option
                value="ALL"
                className="bg-[#171717]"
              >
                All Members
              </option>
            </select>
          </div>

          {/* ================================================== */}
          {/* RESULTS HEADER */}
          {/* ================================================== */}

          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
            <div>
              <span className="text-sm font-semibold text-white">
                {getCategoryTitle(
                  category
                )}
              </span>

              <span className="ml-2 text-xs text-gray-500">
                {filteredRankings.length}{" "}
                {filteredRankings.length ===
                1
                  ? "member"
                  : "members"}
              </span>
            </div>

            <div className="text-xs text-gray-500">
              {category ===
              "OVERALL"
                ? "Highest percentile first"
                : "Highest score first"}
            </div>
          </div>

          {/* ================================================== */}
          {/* TABLE */}
          {/* ================================================== */}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-[#151515]">
                  {category ===
                    "OVERALL" && (
                    <th className="w-20 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Rank
                    </th>
                  )}

                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Character
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Job
                  </th>

                  {category ===
                    "OVERALL" && (
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Guild Percentile
                    </th>
                  )}

                  {category ===
                    "DPS" && (
                    <>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        DPS Score
                      </th>

                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Percentile
                      </th>
                    </>
                  )}

                  {category ===
                    "TANK" && (
                    <>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Tank Score
                      </th>

                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Percentile
                      </th>
                    </>
                  )}

                  {category ===
                    "PVP" && (
                    <>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        PvP Score
                      </th>

                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Percentile
                      </th>
                    </>
                  )}
                </tr>
              </thead>

              <tbody>
                {loading &&
                rankings.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={
                        category ===
                        "OVERALL"
                          ? 4
                          : 5
                      }
                      className="px-4 py-16 text-center text-sm text-gray-500"
                    >
                      Loading rankings...
                    </td>
                  </tr>
                ) : filteredRankings.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={
                        category ===
                        "OVERALL"
                          ? 4
                          : 5
                      }
                      className="px-4 py-16 text-center"
                    >
                      <div className="text-sm font-medium text-gray-300">
                        No ranked members
                        found
                      </div>

                      <div className="mt-1 text-xs text-gray-600">
                        Try changing
                        your filters.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRankings.map(
                    (
                      member,
                      index
                    ) => (
                      <RankingRow
                        key={
                          member.id
                        }
                        member={
                          member
                        }
                        category={
                          category
                        }
                        displayRank={
                          index + 1
                        }
                      />
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ==================================================== */}
        {/* INFORMATION */}
        {/* ==================================================== */}

        <div className="mt-4 rounded-xl border border-gray-800 bg-[#111111] p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            About Rankings
          </div>

          <div className="space-y-1 text-xs leading-5 text-gray-500">
            <p>
              Percentile represents
              the member's position
              within the guild's
              persisted score
              distribution.
            </p>

            <p>
              DPS, Tank and PvP show
              their actual score
              alongside their
              percentile.
            </p>

            <p>
              Overall uses the
              persisted guild
              percentile.
            </p>

            <p>
              Members without a
              historical roster
              score are currently
              considered unranked.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

// =============================================================
// RANKING ROW
// =============================================================

function RankingRow({
  member,
  category,
  displayRank,
}: {
  member: RankingMember;
  category: RankingCategory;
  displayRank: number;
}) {
  return (
    <tr className="border-b border-gray-800/80 transition hover:bg-[#171717]">
      {/* ====================================================== */}
      {/* OVERALL RANK */}
      {/* ====================================================== */}

      {category ===
        "OVERALL" && (
        <td className="px-4 py-3 text-center">
          <RankBadge
            rank={
              displayRank
            }
          />
        </td>
      )}

      {/* ====================================================== */}
      {/* CHARACTER */}
      {/* ====================================================== */}

      <td className="px-4 py-3">
        <Link
          href={`/guild/members/${member.id}`}
          className="group inline-flex items-center gap-2"
        >
          <span className="font-semibold text-gray-100 transition group-hover:text-white group-hover:underline">
            {member.characterName ??
              member.displayName}
          </span>

          {!member.active && (
            <span className="rounded-full border border-gray-700 bg-gray-800/70 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              Inactive
            </span>
          )}
        </Link>

        {/* Discord name is secondary information,
            not the primary roster identity. */}
        {member.characterName &&
          member.displayName !==
            member.characterName && (
            <div className="mt-0.5 text-xs text-gray-600">
              {member.displayName}
            </div>
          )}
      </td>

      {/* ====================================================== */}
      {/* JOB */}
      {/* ====================================================== */}

      <td className="px-4 py-3">
        <span className="text-gray-300">
          {member.job ??
            "—"}
        </span>
      </td>

      {/* ====================================================== */}
      {/* OVERALL */}
      {/* ====================================================== */}

      {category ===
        "OVERALL" && (
        <td className="px-4 py-3 text-right">
          <PercentileBadge
            value={
              member.guildPercentile
            }
          />
        </td>
      )}

      {/* ====================================================== */}
      {/* DPS */}
      {/* ====================================================== */}

      {category ===
        "DPS" && (
        <>
          <td className="px-4 py-3 text-right">
            <ScoreValue
              value={
                member.dpsScore
              }
            />
          </td>

          <td className="px-4 py-3 text-right">
            <PercentileBadge
              value={
                member.dpsPercentile
              }
            />
          </td>
        </>
      )}

      {/* ====================================================== */}
      {/* TANK */}
      {/* ====================================================== */}

      {category ===
        "TANK" && (
        <>
          <td className="px-4 py-3 text-right">
            <ScoreValue
              value={
                member.tankScore
              }
            />
          </td>

          <td className="px-4 py-3 text-right">
            <PercentileBadge
              value={
                member.tankPercentile
              }
            />
          </td>
        </>
      )}

      {/* ====================================================== */}
      {/* PVP */}
      {/* ====================================================== */}

      {category ===
        "PVP" && (
        <>
          <td className="px-4 py-3 text-right">
            <ScoreValue
              value={
                member.pvpScore
              }
            />
          </td>

          <td className="px-4 py-3 text-right">
            <PercentileBadge
              value={
                member.pvpPercentile
              }
            />
          </td>
        </>
      )}
    </tr>
  );
}

// =============================================================
// SORTING
// =============================================================

function sortRankings(
  members: RankingMember[],
  category: RankingCategory
) {
  return [
    ...members,
  ].sort((a, b) => {
    let difference = 0;

    if (
      category ===
      "OVERALL"
    ) {
      difference =
        b.guildPercentile -
        a.guildPercentile;
    }

    if (
      category ===
      "DPS"
    ) {
      difference =
        b.dpsScore -
        a.dpsScore;
    }

    if (
      category ===
      "TANK"
    ) {
      difference =
        b.tankScore -
        a.tankScore;
    }

    if (
      category ===
      "PVP"
    ) {
      difference =
        b.pvpScore -
        a.pvpScore;
    }

    if (
      difference !== 0
    ) {
      return difference;
    }

    return (
      a.characterName ??
      a.displayName
    ).localeCompare(
      b.characterName ??
        b.displayName
    );
  });
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
    <div className="rounded-xl border border-gray-800 bg-[#111111] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>

      <div className="mt-1 text-2xl font-bold text-white">
        {value}
      </div>
    </div>
  );
}

// =============================================================
// CATEGORY BUTTON
// =============================================================

function CategoryButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-lg px-5 py-2 text-sm font-medium transition ${
        active
          ? "bg-white text-black shadow-sm"
          : "text-gray-500 hover:bg-gray-800/70 hover:text-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

// =============================================================
// RANK BADGE
// =============================================================

function RankBadge({
  rank,
}: {
  rank: number;
}) {
  return (
    <span
      className={`inline-flex min-w-[42px] items-center justify-center rounded-md border px-2 py-1 text-xs font-bold ${
        rank === 1
          ? "border-gray-500 bg-gray-700 text-white"
          : rank === 2
            ? "border-gray-600 bg-gray-800 text-gray-200"
            : rank === 3
              ? "border-gray-700 bg-gray-900 text-gray-300"
              : "border-gray-800 bg-transparent text-gray-500"
      }`}
    >
      #{rank}
    </span>
  );
}

// =============================================================
// SCORE
// =============================================================

function ScoreValue({
  value,
}: {
  value: number;
}) {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return (
      <span className="text-gray-600">
        —
      </span>
    );
  }

  return (
    <span className="font-semibold tabular-nums text-gray-100">
      {value.toFixed(2)}
    </span>
  );
}

// =============================================================
// PERCENTILE BADGE
// =============================================================

function PercentileBadge({
  value,
}: {
  value: number;
}) {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return (
      <span className="text-gray-600">
        —
      </span>
    );
  }

  return (
    <span className="inline-flex min-w-[68px] justify-center rounded-md border border-gray-700 bg-gray-800/60 px-2 py-1 font-semibold tabular-nums text-gray-200">
      {value.toFixed(1)}%
    </span>
  );
}

// =============================================================
// CATEGORY TITLE
// =============================================================

function getCategoryTitle(
  category: RankingCategory
) {
  switch (category) {
    case "DPS":
      return "DPS Rankings";

    case "TANK":
      return "Tank Rankings";

    case "PVP":
      return "PvP Rankings";

    default:
      return "Overall Rankings";
  }
}