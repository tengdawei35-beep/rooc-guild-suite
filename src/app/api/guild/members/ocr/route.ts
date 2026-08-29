import { NextResponse } from "next/server";

import { getCurrentAuth } from "@/lib/auth";
import { readRooStats } from "@/lib/ocr/roo-stats";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const formData = await request.formData();
    const entries = formData.getAll("images");

    const files = entries.filter((entry): entry is File => entry instanceof File);
    if (!files.length) {
      return NextResponse.json({ error: "At least one screenshot is required." }, { status: 400 });
    }

    if (files.length > 12) {
      return NextResponse.json({ error: "A maximum of 12 screenshots can be read at once." }, { status: 400 });
    }

    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json({ error: `${file.name || "File"} is not a supported image type.` }, { status: 400 });
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `${file.name || "File"} is larger than 8 MB.` }, { status: 400 });
      }
    }

    const buffers = await Promise.all(files.map(async (file) => Buffer.from(await file.arrayBuffer())));
    const result = await readRooStats(buffers);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[MEMBER OCR] Failed to read screenshots:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OCR failed." },
      { status: 500 },
    );
  }
}
