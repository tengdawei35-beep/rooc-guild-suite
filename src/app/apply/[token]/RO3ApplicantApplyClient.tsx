"use client";

import { useState } from "react";
import { RO3_JOBS, RO3_NUMERIC_STATS, RO3_SPECIAL_DISH_SLOTS, RO3_DEFAULT_SPECIAL_DISH_LABELS } from "@/lib/games/ro3";

type Props = { token:string; discordUserId:string; discordUsername:string; existingApplication: { characterName:string; job:string|null; status?: "PENDING"|"ACCEPTED"|"DENIED"; payload?: Record<string,unknown>|null } | null };
const statsKeys=[...RO3_NUMERIC_STATS.map(s=>s.key),...RO3_SPECIAL_DISH_SLOTS.map(s=>s.key)];
export default function RO3ApplicantApplyClient({token,discordUserId,discordUsername,existingApplication}:Props){
 const payload=existingApplication?.payload??{};
 const savedStats=(payload.stats&&typeof payload.stats==="object"?payload.stats:{}) as Record<string,number>;
 const [name,setName]=useState(existingApplication?.characterName??String(payload.characterName??""));
 const [job,setJob]=useState(existingApplication?.job??String(payload.job??""));
 const [stats,setStats]=useState<Record<string,string>>(()=>Object.fromEntries(statsKeys.map(k=>[k,savedStats[k]===undefined?"":String(savedStats[k])])));
 const [remarks,setRemarks]=useState(String(payload.remarks??""));
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const locked=existingApplication?.status==="ACCEPTED";
 async function submit(){setError("");setMessage("");if(!name.trim()||!job)return setError("Character name and job are required.");if(statsKeys.some(k=>stats[k]===undefined||stats[k].trim()===""))return setError("Please complete all character stats and Special Dish values.");setBusy(true);
 try{const response=await fetch("/api/apply/"+token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({characterName:name,job,stats:Object.fromEntries(Object.entries(stats).map(([k,v])=>[k,Number(v)])),remarks})});const data=await response.json();if(!response.ok)throw new Error(data.error??"Application submission failed.");setMessage("Application submitted successfully.");}
 catch(e){setError(e instanceof Error?e.message:"Submission failed.");}finally{setBusy(false);}}
 return <main className="min-h-screen bg-zinc-950 p-6 text-white"><div className="mx-auto max-w-5xl py-8"><header className="mb-8"><p className="text-sm uppercase tracking-widest text-zinc-500">RO3 Guild Application</p><h1 className="mt-2 text-3xl font-bold">Apply to the guild</h1><p className="mt-2 text-zinc-400">Discord identity verified. Submit your RO3 character information.</p></header>
 <section className="mb-6 grid gap-4 md:grid-cols-2"><Info label="Discord User ID" value={discordUserId}/><Info label="Discord Username" value={discordUsername}/></section>
 {existingApplication?.status&&<div className="mb-5 rounded-xl border border-zinc-700 p-4">Application status: <strong>{existingApplication.status}</strong></div>}
 <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"><div className="grid gap-4 md:grid-cols-2"><Field label="Character Name"><input disabled={locked} value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="Job"><select disabled={locked} value={job} onChange={e=>setJob(e.target.value)}><option value="">Select job…</option>{RO3_JOBS.map(j=><option key={j}>{j}</option>)}</select></Field></div>
 <h2 className="mt-8 border-t border-zinc-800 pt-6 font-semibold">Character Stats</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{RO3_NUMERIC_STATS.map(s=><Field key={s.key} label={s.label+(s.kind==="percentage"?" (%)":"")}><input type="number" step="any" disabled={locked} value={stats[s.key]??""} onChange={e=>setStats(v=>({...v,[s.key]:e.target.value}))}/></Field>)}</div>
 <h2 className="mt-8 border-t border-zinc-800 pt-6 font-semibold">Special Dishes</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{RO3_SPECIAL_DISH_SLOTS.map(s=><Field key={s.key} label={RO3_DEFAULT_SPECIAL_DISH_LABELS[s.key]}><input type="number" min="0" max="50" step="1" disabled={locked} value={stats[s.key]??""} onChange={e=>setStats(v=>({...v,[s.key]:e.target.value}))}/></Field>)}</div>
 <Field label="Remarks"><textarea disabled={locked} value={remarks} onChange={e=>setRemarks(e.target.value)} rows={3}/></Field>
 {error&&<p className="mt-5 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}{message&&<p className="mt-5 rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-300">{message}</p>}
 <div className="mt-8 flex justify-end border-t border-zinc-800 pt-6"><button disabled={locked||busy} onClick={submit} className="rounded-lg bg-white px-5 py-3 font-medium text-black disabled:opacity-50">{busy?"Submitting…":"Submit application"}</button></div></section></div></main>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block text-sm text-zinc-400">{label}{children&&<div className="mt-1">{children}</div>}{/* style inputs through wrapper selector */}<style jsx>{`input,select,textarea{width:100%;border:1px solid #3f3f46;background:#09090b;color:white;border-radius:8px;padding:8px 12px;}`}</style></label>}
function Info({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-1 truncate text-sm text-zinc-200">{value}</p></div>}
