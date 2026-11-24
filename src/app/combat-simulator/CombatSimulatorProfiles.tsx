"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

function levelOf(value: unknown): number | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const level = (value as Record<string, unknown>).level;
  return typeof level === "number" && Number.isInteger(level) && level >= 1 && level <= 200 ? level : undefined;
}

function memberLabel(member: Member) {
  return member.characterName || member.discordUsername || "Unnamed member";
}

export default function CombatSimulatorProfiles() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReady = useRef(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [attackerId, setAttackerId] = useState("");
  const [defenderId, setDefenderId] = useState("");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Starting combat simulator…");
  const [loading, setLoading] = useState(true);

  const attacker = useMemo(() => members.find((member) => member.id === attackerId) ?? null, [members, attackerId]);
  const defender = useMemo(() => members.find((member) => member.id === defenderId) ?? null, [members, defenderId]);

  useEffect(() => {
    let active = true;
    fetch("/api/combat-simulator/members")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load guild member profiles.");
        return response.json() as Promise<{ members: Member[] }>;
      })
      .then((data) => { if (active) setMembers(data.members); })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "Unable to load guild member profiles."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== "ro3-simulator") return;
      if (data.type === "RO3_SIMULATOR_READY") {
        iframeReady.current = true;
        setReady(true);
        setMessage("Combat simulator ready. Select a member profile to import.");
      } else if (data.type === "RO3_PROFILE_IMPORTED") {
        const role = data.role === "attacker" ? "Attacker" : "Defender";
        if (data.status === "applied") {
          setMessage(`${role} profile applied to simulator: ${(data.fields as string[] | undefined)?.join(", ") || "profile fields"}.`);
        } else {
          setMessage(`${role} profile was not applied: ${typeof data.reason === "string" ? data.reason : "No valid fields received."}`);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!ready || !iframeReady.current || !iframeRef.current?.contentWindow || !attacker) return;
    iframeRef.current.contentWindow.postMessage({
      source: "heimdall",
      type: "RO3_PROFILE_IMPORT",
      role: "attacker",
      stats: {
        hp: attacker.hp,
        patk: attacker.patk,
        matk: attacker.matk,
        pdef: attacker.pdef,
        mdef: attacker.mdef,
        level: levelOf(attacker.ro3Stats),
      },
    }, "*");
    setMessage(`Sending attacker profile: ${memberLabel(attacker)}…`);
  }, [attacker, ready]);

  useEffect(() => {
    if (!ready || !iframeReady.current || !iframeRef.current?.contentWindow || !defender) return;
    iframeRef.current.contentWindow.postMessage({
      source: "heimdall",
      type: "RO3_PROFILE_IMPORT",
      role: "defender",
      stats: { pdef: defender.pdef, mdef: defender.mdef },
    }, "*");
    setMessage(`Sending defender profile: ${memberLabel(defender)}…`);
  }, [defender, ready]);

  return <>
    <section className="grid gap-4 rounded-xl border border-white/10 bg-zinc-900/80 p-4 md:grid-cols-2">
      <label className="block"><span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Attacker profile</span><select value={attackerId} onChange={(event) => setAttackerId(event.target.value)} disabled={loading || members.length === 0 || !ready} className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white"><option value="">Manual build / no member preset</option>{members.map((member) => <option key={member.id} value={member.id}>{memberLabel(member)}{member.job ? ` · ${member.job}` : ""}</option>)}</select><p className="mt-1 text-xs text-zinc-500">Imports HP, PATK, MATK, PDEF and MDEF as final character-sheet values. Choose the matching job, skill and remaining build details manually.</p></label>
      <label className="block"><span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Defender profile</span><select value={defenderId} onChange={(event) => setDefenderId(event.target.value)} disabled={loading || members.length === 0 || !ready} className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white"><option value="">Use simulator's current target</option>{members.map((member) => <option key={member.id} value={member.id}>{memberLabel(member)}{member.job ? ` · ${member.job}` : ""}</option>)}</select><p className="mt-1 text-xs text-zinc-500">Imports the selected member's PDEF and MDEF into the target panel.</p></label>
      {(loading || !ready) && <p className="text-xs text-zinc-500 md:col-span-2">{loading ? "Loading active guild member profiles…" : "Waiting for the combat simulator to initialise…"}</p>}
      {message && <p aria-live="polite" className="text-xs text-cyan-200 md:col-span-2">{message}</p>}
    </section>
    <div className="min-h-[760px] flex-1 overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
      <iframe ref={iframeRef} title="RO3 community combat simulator" src="/api/combat-simulator/source" sandbox="allow-scripts allow-forms allow-modals" className="h-full min-h-[760px] w-full border-0" />
    </div>
  </>;
}
