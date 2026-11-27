import { createWorker, PSM } from "tesseract.js";
import sharp from "sharp";
import { RO3_STAT_FIELDS, RO3_STAT_KEYS, type RO3StatKey } from "@/lib/constants/ro3-stats";

export { RO3_STAT_KEYS };
export type { RO3StatKey };
export type RO3Stats = Partial<Record<RO3StatKey, string>>;

const normalize = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9% .-]/g, " ").replace(/\s+/g, " ").trim();

const normalizeNumber = (value: string) =>
  value.replace(/,/g, "").replace(/[Oo]/g, "0").replace(/[Il|]/g, "1").trim();

function parseLines(text: string): RO3Stats {
  const stats: RO3Stats = {};
  const matchers = RO3_STAT_FIELDS.flatMap((field) =>
    field.aliases.map((alias) => ({ field, alias: normalize(alias) })),
  ).sort((a, b) => b.alias.length - a.alias.length);

  for (const rawLine of text.split(/\r?\n/)) {
    const line = normalize(rawLine);
    if (!line) continue;

    for (const { field, alias } of matchers) {
      const isCrystal = "crystal" in field && field.crystal === true;
      const index = isCrystal ? line.indexOf(alias) : line.startsWith(alias) ? 0 : -1;
      if (index < 0) continue;

      const remainder = line.slice(index + alias.length);
      // The generic Damage Reduction row must not consume the value from
      // the more specific "Damage Reduction vs ..." target-modifier rows.
      if (field.key === "damageReductionPercent" && /^\s*VS\b/.test(remainder)) continue;

      if (isCrystal) {
        // Crystal amount is printed before its label; "Uses Remaining" is
        // another number later in the line and must not be mistaken for it.
        const prefix = line.slice(0, index);
        const values = [...prefix.matchAll(/(?:^|\s)(\d{1,2})(?=\s|$)/g)];
        const value = values.at(-1)?.[1];
        if (value !== undefined) {
          const parsed = Number(normalizeNumber(value));
          if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 50) {
            stats[field.key] = String(parsed);
          }
        }
        break;
      }

      const valueMatch = remainder.match(/[-+]?\d[\d,.]*%?/);
      if (!valueMatch) continue;
      if ("percent" in field && field.percent === true && !valueMatch[0].includes("%")) continue;

      const value = normalizeNumber(valueMatch[0]).replace(/%/g, "");
      if (value) stats[field.key] = value;
      break;
    }
  }

  return stats;
}

export async function readRO3Stats(
  images: Buffer[],
): Promise<{ stats: RO3Stats; rawText: string }> {
  if (!images.length) throw new Error("At least one screenshot is required.");
  if (images.length > 12) throw new Error("A maximum of 12 screenshots can be read at once.");

  const worker = await createWorker("eng", 1);
  let workerTerminated = false;
  const terminateWorker = async () => {
    if (workerTerminated) return;
    workerTerminated = true;
    await worker.terminate();
  };
  const timeout = setTimeout(() => {
    void terminateWorker().catch((error) => console.error("[RO3 OCR] Worker timeout termination failed:", error));
  }, 120_000);
  try {
    const texts: string[] = [];
    for (const image of images) {
      const processed = await sharp(image)
        .rotate()
        .resize({ width: 2200 })
        .grayscale()
        .linear(1.5, -32)
        .sharpen({ sigma: 1 })
        .png()
        .toBuffer();

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });
      texts.push(String((await worker.recognize(processed)).data.text ?? ""));

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });
      texts.push(String((await worker.recognize(processed)).data.text ?? ""));
    }

    const rawText = texts.join("\n");
    return { stats: parseLines(rawText), rawText };
  } finally {
    clearTimeout(timeout);
    await terminateWorker();
  }
}
