"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type MemberProfile = {
  id: string;
  discordUsername: string | null;
  characterName: string | null;
  job: string | null;
  active: boolean;
  eligible: boolean;
  priority: "LEADER" | "OFFICER" | "COUNCIL" | "MEMBER";
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
  damageReductionVsSmall: number | null;
  damageVsMedium: number | null;
  damageReductionVsMedium: number | null;
  damageVsDemiHuman: number | null;
  damageReductionVsDemiHuman: number | null;
  damageVsBrute: number | null;
  damageReductionVsBrute: number | null;
  equipmentPdefPercent: number | null;
  equipmentMdefPercent: number | null;
  leaveDates: { id: string; date: string; reason: string | null }[];
};

type CurrentScore = {
  guildPercentile: number;
  tankScore: number;
  dpsScore: number;
  pvpScore: number;
  event: {
    id: string;
    type: "GUILD_LEAGUE" | "EMPERIUM_OVERRUN";
    date: string;
    battlefield: "BATTLEFIELD_1" | "BATTLEFIELD_2";
    partyNumber: number;
    slotNumber: number;
  } | null;
} | null;

type HistoryEntry = {
  rosterMemberId: string;
  event: { id: string; type: "GUILD_LEAGUE" | "EMPERIUM_OVERRUN"; date: string };
  battlefield: "BATTLEFIELD_1" | "BATTLEFIELD_2";
  partyNumber: number;
  slotNumber: number;
  guildPercentile: number;
  tankScore: number;
  dpsScore: number;
  pvpScore: number;
  createdAt: string;
};

type ApiResponse = { member: MemberProfile; current: CurrentScore; history: HistoryEntry[] };

