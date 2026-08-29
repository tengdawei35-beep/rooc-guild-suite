import { createWorker, PSM } from "tesseract.js";
import sharp from "sharp";

export type RooStats = Record<string, string>;
type OcrWorker = Awaited<ReturnType<typeof createWorker>>;
type Roi = { x: number; y: number; width: number; height: number };

const PVP_ROIS: Record<string, Roi> = {
  pvpDamageReduction: { x: 0.30, y: 0.885, width: 0.22, height: 0.085 },
  pvpDamageBonus: { x: 0.79, y: 0.885, width: 0.20, height: 0.085 },
};

const LABELS: Record<string, string[]> = {
  patk: ["PATK", "PHYSICAL ATTACK"],
  matk: ["MATK", "MAGIC ATTACK"],
  hp: ["HP", "HEALTH POINTS"],
  pdmgPercent: ["PDMG"],
  mdmgPercent: ["MDMG"],
  pdmgReductionPercent: ["PDMG.R", "PDMG REDUCTION"],
  mdmgReductionPercent: ["MDMG.R", "MDMG REDUCTION"],
  critRes: ["CRIT RES", "CRIT RES."],
  ignorePdef: ["IGNORE PDEF", "IGNORE P DEF", "IGNORE P-DEF"],
  ignoreMdef: ["IGNORE MDEF", "IGNORE M DEF", "IGNORE M-DEF"],
  equipmentPdefPercent: ["EQUIPMENT PDEF", "EQUIP PDEF"],
  equipmentMdefPercent: ["EQUIPMENT MDEF", "EQUIP MDEF"],
};

function normalise(text: string) {
  return text.toUpperCase().replace(/[|]/g, "I").replace(/\s+/g, " ").trim();
}

function firstNumber(text: string): string | null {
  const match = text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?%?/);
  return match?.[0] ?? null;
}

function exactLabelRegex(alias: string) {
  const escaped = alias.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^A-Z0-9])${escaped}(?=$|[^A-Z0-9])`, "i");
}

function findExactLabel(line: string, field: string, aliases: string[]) {
  const upper = normalise(line);
  for (const alias of aliases.slice().sort((a, b) => b.length - a.length)) {
    const match = exactLabelRegex(alias).exec(upper);
    if (!match) continue;
    const prefix = upper.slice(0, match.index + match[0].length);
    if ((field === "patk" || field === "matk") && /(?:REFINE\s+)?$/.test(prefix) && /REFINE\s+(?:PATK|MATK)/i.test(upper)) continue;
    if (field === "hp" && /HP\s+RECOVER/i.test(upper)) continue;
    if (field === "pdmgPercent" && /PDMG\s*\.\s*R/i.test(upper)) continue;
    if (field === "mdmgPercent" && /MDMG\s*\.\s*R/i.test(upper)) continue;
    if (field === "pdmgReductionPercent" && !/PDMG\s*\.\s*R/i.test(upper)) continue;
    if (field === "mdmgReductionPercent" && !/MDMG\s*\.\s*R/i.test(upper)) continue;
    return match.index + match[0].length;
  }
  return -1;
}

function extractLabelValues(text: string): RooStats {
  const result: RooStats = {};
  const lines = text.split(/\r?\n/).map(normalise).filter(Boolean);
  for (const line of lines) {
    for (const [field, aliases] of Object.entries(LABELS)) {
      const labelEnd = findExactLabel(line, field, aliases);
      if (labelEnd < 0) continue;
      const value = firstNumber(line.slice(labelEnd));
      if (value === null) continue;
      if ((field === "equipmentPdefPercent" || field === "equipmentMdefPercent") && !value.endsWith("%")) continue;
      if ((field === "ignorePdef" || field === "ignoreMdef") && value.endsWith("%")) continue;
      if (field === "patk" && /REFINE\s+PATK/i.test(line)) continue;
      if (field === "matk" && /REFINE\s+MATK/i.test(line)) continue;
      if (field === "hp" && /HP\s+RECOVER/i.test(line)) continue;
      // PDMG and MDMG are the primary damage percentages. The reduction fields are PDMG.R / MDMG.R.
      if ((field === "pdmgPercent" || field === "mdmgPercent") && !value.endsWith("%")) continue;
      if ((field === "pdmgReductionPercent" || field === "mdmgReductionPercent") && !value.endsWith("%")) continue;
      result[field] = value.replace(/%$/, "");
    }
  }
  return result;
}

async function preprocess(image: Buffer, mode: "normal" | "contrast" | "threshold") {
  let pipeline = sharp(image).rotate().resize({ width: 2200, withoutEnlargement: false }).grayscale().normalize();
  if (mode === "contrast") pipeline = pipeline.linear(1.45, -40);
  if (mode === "threshold") pipeline = pipeline.linear(1.7, -70).threshold(200);
  return pipeline.sharpen().png().toBuffer();
}

async function preprocessRoi(image: Buffer, region: Roi) {
  const metadata = await sharp(image).metadata();
  const width = Number(metadata.width ?? 0), height = Number(metadata.height ?? 0);
  if (!width || !height) throw new Error("Unable to determine screenshot dimensions.");
  const left = Math.max(0, Math.min(Math.round(width * region.x), width - 1));
  const top = Math.max(0, Math.min(Math.round(height * region.y), height - 1));
  const cropWidth = Math.max(1, Math.min(Math.round(width * region.width), width - left));
  const cropHeight = Math.max(1, Math.min(Math.round(height * region.height), height - top));
  return sharp(image).rotate().extract({ left, top, width: cropWidth, height: cropHeight }).resize({ width: 1000 }).grayscale().normalize().linear(1.6, -45).threshold(185).sharpen().png().toBuffer();
}

async function recognise(worker: OcrWorker, image: Buffer, psm: PSM) {
  await worker.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: "1", user_defined_dpi: "300" });
  const result = await worker.recognize(image);
  return String(result.data.text ?? "");
}

export async function readRooStats(images: Buffer[]): Promise<{ stats: RooStats; rawText: string }> {
  if (!images.length) throw new Error("At least one screenshot is required.");
  if (images.length > 12) throw new Error("A maximum of 12 screenshots can be read at once.");
  const worker = await createWorker("eng", 1);
  const numericWorker = await createWorker("eng", 1);
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
      const noticeText = raw[raw.length - 3] ?? "";
      const noticePdef = noticeText.match(/EQUIPMENT\s*PDEF\s*[:]?\s*(\d+(?:\.\d+)?)(?!\s*%)/i);
      const noticeMdef = noticeText.match(/EQUIPMENT\s*MDEF\s*[:]?\s*(\d+(?:\.\d+)?)(?!\s*%)/i);
      if (noticePdef) stats.pdef = noticePdef[1];
      if (noticeMdef) stats.mdef = noticeMdef[1];
      for (const [field, roi] of Object.entries(PVP_ROIS)) {
        const cropped = await preprocessRoi(image, roi);
        const text = await recognise(numericWorker, cropped, PSM.SINGLE_LINE);
        const value = firstNumber(text);
        if (value !== null) stats[field] = value.replace(/%$/, "");
      }
    }
  } finally {
    await Promise.allSettled([worker.terminate(), numericWorker.terminate()]);
  }
  return { stats, rawText: raw.join("\n") };
}

export default readRooStats;
