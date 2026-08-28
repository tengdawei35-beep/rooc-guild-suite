"use client";

import {
  useEffect,
  useState,
} from "react";
import Link from "next/link";

type MemberProfile = {
  id: string;

  characterName: string | null;
  job: string | null;

  active: boolean;
  eligible: boolean;

  priority:
    | "LEADER"
    | "OFFICER"
    | "COUNCIL"
    | "MEMBER";

  remarks: string | null;

  pdef: number | null;
  mdef: number | null;

  patk: number | null;
  matk: number | null;
  hp: number | null;

  critRes: number | null;

  ignorePdef: number | null;
  ignoreMdef: number | null;

  pvpDamageBonus: number | null;
  pvpDamageReduction: number | null;

  pdmgPercent: number | null;
  mdmgPercent: number | null;

  pdmgReductionPercent: number | null;
  mdmgReductionPercent: number | null;

  damageVsSmall: number | null;
  damageReductionVsSmall:
    | number
    | null;

  damageVsMedium: number | null;
  damageReductionVsMedium:
    | number
    | null;

  damageVsDemiHuman:
    | number
    | null;

  damageReductionVsDemiHuman:
    | number
    | null;

  damageVsBrute: number | null;
  damageReductionVsBrute:
    | number
    | null;

  equipmentPdefPercent:
    | number
    | null;

  equipmentMdefPercent:
    | number
    | null;

  leaveDates: {
    id: string;
    date: string;
    reason: string | null;
  }[];
};

type CurrentScore = {
  guildPercentile: number;

  tankScore: number;
  dpsScore: number;
  pvpScore: number;

  event: {
    id: string;

    type:
      | "GUILD_LEAGUE"
      | "EMPERIUM_OVERRUN";

    date: string;

    battlefield:
      | "BATTLEFIELD_1"
      | "BATTLEFIELD_2";

    partyNumber: number;
    slotNumber: number;
  };
} | null;

type HistoryEntry = {
  rosterMemberId: string;

  event: {
    id: string;

    type:
      | "GUILD_LEAGUE"
      | "EMPERIUM_OVERRUN";

    date: string;
  };

  battlefield:
    | "BATTLEFIELD_1"
    | "BATTLEFIELD_2";

  partyNumber: number;
  slotNumber: number;

  guildPercentile: number;

  tankScore: number;
  dpsScore: number;
  pvpScore: number;

  createdAt: string;
};

type ApiResponse = {
  member: MemberProfile;
  current: CurrentScore;
  history: HistoryEntry[];
};

