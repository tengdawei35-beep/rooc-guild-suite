import { NextResponse } from "next/server";

import { getCurrentAuth, hasPermission } from "@/lib/auth";
import { readRooStats } from "@/lib/ocr/roo-stats";
import { readRO3Stats } from "@/lib/ocr/ro3-stats";
import { prisma } from "@/lib/prisma";
import { acquireOcrLease, consumeRateLimit } from "@/lib/security/rate-limit";
import { normalizeOcrImages } from "@/lib/security/ocr-image";
import { readMultipartFormData, RequestBodyTooLargeError } from "@/lib/security/multipart";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = 24 * 1024 * 1024 + 256 * 1024;
const MAX_TOTAL_PIXELS = 40_000_000;

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  if (!(await consumeRateLimit("member-ocr", auth.user.id, 6, 60_000))) {
    return NextResponse.json({ error: "OCR limit reached. Please wait a minute before trying again." }, { status: 429 });
  }
  const releaseLease = await acquireOcrLease("member-ocr", auth.user.id, 150_000);
  if (!releaseLease) return NextResponse.json({ error: "An OCR request is already being processed for this account." }, { status: 429 });

  try {
    const formData = await readMultipartFormData(request, MAX_REQUEST_BYTES);
    const memberIdValue = formData.get("memberId");
    const memberId = typeof memberIdValue === "string" ? memberIdValue : null;

    if (memberId) {
      const member = await prisma.guildMember.findFirst({
        where: { id: memberId, guildId: auth.guild.id },
        select: { id: true, userId: true, discordUserId: true },
      });
      if (!member) return NextResponse.json({ error: "Guild member not found." }, { status: 404 });

      const isOwnMember = member.userId === auth.user.id || member.discordUserId === auth.user.discordId;
      const canEditAny = hasPermission(auth.role, "members.edit");
      const canEditOwn = isOwnMember && hasPermission(auth.role, "profile.editOwn");
      if (!canEditAny && !canEditOwn) {
        return NextResponse.json({ error: "You do not have permission to read stats for this member." }, { status: 403 });
      }
    } else if (!hasPermission(auth.role, "members.import")) {
      return NextResponse.json({ error: "You do not have permission to import member screenshots." }, { status: 403 });
    }

    const entries = formData.getAll("images");
    const files = entries.filter((entry): entry is File => entry instanceof File);

    if (!files.length) {
      return NextResponse.json({ error: "At least one screenshot is required." }, { status: 400 });
    }
    if (files.length > 12) {
      return NextResponse.json({ error: "A maximum of 12 screenshots can be read at once." }, { status: 400 });
    }

    let totalBytes = 0;
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `${file.name || "File"} is larger than 8 MB.` }, { status: 400 });
      }
      totalBytes += file.size;
    }
    if (totalBytes > 24 * 1024 * 1024) {
      return NextResponse.json({ error: "Combined screenshot size cannot exceed 24 MB." }, { status: 400 });
    }

    const inputs = await Promise.all(files.map(async (file) => Buffer.from(await file.arrayBuffer())));
    const buffers = await normalizeOcrImages(inputs, MAX_TOTAL_PIXELS);
    const guild = await prisma.guild.findUnique({ where: { id: auth.guild.id }, select: { gameType: true } });
    if (!guild) return NextResponse.json({ error: "Guild not found." }, { status: 404 });
    const result = guild.gameType === "RO3" ? await readRO3Stats(buffers) : await readRooStats(buffers);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[MEMBER OCR] Failed to read screenshots:", error);
    const message = error instanceof Error ? error.message : "OCR failed.";
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: message }, { status: 413 });
    const validationError = /image|dimensions|format|unsupported|invalid/i.test(message);
    return NextResponse.json({ error: message }, { status: validationError ? 400 : 500 });
  } finally {
    try { await releaseLease(); }
    catch (releaseError) { console.error("[OCR] Failed to release processing lease:", releaseError); }
  }
}
