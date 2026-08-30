"use client";

import { useEffect, useState } from "react";

type Applicant = {
  id: string;
  discordUsername: string;
  discordUserId: string;
  characterName: string;
  job: string | null;
  status: "PENDING" | "ACCEPTED" | "DENIED";
  createdAt: string;
  pdef: number | null;
  mdef: number | null;
  pvpDamageBonus: number | null;
  pvpDamageReduction: number | null;
  pdmgPercent: number | null;
  mdmgPercent: number | null;
  pdmgReductionPercent: number | null;
  mdmgReductionPercent: number | null;
  critRes: number | null;
  ignorePdef: number | null;
  ignoreMdef: number | null;
  damageVsMedium: number | null;
  damageReductionVsMedium: number | null;
  damageVsSmall: number | null;
  damageReductionVsSmall: number | null;
  damageVsDemiHuman: number | null;
  damageReductionVsDemiHuman: number | null;
  damageVsBrute: number | null;
  damageReductionVsBrute: number | null;
  equipmentPdefPercent: number | null;
  equipmentMdefPercent: number | null;
  patk: number | null;
  matk: number | null;
  hp: number | null;
  comparison: {
    scores: { dpsScore: number; tankScore: number; pvpScore: number; dpsPercentile: number; tankPercentile: number; pvpPercentile: number; rawPdef: number; rawMdef: number };
    closest: { characterName: string | null; job: string | null; dpsScore: number; tankScore: number; pvpScore: number; dpsPercentile: number; tankPercentile: number; pvpPercentile: number } | null;
  } | null;
};

type Invite = { id: string; token: string; active: boolean; createdAt: string; revokedAt: string | null };
type ComparisonScores = NonNullable<Applicant["comparison"]>["scores"];

