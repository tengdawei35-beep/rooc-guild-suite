"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Skipped = { memberId: string; memberName: string | null; runId: string; eventDate: string | null };
type HistoricalRun = {
  runId: string;
  createdAt: string;
  eventDate: string | null;
  legacyIndexBefore: number | null;
  legacyIndexAfter: number | null;
  legacyStartMember: string | null;
  normalSelectedMembers: string[];
  skippedMembers: string[];
  correctedNextIndex: number | null;
  correctedNextMember: string | null;
};
type AuditResource = {
  resourceId: string;
  resourceName: string;
  currentIndex: number;
  currentNextMember: string | null;
  reconstructedIndex: number | null;
  reconstructedNextMember: string | null;
  indexMismatch: boolean;
  runsAudited: number;
  skippedMembers: Skipped[];
  historicalRuns: HistoricalRun[];
  latestRun: { id: string; createdAt: string; eventDate: string | null; rotationIndexBefore: number | null; rotationIndexAfter: number | null } | null;
};
type AuditResponse = { guild: { name: string }; generatedAt: string; eligibleMemberCount: number; resources: AuditResource[]; summary: { resourcesWithMismatch: number; skippedTurnCount: number }; error?: string };

export default function AllocationAuditPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/allocation/audit", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Failed to audit allocation rotation.");
        setData(payload);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to audit allocation rotation."));
  }, []);

  return <main className="min-h-screen bg-zinc-950 text-white"><div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8"><Link href="/allocation" className="text-sm text-zinc-500 hover:text-white">← Allocation</Link><header className="mb-6 mt-4"><p className="text-xs font-medium uppercase tracking-widest text-zinc-600">ROO Guild Suite</p><h1 className="text-2xl font-bold tracking-tight">Rotation Audit</h1><p className="mt-1 max-w-3xl text-sm text-zinc-500">Read-only reconstruction of historical rotation state after the previous implementation excluded reserved-pool members from the rotation.</p></header>{error&&<div className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</div>}{!data&&!error&&<div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-8 text-center text-sm text-zinc-500">Auditing allocation history…</div>}{data&&<><div className="grid gap-3 sm:grid-cols-3"><Summary label="Eligible members" value={data.eligibleMemberCount}/><Summary label="Skipped turns found" value={data.summary.skippedTurnCount}/><Summary label="Index mismatches" value={data.summary.resourcesWithMismatch}/></div><div className="mt-5 space-y-4">{data.resources.map(resource=><section key={resource.resourceId} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-semibold">{resource.resourceName}</h2><p className="mt-1 text-xs text-zinc-600">{resource.runsAudited} historical run{resource.runsAudited===1?"":"s"} audited</p></div><span className={`w-fit rounded-full border px-2.5 py-1 text-xs ${resource.indexMismatch?"border-amber-900 bg-amber-950/30 text-amber-400":"border-emerald-900 bg-emerald-950/30 text-emerald-400"}`}>{resource.indexMismatch?"Needs review":"No mismatch detected"}</span></div><div className="mt-4 grid gap-3 md:grid-cols-2"><Metric label="Current index" value={String(resource.currentIndex)}/><Metric label="Current next member" value={resource.currentNextMember??"—"}/><Metric label="Reconstructed index" value={resource.reconstructedIndex===null?"—":String(resource.reconstructedIndex)}/><Metric label="Correct next member" value={resource.reconstructedNextMember??"—"}/></div>{resource.historicalRuns.length>0&&<div className="mt-4"><h3 className="text-sm font-medium text-zinc-300">Run-by-run reconstruction</h3><div className="mt-2 space-y-2">{resource.historicalRuns.map((run,index)=><details key={run.runId} className="rounded-lg border border-zinc-800 bg-zinc-950"><summary className="cursor-pointer list-none px-3 py-3 text-xs text-zinc-400"><span className="text-zinc-200">Run {index+1}</span> · {formatDate(run.eventDate??run.createdAt)} · legacy {run.legacyIndexBefore??"—"} → {run.legacyIndexAfter??"—"} · corrected next {run.correctedNextIndex===null?"—":`${run.correctedNextIndex} — ${run.correctedNextMember??"Unnamed member"}`}</summary><div className="grid gap-3 border-t border-zinc-800 px-3 py-3 sm:grid-cols-2"><Metric label="Legacy start member" value={run.legacyStartMember??"—"}/><Metric label="Corrected next member" value={run.correctedNextMember??"—"}/><Metric label="Normal selected members" value={run.normalSelectedMembers.length?run.normalSelectedMembers.join(", "):"—"}/><Metric label="Skipped turns in run" value={run.skippedMembers.length?run.skippedMembers.join(", "):"None"}/></div></details>)}</div></div>}{resource.latestRun&&<div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-500">Latest audited run: <span className="text-zinc-300">{resource.latestRun.id}</span> · before {resource.latestRun.rotationIndexBefore??"—"} · after {resource.latestRun.rotationIndexAfter??"—"} · {formatDate(resource.latestRun.createdAt)}</div>}{resource.skippedMembers.length>0&&<div className="mt-4"><h3 className="text-sm font-medium text-zinc-300">Historical skipped turns</h3><div className="mt-2 flex flex-wrap gap-2">{resource.skippedMembers.map((member,index)=><span key={`${member.runId}-${member.memberId}-${index}`} className="rounded-full border border-amber-900/60 bg-amber-950/20 px-2.5 py-1 text-xs text-amber-300">{member.memberName??"Unnamed member"} · {formatDate(member.eventDate)}</span>)}</div></div>}{resource.runsAudited===0&&<p className="mt-4 text-xs text-zinc-600">No completed allocation history was found for this resource.</p>}</section>)}</div><p className="mt-5 text-xs text-zinc-700">Generated {formatDate(data.generatedAt)}. This audit does not modify RotationState or AllocationRun records.</p></>}</div></main>;
}

function Summary({label,value}:{label:string;value:number}){return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-600">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3"><p className="text-[11px] uppercase tracking-wider text-zinc-600">{label}</p><p className="mt-1 text-sm text-zinc-300">{value}</p></div>}
function formatDate(value:string|null){if(!value)return "—";const date=new Date(value);return Number.isNaN(date.getTime())?value:date.toLocaleString();}