export default function MemberProfileClient({
  memberId,
}: {
  memberId: string;
}) {
  const [data, setData] =
    useState<ApiResponse | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const response =
          await fetch(
            `/api/guild/members/${memberId}`,
            {
              cache: "no-store",
            }
          );

        const json =
          await response.json();

        if (!response.ok) {
          throw new Error(
            json.error ??
              "Failed to load member."
          );
        }

        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load member."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [memberId]);

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl p-6">
          <div className="text-sm text-zinc-500">
            Loading member profile...
          </div>
        </div>
      </main>
    );
  }

  // ============================================================
  // ERROR
  // ============================================================

  if (error) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl p-6">
          <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-400">
            {error}
          </div>

          <Link
            href="/guild/members"
            className="mt-4 inline-block text-sm text-zinc-500 transition hover:text-white"
          >
            ← Back to members
          </Link>
        </div>
      </main>
    );
  }

  if (!data) {
    return null;
  }

  const {
    member,
    current,
    history,
  } = data;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl p-6">
        {/* ====================================================== */}
        {/* HEADER */}
        {/* ====================================================== */}

        <div className="mb-8">
          <Link
            href="/guild/members"
            className="text-sm text-zinc-500 transition hover:text-white"
          >
            ← Guild Members
          </Link>

          <div className="mt-5 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">
                {member.characterName}
              </h1>

              <div className="mt-2 text-sm text-zinc-500">
                {member.characterName
                  : null}

                {member.job
                  ? ` • ${member.job}`
                  : ""}
              </div>
            </div>

            <div className="flex gap-2">
              <StatusBadge
                active={member.active}
                label={
                  member.active
                    ? "Active"
                    : "Inactive"
                }
              />

              <StatusBadge
                active={member.eligible}
                label={
                  member.eligible
                    ? "Eligible"
                    : "Ineligible"
                }
              />
            </div>
          </div>
        </div>

        {/* ====================================================== */}
        {/* PERFORMANCE */}
        {/* ====================================================== */}

        <section className="mb-8">
          <SectionTitle>
            Performance
          </SectionTitle>

          {current ? (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <ScoreCard
                  label="Guild Percentile"
                  value={formatScore(
                    current.guildPercentile
                  )}
                  suffix="%"
                />

                <ScoreCard
                  label="PvP Score"
                  value={formatScore(
                    current.pvpScore
                  )}
                />

                <ScoreCard
                  label="DPS Score"
                  value={formatScore(
                    current.dpsScore
                  )}
                />

                <ScoreCard
                  label="Tank Score"
                  value={formatScore(
                    current.tankScore
                  )}
                />
              </div>

              {/* ================================================== */}
              {/* PERFORMANCE TREND */}
              {/* ================================================== */}

              <div className="mt-8">
                <h3 className="mb-4 text-sm font-semibold text-zinc-300">
                  Performance Trend
                </h3>

                <PerformanceTrend
                  history={history}
                />
              </div>

              {/* ================================================== */}
              {/* LATEST SNAPSHOT */}
              {/* ================================================== */}

              <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Latest snapshot
                </div>

                <div className="mt-2 text-sm text-zinc-400">
                  {formatEventType(
                    current.event.type
                  )}{" "}
                  •{" "}
                  {formatDate(
                    current.event.date
                  )}{" "}
                  •{" "}
                  {formatBattlefield(
                    current.event
                      .battlefield
                  )}{" "}
                  • Party{" "}
                  {
                    current.event
                      .partyNumber
                  }{" "}
                  • Slot{" "}
                  {
                    current.event
                      .slotNumber
                  }
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-500">
              No roster performance
              history yet.
            </div>
          )}
        </section>

        {/* ====================================================== */}
        {/* CHARACTER INFORMATION */}
        {/* ====================================================== */}

        <section className="mb-8">
          <SectionTitle>
            Character Information
          </SectionTitle>

          <div className="grid gap-px overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800 md:grid-cols-2">
            <InfoRow
              label="Character"
              value={
                member.characterName
              }
            />

            <InfoRow
              label="Discord Name"
              value={
                member.discordUsername
              }
            />

            <InfoRow
              label="Job"
              value={member.job}
            />

            <InfoRow
              label="Priority"
              value={
                member.priority
              }
            />

            <InfoRow
              label="Active"
              value={
                member.active
                  ? "Yes"
                  : "No"
              }
            />

            <InfoRow
              label="Eligible"
              value={
                member.eligible
                  ? "Yes"
                  : "No"
              }
            />

            {member.remarks ? (
              <div className="bg-zinc-900 p-4 md:col-span-2">
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Remarks
                </div>

                <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">
                  {member.remarks}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* ====================================================== */}
        {/* CORE STATS */}
        {/* ====================================================== */}

        <StatSection
          title="Core Stats"
          stats={[
            [
              "HP",
              member.hp,
            ],
            [
              "P.ATK",
              member.patk,
            ],
            [
              "M.ATK",
              member.matk,
            ],
            [
              "P.DEF",
              member.pdef,
            ],
            [
              "M.DEF",
              member.mdef,
            ],
            [
              "Crit RES",
              member.critRes,
            ],
            [
              "Ignore P.DEF",
              member.ignorePdef,
              true,
            ],
            [
              "Ignore M.DEF",
              member.ignoreMdef,
              true,
            ],
          ]}
        />

        {/* ====================================================== */}
        {/* PVP */}
        {/* ====================================================== */}

        <StatSection
          title="PvP"
          stats={[
            [
              "PvP Damage Bonus",
              member.pvpDamageBonus,
              true,
            ],
            [
              "PvP Damage Reduction",
              member.pvpDamageReduction,
              true,
            ],
            [
              "PDMG %",
              member.pdmgPercent,
              true,
            ],
            [
              "MDMG %",
              member.mdmgPercent,
              true,
            ],
            [
              "PDMG Reduction %",
              member.pdmgReductionPercent,
              true,
            ],
            [
              "MDMG Reduction %",
              member.mdmgReductionPercent,
              true,
            ],
          ]}
        />

        {/* ====================================================== */}
        {/* SIZE */}
        {/* ====================================================== */}

        <StatSection
          title="Size Modifiers"
          stats={[
            [
              "Damage vs Small",
              member.damageVsSmall,
              true,
            ],
            [
              "Reduction vs Small",
              member.damageReductionVsSmall,
              true,
            ],
            [
              "Damage vs Medium",
              member.damageVsMedium,
              true,
            ],
            [
              "Reduction vs Medium",
              member.damageReductionVsMedium,
              true,
            ],
          ]}
        />

        {/* ====================================================== */}
        {/* RACE */}
        {/* ====================================================== */}

        <StatSection
          title="Race Modifiers"
          stats={[
            [
              "Damage vs Demi-Human",
              member.damageVsDemiHuman,
              true,
            ],
            [
              "Reduction vs Demi-Human",
              member.damageReductionVsDemiHuman,
              true,
            ],
            [
              "Damage vs Brute",
              member.damageVsBrute,
              true,
            ],
            [
              "Reduction vs Brute",
              member.damageReductionVsBrute,
              true,
            ],
          ]}
        />

        {/* ====================================================== */}
        {/* EQUIPMENT */}
        {/* ====================================================== */}

        <StatSection
          title="Equipment"
          stats={[
            [
              "Equipment P.DEF %",
              member.equipmentPdefPercent,
              true,
            ],
            [
              "Equipment M.DEF %",
              member.equipmentMdefPercent,
              true,
            ],
          ]}
        />

        {/* ====================================================== */}
        {/* LEAVE */}
        {/* ====================================================== */}

        <section className="mb-8">
          <SectionTitle>
            Leave / Unavailability
          </SectionTitle>

          {member.leaveDates
            .length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-500">
              No leave dates recorded.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-800 bg-zinc-950">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-zinc-400">
                      Date
                    </th>

                    <th className="px-4 py-3 text-left font-medium text-zinc-400">
                      Reason
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {member.leaveDates.map(
                    (leave) => (
                      <tr
                        key={
                          leave.id
                        }
                        className="border-b border-zinc-800 last:border-0"
                      >
                        <td className="px-4 py-3 text-zinc-300">
                          {formatDate(
                            leave.date
                          )}
                        </td>

                        <td className="px-4 py-3 text-zinc-500">
                          {leave.reason ??
                            "—"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ====================================================== */}
        {/* ROSTER HISTORY */}
        {/* ====================================================== */}

        <section>
          <SectionTitle>
            Roster History
          </SectionTitle>

          {history.length ===
          0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-500">
              This member has not
              appeared in an
              automatically or
              manually generated
              roster yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="border-b border-zinc-800 bg-zinc-950">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-zinc-400">
                      Date
                    </th>

                    <th className="px-4 py-3 text-left font-medium text-zinc-400">
                      Event
                    </th>

                    <th className="px-4 py-3 text-left font-medium text-zinc-400">
                      Battlefield
                    </th>

                    <th className="px-4 py-3 text-left font-medium text-zinc-400">
                      Party
                    </th>

                    <th className="px-4 py-3 text-left font-medium text-zinc-400">
                      Slot
                    </th>

                    <th className="px-4 py-3 text-right font-medium text-zinc-400">
                      Percentile
                    </th>

                    <th className="px-4 py-3 text-right font-medium text-zinc-400">
                      PvP
                    </th>

                    <th className="px-4 py-3 text-right font-medium text-zinc-400">
                      DPS
                    </th>

                    <th className="px-4 py-3 text-right font-medium text-zinc-400">
                      Tank
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {history.map(
                    (entry) => (
                      <tr
                        key={
                          entry.rosterMemberId
                        }
                        className="border-b border-zinc-800 last:border-0"
                      >
                        <td className="px-4 py-3 text-zinc-300">
                          {formatDate(
                            entry.event
                              .date
                          )}
                        </td>

                        <td className="px-4 py-3 text-zinc-300">
                          {formatEventType(
                            entry.event
                              .type
                          )}
                        </td>

                        <td className="px-4 py-3 text-zinc-400">
                          {formatBattlefield(
                            entry.battlefield
                          )}
                        </td>

                        <td className="px-4 py-3 text-zinc-400">
                          {
                            entry.partyNumber
                          }
                        </td>

                        <td className="px-4 py-3 text-zinc-400">
                          {
                            entry.slotNumber
                          }
                        </td>

                        <td className="px-4 py-3 text-right font-medium text-zinc-200">
                          {formatScore(
                            entry.guildPercentile
                          )}
                          %
                        </td>

                        <td className="px-4 py-3 text-right text-zinc-400">
                          {formatScore(
                            entry.pvpScore
                          )}
                        </td>

                        <td className="px-4 py-3 text-right text-zinc-400">
                          {formatScore(
                            entry.dpsScore
                          )}
                        </td>

                        <td className="px-4 py-3 text-right text-zinc-400">
                          {formatScore(
                            entry.tankScore
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

// =============================================================
// PERFORMANCE TREND
// =============================================================

function PerformanceTrend({
  history,
}: {
  history: HistoryEntry[];
}) {
  if (history.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-500">
        No historical performance
        data available yet.
      </div>
    );
  }

  // API returns newest first.
  // Reverse it so the visual trend is
  // oldest → newest.
  const chronological = [
    ...history,
  ].reverse();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TrendCard
        title="Guild Percentile"
        values={chronological.map(
          (entry) =>
            entry.guildPercentile
        )}
        suffix="%"
      />

      <TrendCard
        title="DPS Score"
        values={chronological.map(
          (entry) =>
            entry.dpsScore
        )}
      />

      <TrendCard
        title="Tank Score"
        values={chronological.map(
          (entry) =>
            entry.tankScore
        )}
      />

      <TrendCard
        title="PvP Score"
        values={chronological.map(
          (entry) =>
            entry.pvpScore
        )}
      />
    </div>
  );
}

// =============================================================
// TREND CARD
// =============================================================

function TrendCard({
  title,
  values,
  suffix = "",
}: {
  title: string;
  values: number[];
  suffix?: string;
}) {
  const latest =
    values[
      values.length - 1
    ];

  const previous =
    values.length > 1
      ? values[
          values.length - 2
        ]
      : null;

  const change =
    previous === null
      ? null
      : latest - previous;

  const max = Math.max(
    ...values,
    1
  );

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      {/* HEADER */}

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {title}
          </div>

          <div className="mt-1 text-2xl font-bold text-white">
            {formatTrendValue(
              latest,
              suffix
            )}
          </div>
        </div>

        {change !== null && (
          <TrendChange
            change={change}
            suffix={suffix}
          />
        )}
      </div>

      {/* BARS */}

      <div className="mt-5 flex h-28 items-end gap-2">
        {values.map(
          (value, index) => {
            const height =
              max > 0
                ? Math.max(
                    8,
                    (value /
                      max) *
                      100
                  )
                : 8;

            const isLatest =
              index ===
              values.length -
                1;

            return (
              <div
                key={index}
                className="flex h-full flex-1 flex-col items-center justify-end"
              >
                <div className="mb-1 text-[10px] tabular-nums text-zinc-500">
                  {formatTrendValue(
                    value,
                    suffix
                  )}
                </div>

                <div
                  className={`w-full max-w-12 rounded-t transition ${
                    isLatest
                      ? "bg-zinc-200"
                      : "bg-zinc-700"
                  }`}
                  style={{
                    height: `${height}%`,
                  }}
                />
              </div>
            );
          }
        )}
      </div>

      {/* FOOTER */}

      <div className="mt-3 flex justify-between text-[10px] text-zinc-600">
        <span>
          {values.length ===
          1
            ? "1 snapshot"
            : `${values.length} snapshots`}
        </span>

        <span>
          Oldest → Latest
        </span>
      </div>
    </div>
  );
}

// =============================================================
// TREND CHANGE
// =============================================================

function TrendChange({
  change,
  suffix = "",
}: {
  change: number;
  suffix?: string;
}) {
  if (
    Math.abs(change) <
    0.001
  ) {
    return (
      <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-400">
        No change
      </span>
    );
  }

  const positive =
    change > 0;

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        positive
          ? "border border-emerald-900 bg-emerald-950 text-emerald-400"
          : "border border-red-900 bg-red-950 text-red-400"
      }`}
    >
      {positive ? "+" : ""}
      {change.toFixed(1)}
      {suffix}
    </span>
  );
}

// =============================================================
// GENERAL COMPONENTS
// =============================================================

function SectionTitle({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <h2 className="mb-4 text-lg font-semibold text-white">
      {children}
    </h2>
  );
}

function ScoreCard({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-bold text-white">
        {value}
        {suffix}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value:
    | string
    | null
    | undefined;
}) {
  return (
    <div className="bg-zinc-900 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>

      <div className="mt-1 text-sm font-medium text-zinc-200">
        {value || "—"}
      </div>
    </div>
  );
}

function StatSection({
  title,
  stats,
}: {
  title: string;

  stats: [
    string,
    number | null,
    boolean?
  ][];
}) {
  return (
    <section className="mb-8">
      <SectionTitle>
        {title}
      </SectionTitle>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800 md:grid-cols-4">
        {stats.map(
          (
            [
              label,
              value,
              percentage,
            ]
          ) => (
            <div
              key={label}
              className="bg-zinc-900 p-4"
            >
              <div className="text-xs text-zinc-500">
                {label}
              </div>

              <div className="mt-1 text-base font-semibold text-zinc-200">
                {formatValue(
                  value,
                  percentage
                )}
              </div>
            </div>
          )
        )}
      </div>
    </section>
  );
}

function StatusBadge({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active
          ? "border border-emerald-900 bg-emerald-950 text-emerald-400"
          : "border border-zinc-700 bg-zinc-800 text-zinc-500"
      }`}
    >
      {label}
    </span>
  );
}

// =============================================================
// FORMATTING
// =============================================================

function formatValue(
  value: number | null,
  percentage = false
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  if (percentage) {
    return `${formatNumber(
      value
    )}%`;
  }

  return formatNumber(value);
}

function formatScore(
  value: number
) {
  return Number.isFinite(
    value
  )
    ? value.toFixed(1)
    : "0.0";
}

function formatNumber(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      maximumFractionDigits: 2,
    }
  ).format(value);
}

function formatTrendValue(
  value: number,
  suffix = ""
) {
  if (
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return `${value.toFixed(
    1
  )}${suffix}`;
}

function formatDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Asia/Bangkok",

      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(
    new Date(value)
  );
}

function formatEventType(
  type:
    | "GUILD_LEAGUE"
    | "EMPERIUM_OVERRUN"
) {
  return type ===
    "GUILD_LEAGUE"
    ? "Guild League"
    : "Emperium Overrun";
}

function formatBattlefield(
  battlefield:
    | "BATTLEFIELD_1"
    | "BATTLEFIELD_2"
) {
  return battlefield ===
    "BATTLEFIELD_1"
    ? "Battlefield 1"
    : "Battlefield 2";
}