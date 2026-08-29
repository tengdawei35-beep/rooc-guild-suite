import { createWorker, PSM } from "tesseract.js";
import sharp from "sharp";

export type RooStats = Record<string, string>;
type OcrWorker = Awaited<ReturnType<typeof createWorker>>;
type Roi = { x: number; y: number; width: number; height: number };

const LABELS: Record<string, string[]> = {
  patk: ["PATK"], matk: ["MATK"], hp: ["HP"],
  pdmgPercent: ["PDMG"], mdmgPercent: ["MDMG"],
  pdmgReductionPercent: ["PDMG.R", "PDMG R", "PDMG-R"],
  mdmgReductionPercent: ["MDMG.R", "MDMG R", "MDMG-R"],
  critRes: ["CRIT RES", "CRIT RES."],
  ignorePdef: ["IGNORE PDEF", "IGNORE P DEF", "IGNORE P-DEF", "LENORE PDEF"],
  ignoreMdef: ["IGNORE MDEF", "IGNORE M DEF", "IGNORE M-DEF", "LENORE MDEF"],
  pdmgBonus: ["PDMG BONUS", "P DMG BONUS"], mdmgBonus: ["MDMG BONUS", "M DMG BONUS"],
  pvpDamageReduction: ["PVP DMG REDUCTION", "PVP DMG RED", "P DMG RED", "2VP DMG RED", ">VP DMG RED", ">VP DMG REDU"],
  pvpDamageBonus: ["PVP DMG BONUS", "PVP DMG BON", "P DMG BONUS", "2VP DMG BONUS", ">VP DMG BONUS"],
  pveDamageReduction: ["PVE DMG REDUCTION", "PVE DMG RED", "VE DMG RED"],
  pveDamageBonus: ["PVE DMG BONUS", "PVE DMG BON"],
  damageVsSmall: ["DMG VS SMALL ENEMIES", "DMG VS SMALL"], damageReductionVsSmall: ["DMG REDUCTION VS SMALL ENEMIES", "DMG REDUCTION VS SMALL"],
  damageVsMedium: ["DMG VS MEDIUM ENEMIES", "DMG VS MEDIUM"], damageReductionVsMedium: ["DMG REDUCTION VS MEDIUM ENEMIES", "DMG REDUCTION VS MEDIUM"],
  damageVsLarge: ["DMG VS LARGE ENEMIES", "DMG VS LARGE"], damageReductionVsLarge: ["DMG REDUCTION VS LARGE MONSTERS", "DMG REDUCTION VS LARGE"],
  damageVsBrute: ["DMG VS BRUTE"], damageReductionVsBrute: ["DMG REDUCTION VS BRUTE"],
  damageVsDemiHuman: ["DMG VS DEMI-HUMAN", "DMG VS DEMIHUMAN"], damageReductionVsDemiHuman: ["DMG REDUCTION VS DEMI-HUMAN", "DMG REDUCTION VS DEMIHUMAN"],
  equipmentPdefPercent: ["EQUIPMENT PDEF"], equipmentMdefPercent: ["EQUIPMENT MDEF"]
};

