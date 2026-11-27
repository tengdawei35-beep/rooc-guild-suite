import sharp from "sharp";

const MAX_PIXELS = 40_000_000;
const ALLOWED_FORMATS = new Set(["png", "jpeg", "webp"]);

export async function normalizeOcrImage(input: Buffer): Promise<Buffer> {
  const metadata = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" }).metadata();
  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format) || !metadata.width || !metadata.height) {
    throw new Error("Only valid PNG, JPEG and WebP images are supported.");
  }
  if (metadata.width * metadata.height > MAX_PIXELS) {
    throw new Error("Image dimensions exceed the supported limit.");
  }

  return sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" })
    .rotate()
    .resize({ width: 3000, height: 3000, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88 })
    .toBuffer();
}


/**
 * Normalize OCR screenshots sequentially and enforce a request-wide decoded
 * pixel budget. Per-file byte limits alone do not prevent decompression bombs.
 */
export async function normalizeOcrImages(inputs: Buffer[], maxTotalPixels = MAX_PIXELS): Promise<Buffer[]> {
  const normalized: Buffer[] = [];
  let totalPixels = 0;
  for (const input of inputs) {
    const metadata = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" }).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error("Image dimensions are invalid.");
    }
    totalPixels += metadata.width * metadata.height;
    if (totalPixels > maxTotalPixels) {
      throw new Error("Combined screenshot dimensions exceed the supported pixel limit.");
    }
    normalized.push(await normalizeOcrImage(input));
  }
  return normalized;
}
