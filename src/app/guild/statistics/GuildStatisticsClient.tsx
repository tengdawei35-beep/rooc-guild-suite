"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Stats = {
  members: { total: number; active: number; inactive: number };
  jobs: { job: string; count: number }[];
  events: { total: number; completed: number; upcoming: number };
  rosters: { total: number };
  resources: { total: number; allocations: number; reservations: number };
};

export default function GuildStatisticsClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => { load(); }, []);

  const maxJobCount = useMemo(() => Math.max(...(stats?.jobs.map((item) => item.count) ?? [1]), 1), [stats]);

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
                    <div key={item.job}>
                      <div className="mb-1 flex justify-between text-xs"><span className="text-gray-300">{item.job}</span><span className="text-gray-500">{item.count}</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-800"><div className="h-full rounded-full bg-gray-500" style={{ width: `${(item.count / maxJobCount) * 100}%` }} /></div>
                    </div>
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
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-xl border border-gray-800 bg-[#111] p-5"><h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-gray-400">{title}</h2>{children}</div>; }
function StatCard({ label, value, compact = false }: { label: string; value: number | string; compact?: boolean }) { return <div className="rounded-xl border border-gray-800 bg-[#111] p-4"><div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div><div className={`${compact ? "text-xl" : "text-2xl"} mt-1 font-bold text-white`}>{value}</div></div>; }
