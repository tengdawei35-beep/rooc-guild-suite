import { NextResponse } from "next/server";
import { readRooStats } from "@/lib/ocr/roo-stats";
import { readRO3Stats } from "@/lib/ocr/ro3-stats";
import { getApplicantSession } from "@/lib/auth/applicant";
import { prisma } from "@/lib/prisma";
import { acquireOcrLease, consumeRateLimit } from "@/lib/security/rate-limit";
import { normalizeOcrImages } from "@/lib/security/ocr-image";
import { readMultipartFormData, RequestBodyTooLargeError } from "@/lib/security/multipart";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = 24 * 1024 * 1024 + 256 * 1024;
const MAX_TOTAL_PIXELS = 40_000_000;

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const session = await getApplicantSession();
  if (!session) return NextResponse.json({ error: "Discord authentication required." }, { status: 401 });

  const { token } = await context.params;
  const invite = await prisma.applicantInvite.findFirst({ where: { token, active: true } });
  if (!invite) return NextResponse.json({ error: "This application link is invalid or has been revoked." }, { status: 404 });

  if (!(await consumeRateLimit("applicant-ocr", session.userId, 3, 60_000))) {
    return NextResponse.json({ error: "OCR limit reached. Please wait a minute before trying again." }, { status: 429 });
  }
  const releaseLease = await acquireOcrLease("applicant-ocr", session.userId, 150_000);
  if (!releaseLease) return NextResponse.json({ error: "An OCR request is already being processed for this account." }, { status: 429 });
  try {
    const formData = await readMultipartFormData(request, MAX_REQUEST_BYTES);
    const entries = formData.getAll("images");
    const files = entries.filter((entry): entry is File => entry instanceof File);

    if (!files.length) return NextResponse.json({ error: "At least one screenshot is required." }, { status: 400 });
    if (files.length > 12) return NextResponse.json({ error: "A maximum of 12 screenshots can be read at once." }, { status: 400 });

    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: `${file.name || "File"} is larger than 8 MB.` }, { status: 400 });
    }

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > 24 * 1024 * 1024) return NextResponse.json({ error: "Combined screenshot size cannot exceed 24 MB." }, { status: 400 });

    const inputs = await Promise.all(files.map(async (file) => Buffer.from(await file.arrayBuffer())));
    const buffers = await normalizeOcrImages(inputs, MAX_TOTAL_PIXELS);
    const guild = await prisma.guild.findUnique({ where: { id: invite.guildId }, select: { gameType: true } });
    const result = guild?.gameType === "RO3" ? await readRO3Stats(buffers) : await readRooStats(buffers);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[APPLICANT OCR]", error);
    const message = error instanceof Error ? error.message : "OCR failed.";
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: message }, { status: 413 });
    const validationError = /image|dimensions|format|unsupported|invalid/i.test(message);
    return NextResponse.json({ error: message }, { status: validationError ? 400 : 500 });
  } finally {
    try { await releaseLease(); }
    catch (releaseError) { console.error("[OCR] Failed to release processing lease:", releaseError); }
  }
}
