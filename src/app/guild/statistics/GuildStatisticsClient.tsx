"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Player = {
  id: string;
  characterName: string | null;
  job: string | null;
  active: boolean;
  eligible: boolean;
  pvpScore: number | null;
  dpsScore: number | null;
  tankScore: number | null;
};
type JobPlayers = { gameType: "ROOC" | "RO3"; job: string; players: Player[] };
type Stats = {
  members: { total: number; active: number; inactive: number };
  jobs: { job: string; count: number }[];
  events: { total: number; completed: number; upcoming: number };
  rosters: { total: number };
  resources: { total: number; allocations: number; reservations: number };
};

type SortKey = "characterName" | "pvpScore" | "dpsScore" | "tankScore";
type SortDirection = "asc" | "desc";

export default function GuildStatisticsClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [jobPlayers, setJobPlayers] = useState<JobPlayers | null>(null);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("pvpScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/guild/statistics", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load statistics.");
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load statistics.");
    } finally {
      setLoading(false);
    }
  }

  async function openJob(job: string) {
    setSelectedJob(job);
    setJobPlayers(null);
    setPlayersLoading(true);
    setPlayersError(null);
    try {
      const response = await fetch(`/api/guild/statistics/${encodeURIComponent(job)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load players.");
      setJobPlayers(data);
    } catch (err) {
      setPlayersError(err instanceof Error ? err.message : "Failed to load players.");
    } finally {
      setPlayersLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const maxJobCount = useMemo(() => Math.max(...(stats?.jobs.map((item) => item.count) ?? [1]), 1), [stats]);
  const sortedPlayers = useMemo(() => {
    const players = [...(jobPlayers?.players ?? [])];
    players.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (sortKey === "characterName") {
        const result = String(av ?? "").localeCompare(String(bv ?? ""));
        return sortDirection === "asc" ? result : -result;
      }
      const result = (av ?? Number.NEGATIVE_INFINITY) - (bv ?? Number.NEGATIVE_INFINITY);
      return sortDirection === "asc" ? result : -result;
    });
    return players;
  }, [jobPlayers, sortKey, sortDirection]);

  function changeSort(key: SortKey) {
    if (sortKey === key) setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDirection(key === "characterName" ? "asc" : "desc"); }
  }

  return (
    <main className="min-h-screen bg-[#0b0b0b] px-4 py-6 text-gray-100 md:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <Link href="/" className="mb-4 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"><span aria-hidden="true">←</span> Back to Dashboard</Link>
            <h1 className="text-2xl font-bold text-white md:text-3xl">Guild Statistics</h1>
            <p className="mt-1 text-sm text-gray-400">A snapshot of your guild's members and activity.</p>
          </div>
          <button onClick={load} disabled={loading} className="rounded-lg border border-gray-700 bg-[#151515] px-4 py-2 text-sm hover:bg-[#1c1c1c] disabled:opacity-50">{loading ? "Refreshing..." : "Refresh"}</button>
        </div>

        {error && <div className="mb-6 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">{error}</div>}
        {loading && !stats ? <div className="rounded-xl border border-gray-800 bg-[#111] p-12 text-center text-gray-500">Loading statistics...</div> : stats && (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Total Members" value={stats.members.total} />
              <StatCard label="Active Members" value={stats.members.active} />
              <StatCard label="Events" value={stats.events.total} />
              <StatCard label="Rosters" value={stats.rosters.total} />
            </section>

            <section className="mt-6">
              <Panel title="Member Composition">
                <div className="space-y-3">
                  {stats.jobs.length === 0 ? <div className="text-sm text-gray-500">No job data available.</div> : stats.jobs.map((item) => (
                    <button key={item.job} type="button" onClick={() => openJob(item.job)} className="group block w-full rounded-lg p-2 text-left transition hover:bg-white/[0.04] focus:outline-none focus:ring-1 focus:ring-gray-500">
                      <div className="mb-1 flex justify-between text-xs"><span className="font-medium text-gray-300 group-hover:text-white">{item.job} <span className="ml-1 text-gray-600">↗ View players</span></span><span className="text-gray-500">{item.count}</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-800"><div className="h-full rounded-full bg-gray-500 transition-colors group-hover:bg-gray-300" style={{ width: `${(item.count / maxJobCount) * 100}%` }} /></div>
                    </button>
                  ))}
                </div>
              </Panel>
            </section>

            <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Completed Events" value={stats.events.completed} />
              <StatCard label="Upcoming Events" value={stats.events.upcoming} />
              <StatCard label="Resources" value={stats.resources.total} />
              <StatCard label="Allocations" value={stats.resources.allocations} />
            </section>

            <section className="mt-6 grid gap-6 md:grid-cols-2">
              <Panel title="Resource Activity"><div className="grid grid-cols-2 gap-4"><StatCard label="Reservations" value={stats.resources.reservations} compact /><StatCard label="Allocations" value={stats.resources.allocations} compact /></div></Panel>
              <Panel title="Member Status"><div className="grid grid-cols-2 gap-4"><StatCard label="Active" value={stats.members.active} compact /><StatCard label="Inactive" value={stats.members.inactive} compact /></div></Panel>
            </section>
          </>
        )}
      </div>

      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 md:p-6" role="dialog" aria-modal="true" aria-labelledby="job-players-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedJob(null); }}>
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl border border-gray-700 bg-[#111] shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-800 p-5">
              <div><h2 id="job-players-title" className="text-xl font-bold text-white">{selectedJob}</h2><p className="mt-1 text-sm text-gray-500">{jobPlayers?.players.length ?? 0} players in this job</p></div>
              <button onClick={() => setSelectedJob(null)} className="rounded-lg px-3 py-1 text-gray-400 hover:bg-gray-800 hover:text-white" aria-label="Close">✕</button>
            </div>
            {playersLoading ? <div className="p-12 text-center text-gray-500">Loading players...</div> : playersError ? <div className="p-6 text-sm text-red-300">{playersError}</div> : jobPlayers && (
              <>
                {jobPlayers.gameType === "RO3" && <div className="border-b border-amber-900/60 bg-amber-950/20 px-5 py-3 text-xs text-amber-200">RO3 player scores are not calculated yet. The score columns will populate once RO3 scoring is implemented; no ROOC scoring formula is applied to RO3.</div>}
                <div className="max-h-[65vh] overflow-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="sticky top-0 bg-[#191919] text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-5 py-3">#</th>
                        <SortHeader label="Character" sortKey="characterName" currentKey={sortKey} direction={sortDirection} onSort={changeSort} />
                        <SortHeader label="PVP Score" sortKey="pvpScore" currentKey={sortKey} direction={sortDirection} onSort={changeSort} />
                        <SortHeader label="DPS Score" sortKey="dpsScore" currentKey={sortKey} direction={sortDirection} onSort={changeSort} />
                        <SortHeader label="Tank Score" sortKey="tankScore" currentKey={sortKey} direction={sortDirection} onSort={changeSort} />
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {sortedPlayers.map((player, index) => (
                        <tr key={player.id} className="hover:bg-white/[0.03]">
                          <td className="px-5 py-3 text-gray-600">{index + 1}</td>
                          <td className="px-5 py-3 font-medium text-white">{player.characterName ?? "Unnamed"}</td>
                          <td className="px-5 py-3 tabular-nums">{formatScore(player.pvpScore)}</td>
                          <td className="px-5 py-3 tabular-nums">{formatScore(player.dpsScore)}</td>
                          <td className="px-5 py-3 tabular-nums">{formatScore(player.tankScore)}</td>
                          <td className="px-5 py-3"><span className={player.active ? "text-emerald-400" : "text-gray-500"}>{player.active ? "Active" : "Inactive"}</span>{!player.eligible && <span className="ml-2 text-xs text-gray-600">Not eligible</span>}</td>
                        </tr>
                      ))}
                      {sortedPlayers.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">No players found for this job.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function formatScore(value: number | null) { return value === null ? "—" : value.toFixed(2); }
function SortHeader({ label, sortKey, currentKey, direction, onSort }: { label: string; sortKey: SortKey; currentKey: SortKey; direction: SortDirection; onSort: (key: SortKey) => void }) {
  return <th className="px-5 py-3"><button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 hover:text-white">{label}<span className="text-gray-600">{currentKey === sortKey ? direction === "asc" ? "↑" : "↓" : "↕"}</span></button></th>;
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-xl border border-gray-800 bg-[#111] p-5"><h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-gray-400">{title}</h2>{children}</div>; }
function StatCard({ label, value, compact = false }: { label: string; value: number | string; compact?: boolean }) { return <div className="rounded-xl border border-gray-800 bg-[#111] p-4"><div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div><div className={`${compact ? "text-xl" : "text-2xl"} mt-1 font-bold text-white`}>{value}</div></div>; }