function normalise(text: string) { return text.toUpperCase().replace(/[“”‘’]/g, "").replace(/\s+/g, " ").trim(); }
function repairNumber(text: string) { return text.replace(/,/g, "").replace(/[Oo]/g, "0").replace(/[Il|]/g, "1").trim(); }
function numberMatches(text: string) { return [...text.replace(/,/g, "").matchAll(/-?\d+(?:\.\d+)?%?/g)]; }
function escaped(alias: string) { return alias.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*"); }

/** Find a label and only inspect the value immediately following THAT occurrence.
 * This is important for lines such as `Ignore PDEF 3537 Ignore PDEF 0%` and
 * `PDMG 159.62% PDMG.R 98.05%`, where looking at the entire line gives the wrong result. */
function extractAfterAlias(line: string, alias: string) {
  const re = new RegExp(`(?:^|[^A-Z0-9])${escaped(alias)}(?=$|[^A-Z0-9])`, "ig");
  let match: RegExpExecArray | null;
  while ((match = re.exec(line))) {
    const start = match.index + match[0].length;
    const suffix = line.slice(start);
    const n = numberMatches(suffix)[0];
    if (n) return { value: repairNumber(n[0]), start, numberIndex: start + (n.index ?? 0) };
  }
  return null;
}

function extractLabelValues(text: string): RooStats {
  const result: RooStats = {};
  const lines = text.split(/\r?\n/).map(normalise).filter(Boolean);
  for (const line of lines) {
    for (const [field, aliases] of Object.entries(LABELS)) {
      for (const alias of aliases) {
        const found = extractAfterAlias(line, alias);
        if (!found) continue;
        const value = found.value;
        // Exact-label exclusions are based on the local label occurrence, never the rest of the line.
        if ((field === "patk" || field === "matk") && /REFINE\s+(?:PATK|MATK)/i.test(line.slice(0, found.start))) continue;
        if (field === "hp" && /HP\s+RECOVER/i.test(line.slice(0, found.start + 12))) continue;
        if ((field === "pdmgPercent" || field === "mdmgPercent") && /PDMG\s*\.\s*R|MDMG\s*\.\s*R/i.test(line.slice(found.start - 2, found.start + 4))) continue;
        if ((field === "pdmgReductionPercent" || field === "mdmgReductionPercent") && !/%$/.test(value)) continue;
        if ((field === "pdmgPercent" || field === "mdmgPercent") && !/%$/.test(value)) continue;
        if ((field === "equipmentPdefPercent" || field === "equipmentMdefPercent") && !/%$/.test(value)) continue;
        if ((field === "ignorePdef" || field === "ignoreMdef") && /%$/.test(value)) continue;
        result[field] = value.replace(/%$/, "");
        break;
      }
    }
  }
  return result;
}

async function preprocess(image: Buffer, mode: "normal" | "contrast" | "threshold") {
  let p = sharp(image).rotate().resize({ width: 2200, withoutEnlargement: false }).grayscale().normalize();
  if (mode === "contrast") p = p.linear(1.45, -40);
  if (mode === "threshold") p = p.linear(1.7, -70).threshold(200);
  return p.sharpen().png().toBuffer();
}

async function recognise(worker: OcrWorker, image: Buffer, psm: PSM, whitelist?: string) {
  await worker.setParameters({ tessedit_pageseg_mode: psm, ...(whitelist ? { tessedit_char_whitelist: whitelist } : {}), preserve_interword_spaces: "1", user_defined_dpi: "300" });
  return String((await worker.recognize(image)).data.text ?? "");
}

/** OCR the whole stat panel rather than a fixed ROI. The raw ROO OCR reliably
 * contains the PvP values, but the leading letters are sometimes mangled
 * (`>vP`, `2vP`, `P DMG`). Label-tolerant parsing lets us recover 2282/3145. */
function extractPvpFromText(texts: string[]) {
  const result: RooStats = {};
  const patterns: Array<[string, RegExp[]]> = [
    ["pvpDamageReduction", [/(?:PVP|[>2]VP|P)\s*DMG\s*RED(?:UCTION)?[^\d]{0,20}(\d{3,6})/i]],
    ["pvpDamageBonus", [/(?:PVP|[>2]VP|P)\s*DMG\s*BON(?:US)?[^\d]{0,20}(\d{3,6})/i]],
  ];
  for (const [field, regexes] of patterns) {
    const candidates: string[] = [];
    for (const text of texts) for (const re of regexes) { const m = normalise(text).match(re); if (m?.[1]) candidates.push(repairNumber(m[1])); }
    if (candidates.length) {
      const counts: Record<string, number> = {}; candidates.forEach(v => counts[v] = (counts[v] ?? 0) + 1);
      result[field] = [...new Set(candidates)].sort((a,b) => counts[b] - counts[a] || b.length - a.length)[0];
    }
  }
  return result;
}

export async function readRooStats(images: Buffer[]): Promise<{ stats: RooStats; rawText: string }> {
  if (!images.length) throw new Error("At least one screenshot is required.");
  if (images.length > 12) throw new Error("A maximum of 12 screenshots can be read at once.");
  const worker = await createWorker("eng", 1);
  const stats: RooStats = {};
  const raw: string[] = [];
  try {
    for (const image of images) {
      const variants = await Promise.all([preprocess(image, "normal"), preprocess(image, "contrast"), preprocess(image, "threshold")]);
      for (const variant of variants) {
        const text = await recognise(worker, variant, PSM.SINGLE_BLOCK);
        raw.push(text);
        Object.assign(stats, extractLabelValues(text));
      }
    }
    Object.assign(stats, extractPvpFromText(raw));
    // Equipment Notice values are absolute PDEF/MDEF, not the percentages shown elsewhere.
    const notice = raw.join("\n");
    const pdef = notice.match(/EQUIPMENT\s*PDEF\s*[:]?\s*(\d{2,6})(?!\s*%)/i);
    const mdef = notice.match(/EQUIPMENT\s*MDEF\s*[:]?\s*(\d{2,6})(?!\s*%)/i);
    if (pdef) stats.pdef = repairNumber(pdef[1]);
    if (mdef) stats.mdef = repairNumber(mdef[1]);
  } finally { await worker.terminate(); }
  return { stats, rawText: raw.join("\n") };
}

export default readRooStats;
