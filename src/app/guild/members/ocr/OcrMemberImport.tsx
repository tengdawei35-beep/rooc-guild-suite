"use client";

import { useState } from "react";
import { createWorker } from "tesseract.js";

const FIELD_LABELS: Record<string, string[]> = {
  characterName: ["character name", "name"],
  job: ["job", "class"],
  pdef: ["physical defense", "pdef"],
  mdef: ["magic defense", "mdef"],
  pvpDamageBonus: ["pvp damage bonus"],
  pvpDamageReduction: ["pvp damage reduction"],
  pdmgReductionPercent: ["physical damage reduction", "p dmg reduction"],
  mdmgReductionPercent: ["magic damage reduction", "m dmg reduction"],
  pdmgPercent: ["physical damage", "p dmg"],
  mdmgPercent: ["magic damage", "m dmg"],
  critRes: ["critical resistance", "crit res"],
  ignorePdef: ["ignore physical defense", "ignore pdef"],
  ignoreMdef: ["ignore magic defense", "ignore mdef"],
  damageReductionVsDemiHuman: ["damage reduction vs demi-human", "damage reduction vs demihuman"],
  damageVsDemiHuman: ["damage vs demi-human", "damage vs demihuman"],
  damageReductionVsMedium: ["damage reduction vs medium"],
  damageVsMedium: ["damage vs medium"],
  damageReductionVsSmall: ["damage reduction vs small"],
  damageVsSmall: ["damage vs small"],
  damageReductionVsBrute: ["damage reduction vs brute"],
  damageVsBrute: ["damage vs brute"],
  equipmentPdefPercent: ["equipment pdef", "equipment pdef %"],
  equipmentMdefPercent: ["equipment mdef", "equipment mdef %"],
  patk: ["physical attack", "patk"],
  matk: ["magic attack", "matk"],
  hp: ["health points", "hp"],
};

const NUMERIC_FIELDS = new Set(Object.keys(FIELD_LABELS).filter((key) => key !== "characterName" && key !== "job"));
type Extracted = Record<string, string>;

function normalise(value: string) {
  return value.toLowerCase().replace(/\./g, "").replace(/[|]/g, "").replace(/\s+/g, " ").trim();
}

function extractFields(text: string): Extracted {
  const lines = text.split(/\r?\n/).map(normalise).filter(Boolean);
  const result: Extracted = {};

  for (const line of lines) {
    const candidates = Object.entries(FIELD_LABELS).flatMap(([field, labels]) => labels.map((label) => ({ field, label }))).sort((a, b) => b.label.length - a.label.length);
    for (const { field, label } of candidates) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = line.match(new RegExp(`(?:^|\\s)${escaped}\\s*[:=-]\\s*(.+)$`));
      if (!match) continue;

      const after = match[1].trim();
      if (!after) continue;
      if (NUMERIC_FIELDS.has(field)) {
        const number = after.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
        if (number) result[field] = number[0];
      } else {
        result[field] = after;
      }
      break;
    }
  }

  return result;
}

export default function OcrMemberImport({ onApply }: { onApply: (values: Extracted) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [fields, setFields] = useState<Extracted>({});

  async function runOcr() {
    if (!files.length) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const worker = await createWorker("eng", 1, {
        logger: (message) => {
          if (typeof message.progress === "number") setProgress(Math.round(message.progress * 100));
        },
      });
      const results: string[] = [];
      for (const file of files) {
        const result = await worker.recognize(file);
        results.push(result.data.text);
      }
      await worker.terminate();
      const combined = results.join("\n");
      const extracted = extractFields(combined);
      setText(combined);
      setFields(extracted);
      onApply(extracted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
      <div>
        <h3 className="font-semibold text-white">Import stats from screenshots</h3>
        <p className="mt-1 text-sm text-zinc-400">Upload one or more clear game-stat screenshots. OCR runs locally in your browser, then fills the matching member fields.</p>
      </div>
      <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700" />
      {files.length > 0 && <p className="text-xs text-zinc-500">{files.length} screenshot{files.length === 1 ? "" : "s"} selected.</p>}
      <button type="button" onClick={runOcr} disabled={busy || !files.length} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40">{busy ? `Reading screenshots… ${progress}%` : "Read screenshots"}</button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {Object.keys(fields).length > 0 && <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-4"><p className="text-sm font-medium text-emerald-300">Detected {Object.keys(fields).length} fields. Review and correct the values below before creating the member.</p></div>}
      {text && <details><summary className="cursor-pointer text-xs text-zinc-500">Show raw OCR text</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-900 p-3 text-xs text-zinc-500">{text}</pre></details>}
    </div>
  );
}
