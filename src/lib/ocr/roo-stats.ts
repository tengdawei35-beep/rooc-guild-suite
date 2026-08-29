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
  critRes: ["CRIT RES"],
  ignorePdef: ["IGNORE PDEF"],
  ignoreMdef: ["IGNORE MDEF"],
  damageVsSmall: ["DMG VS SMALL ENEMIES", "DMG VS SMALL"],
  damageReductionVsSmall: ["DMG REDUCTION VS SMALL ENEMIES", "DMG REDUCTION VS SMALL"],
  damageVsMedium: ["DMG VS MEDIUM ENEMIES", "DMG VS MEDIUM"],
  damageReductionVsMedium: ["DMG REDUCTION VS MEDIUM ENEMIES", "DMG REDUCTION VS MEDIUM"],
  damageVsLarge: ["DMG VS LARGE ENEMIES"],
  damageReductionVsLarge: ["DMG REDUCTION VS LARGE MONSTERS", "DMG REDUCTION VS LARGE"],
  damageVsBrute: ["DMG VS BRUTE"],
  damageReductionVsBrute: ["DMG REDUCTION VS BRUTE"],
  damageVsDemiHuman: ["DMG VS DEMI-HUMAN", "DMG VS DEMIHUMAN"],
  damageReductionVsDemiHuman: ["DMG REDUCTION VS DEMI-HUMAN", "DMG REDUCTION VS DEMIHUMAN"],
  equipmentPdefPercent: ["EQUIPMENT PDEF"],
  equipmentMdefPercent: ["EQUIPMENT MDEF"],
};

function normalise(text: string) {
  return text.toUpperCase().replace(/[|]/g, "I").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
}

function compact(text: string) {
  return normalise(text).replace(/[^A-Z0-9%.-]/g, "");
}

function firstNumber(text: string): string | null {
  const match = text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?%?/);
  return match?.[0] ?? null;
}

/**
 * Match an OCR stat label as an actual label token, not as a substring of
 * another stat. This is important for ROO because the same screen contains
 * entries such as "Refine PATK", "Refine MATK", "HP Recover", and "PDMG.R".
 */
function findExactLabel(line: string, field: string, aliases: string[]) {
  const upper = normalise(line);

  const candidates = aliases
    .slice()
    .sort((a, b) => b.length - a.length);

  for (const alias of candidates) {
    const escaped = alias
      .toUpperCase()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+");

    // PATK/MATK/HP/PDMG/MDMG are deliberately token-boundary matches.
    // This prevents REFINE PATK, REFINE MATK, HP RECOVER and PDMG.R from
    // being interpreted as the primary stat.
    const tokenPattern = new RegExp(`(^|[^A-Z0-9])${escaped}(?=$|[^A-Z0-9])`, "i");
    const match = tokenPattern.exec(upper);
    if (!match) continue;

    if (field === "patk" && /REFINE\s*$/.test(upper.slice(0, match.index + match[0].length))) continue;
    if (field === "matk" && /REFINE\s*$/.test(upper.slice(0, match.index + match[0].length))) continue;
    if (field === "hp" && /(?:HP\s+)?RECOVER\s*$/.test(upper.slice(0, match.index + match[0].length))) continue;

    if (field === "pdmgPercent" && /PDMG\s*\.\s*R/.test(upper)) continue;
    if (field === "mdmgPercent" && /MDMG\s*\.\s*R/.test(upper)) continue;

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

      // Equipment percentage fields must contain an actual percent marker.
      // Absolute Notice values (e.g. Equipment PDEF:3333) belong to pdef/mdef.
      if ((field === "equipmentPdefPercent" || field === "equipmentMdefPercent") && !value.endsWith("%")) {
        continue;
      }

      // PDMG/MDMG primary percentage fields must themselves contain a percent
      // sign. This avoids accidentally consuming neighbouring absolute values.
      if ((field === "pdmgPercent" || field === "mdmgPercent" || field === "pdmgReductionPercent" || field === "mdmgReductionPercent") && !value.endsWith("%")) {
        continue;
      }

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
  const width = Number(metadata.width ?? 0);
  const height = Number(metadata.height ?? 0);
  if (!width || !height) throw new Error("Unable to determine screenshot dimensions.");

  const left = Math.max(0, Math.min(Math.round(width * region.x), width - 1));
  const top = Math.max(0, Math.min(Math.round(height * region.y), height - 1));
  const cropWidth = Math.max(1, Math.min(Math.round(width * region.width), width - left));
  const cropHeight = Math.max(1, Math.min(Math.round(height * region.height), height - top));

  return sharp(image).rotate().extract({ left, top, width: cropWidth, height: cropHeight }).resize({ width: 1000, withoutEnlargement: false }).grayscale().normalize().linear(1.6, -45).threshold(185).sharpen().png().toBuffer();
}

async function recognise(worker: OcrWorker, image: Buffer) {
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: "1", user_defined_dpi: "300" });
  const result = await worker.recognize(image);
  return String(result.data.text ?? "");
}

async function recogniseNumeric(worker: OcrWorker, image: Buffer) {
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: "0123456789", user_defined_dpi: "300" });
  const result = await worker.recognize(image);
  return firstNumber(String(result.data.text ?? ""));
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
      const normalText = await recognise(worker, variants[0]);
      raw.push(normalText);
      Object.assign(stats, extractLabelValues(normalText));

      for (const variant of variants.slice(1)) {
        const text = await recognise(worker, variant);
        raw.push(text);
        Object.assign(stats, extractLabelValues(text));
      }

      // The game displays absolute equipment PDEF/MDEF in the Notice popups.
      // These values intentionally override the General Stats base PDEF/MDEF.
      const noticePdef = normalText.match(/EQUIPMENT\s*PDEF\s*[:]?\s*(\d+)/i);
      const noticeMdef = normalText.match(/EQUIPMENT\s*MDEF\s*[:]?\s*(\d+)/i);
      if (noticePdef) stats.pdef = noticePdef[1];
      if (noticeMdef) stats.mdef = noticeMdef[1];

      for (const [field, roi] of Object.entries(PVP_ROIS)) {
        const cropped = await preprocessRoi(image, roi);
        const value = await recogniseNumeric(numericWorker, cropped);
        if (value !== null) stats[field] = value;
      }
    }
  } finally {
    await Promise.allSettled([worker.terminate(), numericWorker.terminate()]);
  }

  return { stats, rawText: raw.join("\n") };
}
