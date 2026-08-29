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
  pveDamageReduction: ["PVE DMG REDUCTION", "PVE DMG RED", "VE DMG RED"], pveDamageBonus: ["PVE DMG BONUS", "PVE DMG BON"],
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
        const before = line.slice(0, found.start);
        if ((field === "patk" || field === "matk") && /REFINE\s+(?:PATK|MATK)/i.test(before)) continue;
        if (field === "hp" && /HP\s+RECOVER/i.test(before)) continue;
        if ((field === "pdmgPercent" || field === "mdmgPercent") && /(?:PDMG|MDMG)\s*\.\s*R/i.test(line.slice(found.start - 2, found.start + 4))) continue;
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

function extractPvpFromText(texts: string[]) {
  const result: RooStats = {};
  const reductionPatterns = [
    /(?:PVP|2VP|>VP|\?VP)\s*DMG\s*RED(?:UCTION|U)?[^0-9]{0,24}(\d{3,6})/i,
    /[>2]?V?P\s*DMG\s*RED[^0-9]{0,24}(\d{3,6})/i,
  ];
  const bonusPatterns = [
    /(?:PVP|2VP|>VP|\?VP)\s*DMG\s*BON(?:US)?[^0-9]{0,24}(\d{3,6})/i,
    /[>2]?V?P\s*DMG\s*BON[^0-9]{0,24}(\d{3,6})/i,
  ];
  const candidates = (patterns: RegExp[]) => texts.flatMap(text => patterns.flatMap(re => [...normalise(text).matchAll(re)].map(m => repairNumber(m[1]))));
  for (const [key, values] of [["pvpDamageReduction", candidates(reductionPatterns)], ["pvpDamageBonus", candidates(bonusPatterns)]] as const) {
    if (!values.length) continue;
    const counts: Record<string, number> = {}; values.forEach(v => counts[v] = (counts[v] ?? 0) + 1);
    result[key] = [...new Set(values)].sort((a,b) => counts[b] - counts[a] || b.length - a.length)[0];
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
    // Only Notice-popup absolute Equipment values may populate PDEF/MDEF.
    // Never let Equipment PDEF/MDEF percentages overwrite those fields.
    const notice = raw.join("\n");
    const pdef = [...notice.matchAll(/EQUIPMENT\s*PDEF\s*[:：]?\s*(\d{3,6})(?!\s*%)/gi)].map(m => m[1]);
    const mdef = [...notice.matchAll(/EQUIPMENT\s*MDEF\s*[:：]?\s*(\d{3,6})(?!\s*%)/gi)].map(m => m[1]);
    if (pdef.length) stats.pdef = pdef.sort((a,b) => Number(b) - Number(a))[0];
    if (mdef.length) stats.mdef = mdef.sort((a,b) => Number(b) - Number(a))[0];
  } finally { await worker.terminate(); }
  return { stats, rawText: raw.join("\n") };
}

export default readRooStats;
