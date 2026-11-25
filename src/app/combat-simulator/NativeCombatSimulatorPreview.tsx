"use client";

import { useEffect, useMemo, useState } from "react";
import { useCombatSimulatorEngine } from "@/lib/ro3-combat-simulator/hooks/use-combat-simulator-engine";
import type { CombatBuild, CombatDefender, CombatRotationResult } from "@/lib/ro3-combat-simulator/types";
import { validateCombatInput } from "@/lib/ro3-combat-simulator/validate-input.mjs";

type Member = {
  id: string; characterName: string | null; discordUsername: string | null; job: string | null;
  hp: number | null; patk: number | null; matk: number | null; pdef: number | null; mdef: number | null; ro3Stats: unknown;
};
const label = (m: Member) => m.characterName || m.discordUsername || "Unnamed member";
const levelOf = (v: unknown) => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const n = (v as Record<string, unknown>).level;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 200 ? n : null;
};
const numeric = (value: string, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const inputClass = "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white";
const statNames = ["STR", "AGI", "VIT", "INT", "DEX", "LUK"];

function ProfileCard({ title, kind, value, onChange, members }: {
  title: string; kind: "attacker" | "defender"; value: string; onChange: (v: string) => void; members: Member[];
}) {
  const selected = members.find((m) => m.id === value) ?? null;
  const stats = kind === "attacker"
    ? [["HP", selected?.hp], ["P.ATK", selected?.patk], ["M.ATK", selected?.matk], ["P.DEF", selected?.pdef], ["M.DEF", selected?.mdef], ["Level", levelOf(selected?.ro3Stats)]]
    : [["P.DEF", selected?.pdef], ["M.DEF", selected?.mdef]];
  return <section className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
    <h2 className="text-sm font-semibold text-white">{title}</h2>
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      <option value="">Manual / default values</option>
      {members.map((m) => <option key={m.id} value={m.id}>{label(m)}{m.job ? ` · ${m.job}` : ""}</option>)}
    </select>
    {selected && <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{stats.map(([k,v]) => <div key={String(k)} className="rounded-lg bg-black/20 px-3 py-2"><dt className="text-[10px] uppercase text-zinc-500">{k}</dt><dd className="text-sm font-semibold text-zinc-100">{v == null ? "—" : Number(v).toLocaleString()}</dd></div>)}</dl>}
    <p className="mt-2 text-xs text-zinc-500">Profile preview only. Values are not silently converted into simulator equipment or attributes.</p>
  </section>;
}

export default function NativeCombatSimulatorPreview() {
  const engine = useCombatSimulatorEngine();
  const [members, setMembers] = useState<Member[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [attackerId, setAttackerId] = useState("");
  const [defenderId, setDefenderId] = useState("");
  const [level, setLevel] = useState("100");
  const [stats, setStats] = useState(["80","60","50","20","80","20"]);
  const [def, setDef] = useState("5000");
  const [mdef, setMdef] = useState("3000");
  const [targetLevel, setTargetLevel] = useState("100");
  const [element, setElement] = useState("1");
  const [race, setRace] = useState("1");
  const [size, setSize] = useState("2");
  const [skillIds, setSkillIds] = useState("");
  const [duration, setDuration] = useState("30000");
  const [result, setResult] = useState<CombatRotationResult | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [runCount, setRunCount] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/combat-simulator/members").then(async (r) => {
      if (!r.ok) throw new Error("Unable to load guild member profiles.");
      return r.json() as Promise<{members: Member[]}>;
    }).then((v) => { if (active) setMembers(v.members); })
      .catch((e: unknown) => { if (active) setProfilesError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (active) setProfilesLoading(false); });
    return () => { active = false; };
  }, []);

  const attacker = useMemo<CombatBuild>(() => ({
    career: 1410, level: numeric(level,100), stats: stats.map((v) => numeric(v,1)) as CombatBuild["stats"],
  }), [level, stats]);
  const defender = useMemo<CombatDefender>(() => ({
    name: "Training target", level: numeric(targetLevel,100), def: numeric(def,0), mdef: numeric(mdef,0),
    element: numeric(element,1), race: numeric(race,1), size: numeric(size,2),
  }), [targetLevel,def,mdef,element,race,size]);

  function runSimulation() {
    setSimulationError(null); setResult(null);
    try {
      const validated = validateCombatInput({
        level, stats, defenderLevel: targetLevel, pdef: def, mdef,
        element, race, size, durationMs: duration, skillIds,
      });
      const validatedAttacker: CombatBuild = {
        career: 1410, level: validated.level, stats: validated.stats,
      };
      const validatedDefender: CombatDefender = {
        name: "Training target", level: validated.defenderLevel,
        def: validated.pdef, mdef: validated.mdef, element: validated.element,
        race: validated.race, size: validated.size,
      };
      const output = engine.simulate(
        validatedAttacker, validatedDefender, validated.skillIds, validated.durationMs,
      );
      setResult(output); setRunCount((n) => n + 1);
    } catch (e) { setSimulationError(e instanceof Error ? e.message : String(e)); }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-900/70 p-4">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Native engine</p><p className="mt-1 text-sm text-zinc-200">{engine.ready ? "Full exported game data loaded" : engine.status === "error" ? "Engine initialisation failed" : "Loading exported game data…"}</p>{engine.error && <p className="mt-1 text-xs text-rose-300">{engine.error}</p>}</div>
      <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${engine.ready ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>{engine.status}</span>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <ProfileCard title="Attacker guild profile" kind="attacker" value={attackerId} onChange={setAttackerId} members={members}/>
      <ProfileCard title="Defender guild profile" kind="defender" value={defenderId} onChange={setDefenderId} members={members}/>
    </div>
    <section className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Attacker build · Royal Guard</h2><p className="mt-1 text-xs text-zinc-500">Uses the simulator's existing Royal Guard career record (1410). No separate DPS career is introduced.</p></div><span className="text-xs text-zinc-500">Native build inputs</span></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-zinc-400">Career<select disabled value="1410" className={inputClass}><option value="1410">Royal Guard</option></select></label>
        <label className="text-xs text-zinc-400">Character level<input type="number" min="1" max="200" value={level} onChange={(e)=>setLevel(e.target.value)} className={inputClass}/></label>
        {statNames.map((name,i)=><label key={name} className="text-xs text-zinc-400">{name}<input type="number" min="1" max="99" value={stats[i]} onChange={(e)=>setStats((old)=>old.map((v,j)=>j===i?e.target.value:v))} className={inputClass}/></label>)}
      </div>
    </section>
    <section className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
      <h2 className="text-sm font-semibold text-white">Defender configuration</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs text-zinc-400">Level<input type="number" min="1" max="200" value={targetLevel} onChange={(e)=>setTargetLevel(e.target.value)} className={inputClass}/></label>
        <label className="text-xs text-zinc-400">P.DEF<input type="number" min="0" value={def} onChange={(e)=>setDef(e.target.value)} className={inputClass}/></label>
        <label className="text-xs text-zinc-400">M.DEF<input type="number" min="0" value={mdef} onChange={(e)=>setMdef(e.target.value)} className={inputClass}/></label>
        <label className="text-xs text-zinc-400">Element ID<input type="number" min="0" value={element} onChange={(e)=>setElement(e.target.value)} className={inputClass}/></label>
        <label className="text-xs text-zinc-400">Race ID<input type="number" min="0" value={race} onChange={(e)=>setRace(e.target.value)} className={inputClass}/></label>
        <label className="text-xs text-zinc-400">Size ID<input type="number" min="0" value={size} onChange={(e)=>setSize(e.target.value)} className={inputClass}/></label>
      </div>
    </section>
    <section className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
      <h2 className="text-sm font-semibold text-white">Skill rotation</h2>
      <p className="mt-1 text-xs text-zinc-500">Enter simulator SkillConfig IDs in cast order. Leave empty to simulate the character's normal attack only.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px]"><label className="text-xs text-zinc-400">Skill IDs<input value={skillIds} onChange={(e)=>setSkillIds(e.target.value)} placeholder="e.g. 1100110, 1100210" className={inputClass}/></label><label className="text-xs text-zinc-400">Duration (ms)<input type="number" min="1000" max="300000" step="1000" value={duration} onChange={(e)=>setDuration(e.target.value)} className={inputClass}/></label></div>
      <button type="button" disabled={!engine.ready} onClick={runSimulation} className="mt-4 rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40">{engine.ready ? "Run native simulation" : "Engine loading…"}</button>
      {simulationError && <p role="alert" className="mt-3 text-sm text-rose-300">{simulationError}</p>}
    </section>
    {result && <section aria-live="polite" className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold text-white">Native damage report</h2><p className="mt-1 text-xs text-zinc-500">Run {runCount} · {result.durationMs.toLocaleString()} ms · Software simulator output only</p></div><span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs text-amber-200">Not live-game verified</span></div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {([["Expected damage",result.totalExpectedDamage],["Sustained DPS",result.sustainedDps],["Burst 5s DPS",result.burst5sDps],["Skill casts",result.casts],["Auto swings",result.autoSwings],["Ground ticks",result.groundTicks]] as [string,number][]).map(([k,v])=><div key={k} className="rounded-lg bg-zinc-950/70 p-3"><p className="text-[10px] uppercase tracking-wide text-zinc-500">{k}</p><p className="mt-1 text-lg font-semibold tabular-nums text-white">{Number(v).toLocaleString(undefined,{maximumFractionDigits:2})}</p></div>)}
      </div>
      <details className="mt-4"><summary className="cursor-pointer text-xs font-medium text-zinc-300">Cast timeline ({result.castLog.length} entries)</summary><div className="mt-2 max-h-72 overflow-auto rounded-lg bg-zinc-950/70 p-3"><pre className="whitespace-pre-wrap break-all text-[11px] text-zinc-400">{JSON.stringify(result.castLog,null,2)}</pre></div></details>
    </section>}
    <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4 text-xs leading-5 text-zinc-500">
      {profilesLoading ? "Loading active guild profiles…" : profilesError ? profilesError : `${members.length} active guild profiles available.`}
      <p className="mt-1">Selected guild profiles are currently reference-only. Full profile-to-build mapping, equipment/card/talent controls, and saved-build migration remain separate tasks. The production iframe is untouched.</p>
    </div>
  </div>;
}
