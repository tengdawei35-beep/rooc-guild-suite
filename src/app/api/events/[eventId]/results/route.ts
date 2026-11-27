import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { putPrivateBlob } from "@/lib/vercel-blob";

export const runtime = "nodejs";
const allowed = new Set(["png", "jpeg", "webp"]);
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const MAX_REQUEST_BYTES = MAX_FILE_SIZE + 256 * 1024;

type Context = { params: Promise<{ eventId: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "events.view")) return NextResponse.json({ error: "You do not have permission to view event results." }, { status: 403 });
  const { eventId } = await context.params;
  const event = await prisma.event.findFirst({ where: { id: eventId, guildId: auth.guild.id }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  const images = await prisma.eventResultImage.findMany({
    where: { eventId, guildId: auth.guild.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, fileName: true, contentType: true, size: true, createdAt: true },
  });
  return NextResponse.json({ images });
}

export async function POST(request: Request, context: Context) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "events.manage")) return NextResponse.json({ error: "You do not have permission to upload event results." }, { status: 403 });
  const { eventId } = await context.params;
  const event = await prisma.event.findFirst({ where: { id: eventId, guildId: auth.guild.id }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "The upload exceeds the 4 MB limit." }, { status: 413 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
    if (file.size < 1 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Each screenshot must be 4 MB or smaller." }, { status: 400 });

    // Do not trust the browser-supplied MIME type. Decode the actual image,
    // reject unsupported formats and normalize the stored bytes to WebP.
    const input = Buffer.from(await file.arrayBuffer());
    const pipeline = sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" });
    const metadata = await pipeline.metadata();
    if (!metadata.format || !allowed.has(metadata.format) || !metadata.width || !metadata.height) {
      return NextResponse.json({ error: "Only valid PNG, JPEG and WebP screenshots are supported." }, { status: 400 });
    }
    if (metadata.width * metadata.height > MAX_PIXELS) {
      return NextResponse.json({ error: "The screenshot dimensions are too large." }, { status: 400 });
    }
    const normalized = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" })
      .rotate()
      .resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80).replace(/\.[^.]+$/, "") || "screenshot";
    const storagePath = "guilds/" + auth.guild.id + "/events/" + eventId + "/results/" + randomUUID() + "-" + safeName + ".webp";
    const uploaded = await putPrivateBlob(storagePath, normalized, "image/webp");
    const image = await prisma.eventResultImage.create({
      data: {
        eventId,
        guildId: auth.guild.id,
        storagePath: uploaded.pathname,
        url: uploaded.url,
        fileName: (safeName + ".webp").slice(0, 160),
        contentType: "image/webp",
        size: normalized.byteLength,
        uploadedByUserId: auth.user.id,
      },
      select: { id: true, fileName: true, contentType: true, size: true, createdAt: true },
    });
    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    console.error("[EVENT RESULT UPLOAD]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to upload event screenshot." }, { status: 400 });
  }
}
