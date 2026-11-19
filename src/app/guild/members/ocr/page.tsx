"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import OcrMemberImport from "./OcrMemberImport";
import { ROOC_JOBS, RO3_JOBS } from "@/lib/constants/jobs";

type Values = Record<string, string>;

const FIELDS = [
  ["characterName", "Character name"], ["job", "Job"], ["pdef", "PDEF"], ["mdef", "MDEF"], ["patk", "PATK"], ["matk", "MATK"], ["hp", "HP"],
  ["pvpDamageBonus", "PvP Damage Bonus"], ["pvpDamageReduction", "PvP Damage Reduction"], ["pdmgPercent", "Physical Damage %"], ["mdmgPercent", "Magic Damage %"],
  ["pdmgReductionPercent", "Physical Damage Reduction %"], ["mdmgReductionPercent", "Magic Damage Reduction %"], ["critRes", "Crit Resistance"], ["ignorePdef", "Ignore PDEF"], ["ignoreMdef", "Ignore MDEF"],
  ["damageVsMedium", "Damage vs Medium"], ["damageReductionVsMedium", "Damage Reduction vs Medium"], ["damageVsSmall", "Damage vs Small"], ["damageReductionVsSmall", "Damage Reduction vs Small"],
  ["damageVsDemiHuman", "Damage vs Demi-Human"], ["damageReductionVsDemiHuman", "Damage Reduction vs Demi-Human"], ["damageVsBrute", "Damage vs Brute"], ["damageReductionVsBrute", "Damage Reduction vs Brute"],
  ["equipmentPdefPercent", "Equipment PDEF %"], ["equipmentMdefPercent", "Equipment MDEF %"],
] as const;

const RO3_FIELDS = [
  ["characterName", "Character name"], ["job", "Job"], ["hp", "HP"], ["patk", "PATK"], ["matk", "MATK"], ["pdef", "PDEF"], ["mdef", "MDEF"],
  ["healingDonePercent", "Healing Done %"], ["critDamagePercent", "Crit Damage %"], ["critDamageReductionPercent", "Crit Damage Reduction %"],
  ["physicalDamageBonusPercent", "Physical Damage Bonus %"], ["physicalDamageReductionPercent", "Physical Damage Reduction %"],
  ["magicDamageBonusPercent", "Magic Damage Bonus %"], ["magicDamageReductionPercent", "Magic Damage Reduction %"],
  ["damageIncreasePercent", "Damage Increase %"], ["damageReductionPercent", "Damage Reduction %"],
  ["physicalPenetrationPercent", "Physical Penetration %"], ["magicPenetrationPercent", "Magic Penetration %"],
  ["damageVsAllJob", "Damage vs All Job"], ["damageReductionVsAllJob", "Reduction vs All Job"],
  ["damageVsMedium", "Damage vs Medium"], ["damageReductionVsMedium", "Reduction vs Medium"],
  ["bladeCrystal", "Blade Crystal"], ["shieldCrystal", "Shield Crystal"], ["manaCrystal", "Mana Crystal"], ["magicDefCrystal", "Magic DEF Crystal"],
] as const;
const NUMERIC_FIELDS = FIELDS.filter(([field]) => field !== "characterName" && field !== "job");
const RO3_NUMERIC_FIELDS = RO3_FIELDS.filter(([field]) => field !== "characterName" && field !== "job");