export default function MemberProfileClient({ memberId, rawPdef, rawMdef }: { memberId: string; rawPdef: number; rawMdef: number }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/guild/members/${memberId}`, { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Failed to load member.");
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load member.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [memberId]);

  if (loading) return <main className="min-h-screen bg-zinc-950 text-white"><div className="mx-auto max-w-7xl p-6"><div className="text-sm text-zinc-500">Loading member profile...</div></div></main>;

  if (error) return <main className="min-h-screen bg-zinc-950 text-white"><div className="mx-auto max-w-7xl p-6"><div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-400">{error}</div><Link href="/guild/members" className="mt-4 inline-block text-sm text-zinc-500 transition hover:text-white">← Back to members</Link></div></main>;
  if (!data) return null;

  const { member, current, history } = data;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-8">
          <Link href="/guild/members" className="text-sm text-zinc-500 transition hover:text-white">← Guild Members</Link>
          <div className="mt-5 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">{member.characterName}</h1>
              <div className="mt-2 text-sm text-zinc-500">{member.characterName}{member.job ? ` • ${member.job}` : ""}</div>
            </div>
            <div className="flex gap-2"><StatusBadge active={member.active} label={member.active ? "Active" : "Inactive"} /><StatusBadge active={member.eligible} label={member.eligible ? "Eligible" : "Ineligible"} /></div>
          </div>
        </div>

        <section className="mb-8">
          <SectionTitle>Performance</SectionTitle>
          {current ? (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <ScoreCard label="Guild Percentile" value={formatScore(current.guildPercentile)} suffix="%" />
                <ScoreCard label="PvP Score" value={formatScore(current.pvpScore)} />
                <ScoreCard label="DPS Score" value={formatScore(current.dpsScore)} />
                <ScoreCard label="Tank Score" value={formatScore(current.tankScore)} />
              </div>
              <div className="mt-8"><h3 className="mb-4 text-sm font-semibold text-zinc-300">Performance Trend</h3><PerformanceTrend history={history} /></div>
              {current.event ? (
                <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Latest snapshot</div>
                  <div className="mt-2 text-sm text-zinc-400">{formatEventType(current.event.type)} • {formatDate(current.event.date)} • {formatBattlefield(current.event.battlefield)} • Party {current.event.partyNumber} • Slot {current.event.slotNumber}</div>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-500">No roster assignment yet. Performance scores shown are the member's current live scores.</div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-500">No roster performance history yet.</div>
          )}
        </section>

        <section className="mb-8"><SectionTitle>Character Information</SectionTitle><div className="grid gap-px overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800 md:grid-cols-2"><InfoRow label="Character" value={member.characterName} /><InfoRow label="Discord Name" value={member.discordUsername} /><InfoRow label="Job" value={member.job} /><InfoRow label="Priority" value={member.priority} /><InfoRow label="Active" value={member.active ? "Yes" : "No"} /><InfoRow label="Eligible" value={member.eligible ? "Yes" : "No"} />{member.remarks ? <div className="bg-zinc-900 p-4 md:col-span-2"><div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Remarks</div><div className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{member.remarks}</div></div> : null}</div></section>

        <StatSection title="Derived Character Stats" stats={[["RAW PDEF", rawPdef], ["RAW MDEF", rawMdef]]} />
        <StatSection title="Core Stats" stats={[["HP", member.hp], ["P.ATK", member.patk], ["M.ATK", member.matk], ["P.DEF", member.pdef], ["M.DEF", member.mdef], ["Crit RES", member.critRes], ["Ignore P.DEF", member.ignorePdef, true], ["Ignore M.DEF", member.ignoreMdef, true]]} />
        <StatSection title="PvP" stats={[["PvP Damage Bonus", member.pvpDamageBonus, true], ["PvP Damage Reduction", member.pvpDamageReduction, true], ["PDMG %", member.pdmgPercent, true], ["MDMG %", member.mdmgPercent, true], ["PDMG Reduction %", member.pdmgReductionPercent, true], ["MDMG Reduction %", member.mdmgReductionPercent, true]]} />
        <StatSection title="Size Modifiers" stats={[["Damage vs Small", member.damageVsSmall, true], ["Reduction vs Small", member.damageReductionVsSmall, true], ["Damage vs Medium", member.damageVsMedium, true], ["Reduction vs Medium", member.damageReductionVsMedium, true]]} />
        <StatSection title="Race Modifiers" stats={[["Damage vs Demi-Human", member.damageVsDemiHuman, true], ["Reduction vs Demi-Human", member.damageReductionVsDemiHuman, true], ["Damage vs Brute", member.damageVsBrute, true], ["Reduction vs Brute", member.damageReductionVsBrute, true]]} />
        <StatSection title="Equipment" stats={[["Equipment P.DEF %", member.equipmentPdefPercent, true], ["Equipment M.DEF %", member.equipmentMdefPercent, true]]} />

        <section className="mb-8"><SectionTitle>Leave / Unavailability</SectionTitle>{member.leaveDates.length === 0 ? <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-500">No leave dates recorded.</div> : <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"><table className="w-full text-sm"><thead className="border-b border-zinc-800 bg-zinc-950"><tr><th className="px-4 py-3 text-left font-medium text-zinc-400">Date</th><th className="px-4 py-3 text-left font-medium text-zinc-400">Reason</th></tr></thead><tbody>{member.leaveDates.map((leave) => <tr key={leave.id} className="border-b border-zinc-800 last:border-0"><td className="px-4 py-3 text-zinc-300">{formatDate(leave.date)}</td><td className="px-4 py-3 text-zinc-400">{leave.reason || "—"}</td></tr>)}</tbody></table></div>}</section>

        <Link href="/guild/members" className="inline-block text-sm text-zinc-500 transition hover:text-white">← Back to members</Link>
      </div>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) { return <h2 className="mb-4 text-lg font-semibold text-white">{children}</h2>; }
function StatusBadge({ active, label }: { active: boolean; label: string }) { return <span className={`rounded-full border px-3 py-1 text-xs font-medium ${active ? "border-emerald-800 bg-emerald-950/50 text-emerald-300" : "border-zinc-700 bg-zinc-900 text-zinc-500"}`}>{label}</span>; }
function ScoreCard({ label, value, suffix = "" }: { label: string; value: string; suffix?: string }) { return <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5"><div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div><div className="mt-2 text-2xl font-bold text-white">{value}{suffix}</div></div>; }
function InfoRow({ label, value }: { label: string; value: string | null }) { return <div className="bg-zinc-900 p-4"><div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div><div className="mt-1 text-sm text-zinc-300">{value || "—"}</div></div>; }
function StatSection({ title, stats }: { title: string; stats: [string, number | null, boolean?][] }) { return <section className="mb-8"><SectionTitle>{title}</SectionTitle><div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800 sm:grid-cols-3 md:grid-cols-4">{stats.map(([label, value, percent]) => <div key={label} className="bg-zinc-900 p-4"><div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div><div className="mt-1 text-lg font-semibold text-white">{value == null || !Number.isFinite(value) ? "—" : `${value.toLocaleString()}${percent ? "%" : ""}`}</div></div>)}</div></section>; }
function PerformanceTrend({ history }: { history: HistoryEntry[] }) { if (history.length === 0) return <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-500">No historical roster scores available yet.</div>; const points = history.slice().reverse().map((entry, index) => ({ x: index, value: entry.guildPercentile })); const width = 900; const height = 220; const pad = 24; const max = Math.max(100, ...points.map((point) => point.value)); const min = Math.min(0, ...points.map((point) => point.value)); const range = Math.max(1, max - min); const pointString = points.map((point) => `${pad + (point.x / Math.max(1, points.length - 1)) * (width - pad * 2)},${height - pad - ((point.value - min) / range) * (height - pad * 2)}`).join(" "); return <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 p-4"><svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" preserveAspectRatio="none"><polyline fill="none" stroke="currentColor" strokeWidth="3" points={pointString} className="text-zinc-400" />{points.map((point, index) => { const cx = pad + (point.x / Math.max(1, points.length - 1)) * (width - pad * 2); const cy = height - pad - ((point.value - min) / range) * (height - pad * 2); return <circle key={index} cx={cx} cy={cy} r="4" className="fill-white" />; })}</svg></div>; }
function formatScore(value: number) { return Number.isFinite(value) ? value.toFixed(1) : "0.0"; }
function formatDate(value: string | Date) { return new Date(value).toLocaleDateString(); }
function formatEventType(type: "GUILD_LEAGUE" | "EMPERIUM_OVERRUN") { return type === "GUILD_LEAGUE" ? "Guild League" : "Emperium Overrun"; }
function formatBattlefield(value: "BATTLEFIELD_1" | "BATTLEFIELD_2") { return value === "BATTLEFIELD_1" ? "Battlefield 1" : "Battlefield 2"; }
