"use client";

import { useMemo, useState } from "react";

const FIELDS = [
  ["pdef", "PDEF"], ["mdef", "MDEF"], ["patk", "PATK"], ["matk", "MATK"], ["hp", "HP"],
  ["pvpDamageBonus", "PVP Damage Bonus"], ["pvpDamageReduction", "PVP Damage Reduction"],
  ["pdmgPercent", "PDMG"], ["mdmgPercent", "MDMG"], ["pdmgReductionPercent", "PDMG.R"], ["mdmgReductionPercent", "MDMG.R"],
  ["critRes", "CRIT RES"], ["ignorePdef", "Ignore PDEF"], ["ignoreMdef", "Ignore MDEF"],
  ["damageVsSmall", "Damage vs Small"], ["damageReductionVsSmall", "Reduction vs Small"],
  ["damageVsMedium", "Damage vs Medium"], ["damageReductionVsMedium", "Reduction vs Medium"],
  ["damageVsBrute", "Damage vs Brute"], ["damageReductionVsBrute", "Reduction vs Brute"],
  ["damageVsDemiHuman", "Damage vs Demi-Human"], ["damageReductionVsDemiHuman", "Reduction vs Demi-Human"],
  ["equipmentPdefPercent", "Equipment PDEF %"], ["equipmentMdefPercent", "Equipment MDEF %"],
] as const;

type Field = typeof FIELDS[number][0];
type Stats = Record<Field, string>;
type Existing = { id: string; characterName: string; job: string | null } & Partial<Record<Field, number | string | null>>;

function emptyStats(existing?: Existing | null): Stats {
  return Object.fromEntries(FIELDS.map(([key]) => [key, existing?.[key] == null ? "" : String(existing[key])])) as Stats;
}

export default function ApplicantApplyClient({ token, discordUserId, discordUsername, existingApplication }: { token: string; guildId: string; discordUserId: string; discordUsername: string; existingApplication: Existing | null }) {
  const [characterName, setCharacterName] = useState(existingApplication?.characterName ?? "");
  const [job, setJob] = useState(existingApplication?.job ?? "");
  const [stats, setStats] = useState<Stats>(() => emptyStats(existingApplication));
  const [files, setFiles] = useState<File[]>([]);
  const [rawText, setRawText] = useState("");
  const [reading, setReading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const rawPdef = useMemo(() => {
    const absolute = Number(stats.pdef || 0);
    const percent = Number(stats.equipmentPdefPercent || 0) / 100;
    return percent <= -1 ? 0 : absolute / (1 + percent);
  }, [stats.pdef, stats.equipmentPdefPercent]);

  async function readScreenshots() {
    if (!files.length) return setError("Select at least one screenshot first.");
    setReading(true); setError(""); setMessage("");
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("images", file));
      const response = await fetch(`/api/apply/${token}/ocr`, { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "OCR failed.");
      setStats((current) => ({ ...current, ...Object.fromEntries(Object.entries(data.stats ?? {}).map(([key, value]) => [key, String(value)])) }));
      setRawText(data.rawText ?? "");
      setMessage("OCR complete. Review every field before submitting.");
    } catch (err) { setError(err instanceof Error ? err.message : "OCR failed."); }
    finally { setReading(false); }
  }

  async function submit() {
    if (!characterName.trim() || !job.trim()) return setError("Character Name and Job are required.");
    setSubmitting(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/apply/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId: existingApplication?.id, characterName: characterName.trim(), job: job.trim(), ...stats }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Application failed.");
      setMessage("Application submitted successfully. Guild officers can now review your stats.");
    } catch (err) { setError(err instanceof Error ? err.message : "Application failed."); }
    finally { setSubmitting(false); }
  }

  return <main className="min-h-screen bg-zinc-950 p-6 text-white"><div className="mx-auto max-w-6xl py-8"><header className="mb-8"><p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Guild Application</p><h1 className="mt-2 text-3xl font-bold">Apply to the guild</h1><p className="mt-2 text-zinc-400">Your Discord identity is verified. Upload your ROO screenshots and review the OCR results before submitting.</p></header><section className="mb-6 grid gap-4 md:grid-cols-3"><Info label="Discord User ID" value={discordUserId} /><Info label="Discord Username" value={discordUsername} /><Info label="RAW PDEF" value={rawPdef.toFixed(2)} /></section><section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"><div className="grid gap-4 md:grid-cols-2"><label className="text-sm text-zinc-400">Character Name<input value={characterName} onChange={(e) => setCharacterName(e.target.value)} className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" /></label><label className="text-sm text-zinc-400">Job<input value={job} onChange={(e) => setJob(e.target.value)} placeholder="e.g. High Wizard" className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" /></label></div><div className="mt-8 border-t border-zinc-800 pt-6"><h2 className="font-semibold">ROO screenshots</h2><p className="mt-1 text-sm text-zinc-500">Up to 12 images, 8 MB each.</p><input className="mt-4 block w-full text-sm text-zinc-400" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} /><button onClick={readScreenshots} disabled={reading} className="mt-4 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-50">{reading ? "Reading screenshots…" : "Read screenshots"}</button></div><div className="mt-8 border-t border-zinc-800 pt-6"><div className="flex items-center justify-between"><h2 className="font-semibold">Review stats</h2><span className="text-xs text-zinc-500">Edit any OCR result before submitting.</span></div><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{FIELDS.map(([key, label]) => <label key={key} className="text-xs text-zinc-500">{label}<input value={stats[key]} onChange={(e) => setStats((current) => ({ ...current, [key]: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white" /></label>)}</div></div>{rawText && <details className="mt-6 border-t border-zinc-800 pt-6"><summary className="cursor-pointer text-sm text-zinc-400">Show raw OCR output</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-950 p-4 text-xs text-zinc-500">{rawText}</pre></details>}{error && <p className="mt-6 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}{message && <p className="mt-6 rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-300">{message}</p>}<div className="mt-8 flex justify-end border-t border-zinc-800 pt-6"><button onClick={submit} disabled={submitting} className="rounded-lg bg-white px-5 py-3 font-medium text-black disabled:opacity-50">{submitting ? "Submitting…" : "Submit application"}</button></div></section></div></main>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-1 truncate text-sm text-zinc-200">{value}</p></div>; }