export default function MemberOcrPage() {
  const [gameType, setGameType] = useState<"ROOC" | "RO3">("ROOC");
  const activeFields = gameType === "RO3" ? RO3_FIELDS : FIELDS;
  const numericFields = gameType === "RO3" ? RO3_NUMERIC_FIELDS : NUMERIC_FIELDS;
  const jobs = gameType === "RO3" ? RO3_JOBS : ROOC_JOBS;
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [values, setValues] = useState<Values>({});
  const [discordUserId, setDiscordUserId] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const updateMode = Boolean(memberId);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("memberId");
    if (!id) {
      fetch("/api/guild/members", { cache: "no-store" }).then((r) => r.json()).then((data) => setGameType(data.gameType === "RO3" ? "RO3" : "ROOC")).catch(() => undefined);
      return;
    }
    setMemberId(id);
    fetch(`/api/guild/members/${id}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Failed to load member.");
        setGameType(data.gameType === "RO3" ? "RO3" : "ROOC");
        setMemberName(data.member?.characterName ?? null);
        setDiscordUserId(data.member?.discordUserId ?? "");
        setDiscordUsername(data.member?.discordUsername ?? "");
        const current: Values = {};
        const sourceStats = data.member?.ro3Stats ?? {};
        for (const [field] of (data.gameType === "RO3" ? RO3_FIELDS : FIELDS)) {
          const value = data.gameType === "RO3" ? (field === "characterName" || field === "job" ? data.member?.[field] : sourceStats[field]) : data.member?.[field];
          if (value !== null && value !== undefined) current[field] = String(value);
        }
        setValues(current);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Failed to load member."));
  }, []);

  function update(field: string, value: string) { setValues((current) => ({ ...current, [field]: value })); }

  function getMissingFields() {
    const missing: string[] = [];
    for (const [field, label] of activeFields) {
      if ((field === "characterName" || field === "job") && !(values[field] ?? "").trim()) missing.push(label);
    }
    return missing;
  }

  async function saveMember() {
    if (!memberId) return;
    const missing = getMissingFields();
    if (missing.length) {
      setMessage(`Please fill in: ${missing.join(", ")}.`);
      return;
    }
    setSaving(true); setMessage(null);
    try {
      const payload: Record<string, unknown> = gameType === "RO3" ? { job: values.job.trim(), ro3Stats: {} as Record<string, number> } : { job: values.job.trim() };
      for (const [field, label] of numericFields) {
        const value = (values[field] ?? "").trim();
        if (!value) continue;
        const normalized = value.replace(/,/g, "");
        const number = Number(normalized);
        if (!Number.isFinite(number) || number < 0) throw new Error(`${label} must be a valid non-negative number.`);
        if (gameType === "RO3" && ["bladeCrystal", "shieldCrystal", "manaCrystal", "magicDefCrystal"].includes(field) && number > 50) throw new Error(`${label} must be between 0 and 50.`);
        if (gameType === "RO3") (payload.ro3Stats as Record<string, number>)[field] = number; else payload[field] = number;
      }
      const response = await fetch(`/api/guild/members/${memberId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to update member stats.");
      setMessage("Stats and job updated successfully.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Failed to update member stats."); }
    finally { setSaving(false); }
  }

  async function createMember() {
    const missing = getMissingFields();
    if (missing.length) {
      setMessage(`Please fill in: ${missing.join(", ")}.`);
      return;
    }
    if (!values.characterName.trim() || !values.job.trim()) return;
    setSaving(true); setMessage(null);
    try {
      const payload: Record<string, unknown> = { ...(gameType === "RO3" ? { ro3Stats: {} as Record<string, number> } : {}), discordUserId: discordUserId.trim() || null, discordUsername: discordUsername.trim() || null, characterName: values.characterName.trim(), job: values.job.trim(), priority: "MEMBER", active: true, eligible: true };
      for (const [field, label] of numericFields) {
        const value = (values[field] ?? "").trim();
        if (!value) continue;
        const number = Number(value.replace(/,/g, ""));
        if (!Number.isFinite(number) || number < 0) throw new Error(`${label} must be a valid non-negative number.`);
        if (gameType === "RO3" && ["bladeCrystal", "shieldCrystal", "manaCrystal", "magicDefCrystal"].includes(field) && number > 50) throw new Error(`${label} must be between 0 and 50.`);
        if (gameType === "RO3") (payload.ro3Stats as Record<string, number>)[field] = number; else payload[field] = number;
      }
      const response = await fetch("/api/guild/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to create member.");
      setMessage(`Member ${data.member?.characterName ?? values.characterName} created successfully.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Failed to create member."); }
    finally { setSaving(false); }
  }

  const missingFields = getMissingFields();
  const canSave = !saving && missingFields.length === 0;

  return <main className="min-h-screen bg-zinc-950 text-white"><div className="mx-auto max-w-5xl px-6 py-10">
    <Link href="/guild/members" className="text-sm text-zinc-500 hover:text-white">← Guild Members</Link>
    <header className="mt-5 mb-8"><p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Member Management</p><h1 className="mt-1 text-3xl font-bold tracking-tight">{updateMode ? "Update Stats via OCR" : "Screenshot OCR"}</h1><p className="mt-2 max-w-2xl text-zinc-400">{updateMode ? `Upload your latest ${gameType} character-stat screenshots for ${memberName ?? "your character"}. Review every detected value before updating your profile.` : "Upload character-stat screenshots. Detected values are placed into an editable form so you can correct OCR mistakes before creating the member."}</p></header>
    {updateMode && <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5"><div className="mb-4"><h2 className="font-semibold">Member identity</h2><p className="mt-1 text-sm text-zinc-500">These details are loaded from your existing guild member profile and cannot be changed from the OCR updater.</p></div><div className="grid gap-4 sm:grid-cols-3"><ReadonlyField label="Discord User ID" value={discordUserId} /><ReadonlyField label="Discord Username" value={discordUsername} /><ReadonlyField label="Character Name" value={values.characterName ?? ""} /></div></section>}
    <OcrMemberImport gameType={gameType} onApply={(detected) => setValues((current) => ({ ...current, ...detected }))} />
    {Object.keys(values).length > 0 && <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5"><div className="mb-5"><h2 className="font-semibold">Review extracted stats</h2><p className="mt-1 text-sm text-zinc-500">Review the extracted values. OCR is an assistant, not an authority.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!updateMode && <><label className="text-sm text-zinc-400">Discord User ID<input value={discordUserId} onChange={(e) => setDiscordUserId(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none" /></label><label className="text-sm text-zinc-400">Discord Username<input value={discordUsername} onChange={(e) => setDiscordUsername(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none" /></label></>}
        {activeFields.map(([field, label]) => <label key={field} className="text-sm text-zinc-400">{label}{field === "job" ? <select required value={values[field] ?? ""} onChange={(e) => update(field, e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none"><option value="">Select job</option>{jobs.map((job) => <option key={job} value={job}>{job}</option>)}</select> : <input required value={values[field] ?? ""} onChange={(e) => update(field, e.target.value)} inputMode={field === "characterName" ? "text" : "decimal"} readOnly={updateMode && field === "characterName"} className={`mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none ${updateMode && field === "characterName" ? "cursor-not-allowed opacity-60" : ""}`} />}</label>)}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3"><button type="button" onClick={updateMode ? saveMember : createMember} disabled={!canSave} className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Saving…" : updateMode ? "Update stats" : "Create member"}</button>{message && <p className="text-sm text-zinc-400">{message}</p>}</div>
    </section>}
    <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-sm text-zinc-400"><strong className="text-zinc-200">Tip:</strong> Use screenshots where the stat labels and values are sharp and unobstructed. Multiple screenshots can be uploaded to combine different stat pages.</div>
  </div></main>;
}
function ReadonlyField({ label, value }: { label: string; value: string }) { return <label className="text-sm text-zinc-400">{label}<input value={value || "—"} readOnly className="mt-1 w-full cursor-not-allowed rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-zinc-300 outline-none" /></label>; }