export default function ApplicantsClient({ canManage }: { canManage: boolean }) {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [expandedApplicantId, setExpandedApplicantId] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError("");
    try {
      const [applicationsResponse, invitesResponse] = await Promise.all([fetch("/api/guild/applicants"), fetch("/api/guild/applicants/invite")]);
      const applications = await applicationsResponse.json();
      const inviteData = await invitesResponse.json();
      if (!applicationsResponse.ok) throw new Error(applications.error ?? "Failed to load applicants.");
      if (!invitesResponse.ok) throw new Error(inviteData.error ?? "Failed to load application links.");
      setApplicants(applications.applicants ?? []); setInvites(inviteData.invites ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load applicants."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function generateInvite() {
    setBusy(true); setError("");
    try { const response = await fetch("/api/guild/applicants/invite", { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Failed to generate link."); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to generate link."); }
    finally { setBusy(false); }
  }

  async function revokeInvite(id: string) {
    if (!window.confirm("Revoke this application link? Existing applications remain available.")) return;
    setBusy(true); setError("");
    try { const response = await fetch(`/api/guild/applicants/invite?id=${encodeURIComponent(id)}`, { method: "DELETE" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Failed to revoke link."); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to revoke link."); }
    finally { setBusy(false); }
  }

  async function decide(id: string, decision: "ACCEPTED" | "DENIED") {
    const label = decision === "ACCEPTED" ? "accept" : "deny";
    if (!window.confirm(`Are you sure you want to ${label} this applicant?`)) return;
    setBusy(true); setError("");
    try { const response = await fetch("/api/guild/applicants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? `Failed to ${label} applicant.`); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : `Failed to ${label} applicant.`); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-zinc-950 p-6 text-white"><div className="mx-auto max-w-7xl py-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm uppercase tracking-widest text-zinc-500">Recruitment</p><h1 className="mt-2 text-3xl font-bold">Applicants</h1><p className="mt-2 text-zinc-400">Review ROO stats, projected guild percentiles and the closest current member.</p></div>{canManage && <button onClick={generateInvite} disabled={busy} className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-50">Generate application link</button>}</div>
    {error && <p className="mt-6 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}
    <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"><h2 className="font-semibold">Application links</h2><div className="mt-4 space-y-3">{invites.filter((invite) => invite.active).map((invite) => <div key={invite.id} className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:flex-row sm:items-center sm:justify-between"><code className="break-all text-sm text-zinc-300">{typeof window !== "undefined" ? `${window.location.origin}/apply/${invite.token}` : `/apply/${invite.token}`}</code>{canManage && <button onClick={() => revokeInvite(invite.id)} disabled={busy} className="rounded-lg border border-red-900 px-3 py-2 text-xs text-red-300 hover:bg-red-950">Revoke</button>}</div>)}{invites.filter((invite) => invite.active).length === 0 && <p className="text-sm text-zinc-500">No active application link.</p>}</div></section>
    <section className="mt-8 space-y-4">{loading ? <p className="text-zinc-500">Loading applicants…</p> : applicants.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500">No applications yet.</div> : applicants.map((applicant) => <article key={applicant.id} className={`rounded-2xl border bg-zinc-900 p-6 transition ${expandedApplicantId === applicant.id ? "border-zinc-600" : "border-zinc-800 hover:border-zinc-700"}`}>
      <button type="button" onClick={() => setExpandedApplicantId(expandedApplicantId === applicant.id ? null : applicant.id)} className="block w-full text-left">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold">{applicant.characterName}</h2><span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-semibold">{applicant.status}</span></div><p className="mt-2 text-sm text-zinc-500">{applicant.job ?? "Job not specified"} · {applicant.discordUsername} · {applicant.discordUserId}</p></div><span className="text-sm text-zinc-500">{expandedApplicantId === applicant.id ? "Hide details ↑" : "View details ↓"}</span></div>
      </button>
      {canManage && applicant.status === "PENDING" && <div className="mt-4 flex gap-2"><button onClick={() => decide(applicant.id, "ACCEPTED")} disabled={busy} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium hover:bg-emerald-600 disabled:opacity-50">Accept</button><button onClick={() => decide(applicant.id, "DENIED")} disabled={busy} className="rounded-lg border border-red-900 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950 disabled:opacity-50">Deny</button></div>}
      {expandedApplicantId === applicant.id && <div className="mt-6 space-y-4">
        {applicant.comparison && <div className="grid gap-4 lg:grid-cols-[1fr_1fr]"><ScorePanel title="Projected guild standing" scores={applicant.comparison.scores} /><div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5"><h3 className="font-semibold">Closest current member</h3>{applicant.comparison.closest ? <><p className="mt-3 text-lg font-medium">{applicant.comparison.closest.characterName ?? "Unnamed"}</p><p className="text-xs text-zinc-500">{applicant.comparison.closest.job ?? "Job not specified"}</p><div className="mt-4 grid grid-cols-3 gap-3 text-center"><Metric label="PvP" value={applicant.comparison.closest.pvpScore} /><Metric label="DPS" value={applicant.comparison.closest.dpsScore} /><Metric label="Tank" value={applicant.comparison.closest.tankScore} /></div></> : <p className="mt-3 text-sm text-zinc-500">No active guild members available for comparison.</p>}</div></div>}
        <StatsGrid applicant={applicant} />
      </div>}
    </article>)}</section>
  </div></main>;
}

function ScorePanel({ title, scores }: { title: string; scores: ComparisonScores }) { return <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5"><h3 className="font-semibold">{title}</h3><div className="mt-4 grid grid-cols-3 gap-3"><Metric label="PvP" value={scores.pvpScore} percentile={scores.pvpPercentile} /><Metric label="DPS" value={scores.dpsScore} percentile={scores.dpsPercentile} /><Metric label="Tank" value={scores.tankScore} percentile={scores.tankPercentile} /></div><p className="mt-4 text-xs text-zinc-500">RAW PDEF {scores.rawPdef.toFixed(2)} · RAW MDEF {scores.rawMdef.toFixed(2)}</p></div>; }

function StatsGrid({ applicant }: { applicant: Applicant }) {
  const sections = [
    {
      title: "Core Stats",
      items: [["PATK", applicant.patk], ["MATK", applicant.matk], ["HP", applicant.hp], ["PDEF", applicant.pdef], ["MDEF", applicant.mdef], ["Crit RES", applicant.critRes]],
    },
    {
      title: "PvP / Defense",
      items: [["PvP Damage Bonus", applicant.pvpDamageBonus], ["PvP Damage Reduction", applicant.pvpDamageReduction], ["Ignore PDEF", applicant.ignorePdef], ["Ignore MDEF", applicant.ignoreMdef], ["Equipment PDEF %", applicant.equipmentPdefPercent], ["Equipment MDEF %", applicant.equipmentMdefPercent]],
    },
    {
      title: "Damage Modifiers",
      items: [["Physical Damage %", applicant.pdmgPercent], ["Magic Damage %", applicant.mdmgPercent], ["Physical Damage Reduction %", applicant.pdmgReductionPercent], ["Magic Damage Reduction %", applicant.mdmgReductionPercent], ["Damage vs Medium", applicant.damageVsMedium], ["Reduction vs Medium", applicant.damageReductionVsMedium], ["Damage vs Small", applicant.damageVsSmall], ["Reduction vs Small", applicant.damageReductionVsSmall], ["Damage vs Demi-Human", applicant.damageVsDemiHuman], ["Reduction vs Demi-Human", applicant.damageReductionVsDemiHuman], ["Damage vs Brute", applicant.damageVsBrute], ["Reduction vs Brute", applicant.damageReductionVsBrute]],
    },
  ] as const;

  return <div className="grid gap-4 lg:grid-cols-3">{sections.map((section) => <div key={section.title} className="rounded-xl border border-zinc-800 bg-zinc-950 p-5"><h3 className="font-semibold">{section.title}</h3><div className="mt-4 grid grid-cols-2 gap-2">{section.items.map(([label, value]) => <div key={label} className="rounded-lg border border-zinc-800 px-3 py-2"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-sm font-semibold">{formatStat(value)}</p></div>)}</div></div>)}</div>;
}

function formatStat(value: number | null) {
  return value === null || value === undefined ? "—" : Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function Metric({ label, value, percentile }: { label: string; value: number; percentile?: number }) { return <div className="rounded-lg border border-zinc-800 p-3 text-center"><p className="text-xs uppercase text-zinc-500">{label}</p><p className="mt-1 text-lg font-bold">{value.toFixed(2)}</p>{percentile !== undefined && <p className="mt-1 text-xs text-zinc-400">{percentile.toFixed(1)}th percentile</p>}</div>; }
