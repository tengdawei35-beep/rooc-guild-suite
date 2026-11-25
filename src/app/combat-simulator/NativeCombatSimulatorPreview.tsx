"use client";

import { useEffect, useMemo, useState } from "react";
import { useCombatSimulatorEngine } from "@/lib/ro3-combat-simulator/hooks/use-combat-simulator-engine";

type Member = {
  id: string;
  characterName: string | null;
  discordUsername: string | null;
  job: string | null;
  hp: number | null;
  patk: number | null;
  matk: number | null;
  pdef: number | null;
  mdef: number | null;
  ro3Stats: unknown;
};

const label = (member: Member) => member.characterName || member.discordUsername || "Unnamed member";
const levelOf = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const level = (value as Record<string, unknown>).level;
  return typeof level === "number" && Number.isInteger(level) && level >= 1 && level <= 200 ? level : null;
};

function ProfileCard({ title, value, onChange, members, kind }: {
  title: string;
  value: string;
  onChange: (id: string) => void;
  members: Member[];
  kind: "attacker" | "defender";
}) {
  const selected = members.find((member) => member.id === value) ?? null;
  const stats = kind === "attacker"
    ? [["Level", levelOf(selected?.ro3Stats)], ["HP", selected?.hp], ["P.ATK", selected?.patk], ["M.ATK", selected?.matk], ["P.DEF", selected?.pdef], ["M.DEF", selected?.mdef]]
    : [["P.DEF", selected?.pdef], ["M.DEF", selected?.mdef]];
  return <section className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{kind}</span>
    </div>
    <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white">
      <option value="">Manual / default simulator values</option>
      {members.map((member) => <option key={member.id} value={member.id}>{label(member)}{member.job ? ` · ${member.job}` : ""}</option>)}
    </select>
    {selected ? <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {stats.map(([name, stat]) => <div key={String(name)} className="rounded-lg bg-black/20 px-3 py-2">
        <dt className="text-[10px] uppercase tracking-wider text-zinc-500">{name}</dt>
        <dd className="mt-1 text-sm font-semibold tabular-nums text-zinc-100">{stat == null ? "—" : Number(stat).toLocaleString()}</dd>
      </div>)}
    </dl> : <p className="mt-3 text-xs text-zinc-500">No guild profile selected. Manual build controls will be available in the next migration phase.</p>}
  </section>;
}

export default function NativeCombatSimulatorPreview() {
  const engine = useCombatSimulatorEngine();
  const [members, setMembers] = useState<Member[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [attackerId, setAttackerId] = useState("");
  const [defenderId, setDefenderId] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/combat-simulator/members")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load guild member profiles.");
        return response.json() as Promise<{ members: Member[] }>;
      })
      .then((payload) => { if (active) setMembers(payload.members); })
      .catch((error: unknown) => { if (active) setProfilesError(error instanceof Error ? error.message : String(error)); })
      .finally(() => { if (active) setProfilesLoading(false); });
    return () => { active = false; };
  }, []);

  const selectedAttacker = useMemo(() => members.find((member) => member.id === attackerId) ?? null, [members, attackerId]);
  const selectedDefender = useMemo(() => members.find((member) => member.id === defenderId) ?? null, [members, defenderId]);

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-900/70 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Native engine status</p>
        <p className="mt-1 text-sm text-zinc-200">{engine.status === "ready" ? "Game data loaded · calculation engine ready" : engine.status === "error" ? "Engine failed to initialise" : "Loading exported game data…"}</p>
        {engine.error && <p className="mt-1 text-xs text-rose-300">{engine.error}</p>}
      </div>
      <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${engine.ready ? "bg-emerald-400/10 text-emerald-300" : engine.status === "error" ? "bg-rose-400/10 text-rose-300" : "bg-amber-400/10 text-amber-300"}`}>{engine.status}</span>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <ProfileCard title="Attacker profile" kind="attacker" value={attackerId} onChange={setAttackerId} members={members} />
      <ProfileCard title="Defender profile" kind="defender" value={defenderId} onChange={setDefenderId} members={members} />
    </div>
    <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
      <p className="text-sm font-medium text-zinc-200">Migration preview — profile contract</p>
      <p className="mt-1 text-xs leading-5 text-zinc-500">This isolated preview exercises native game-data loading and the existing guild-profile API. It does not replace the production iframe or claim calculation parity. The selected profile values are displayed for contract verification; the complete build editor, skill rotation and damage report are still being migrated.</p>
      {profilesLoading && <p className="mt-3 text-xs text-zinc-400">Loading active guild profiles…</p>}
      {profilesError && <p role="alert" className="mt-3 text-xs text-rose-300">{profilesError}</p>}
      {!profilesLoading && !profilesError && <p className="mt-3 text-xs text-zinc-400">{members.length} active guild profile{members.length === 1 ? "" : "s"} available. {selectedAttacker ? `Attacker: ${label(selectedAttacker)}.` : "No attacker preset selected."} {selectedDefender ? `Defender: ${label(selectedDefender)}.` : "No defender preset selected."}</p>}
    </div>
  </div>;
}
