import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { putPrivateBlob } from "@/lib/vercel-blob";

export const runtime = "nodejs";
const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_FILE_SIZE = 4 * 1024 * 1024;

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

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
    if (!allowed.has(file.type)) return NextResponse.json({ error: "Only PNG, JPEG and WebP screenshots are supported." }, { status: 400 });
    if (file.size < 1 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Each screenshot must be 4 MB or smaller." }, { status: 400 });

    const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "screenshot." + extension;
    const storagePath = "guilds/" + auth.guild.id + "/events/" + eventId + "/results/" + randomUUID() + "-" + safeName;
    const uploaded = await putPrivateBlob(storagePath, Buffer.from(await file.arrayBuffer()), file.type);
    const image = await prisma.eventResultImage.create({
      data: {
        eventId,
        guildId: auth.guild.id,
        storagePath: uploaded.pathname,
        url: uploaded.url,
        fileName: file.name.slice(0, 160),
        contentType: file.type,
        size: file.size,
        uploadedByUserId: auth.user.id,
      },
      select: { id: true, fileName: true, contentType: true, size: true, createdAt: true },
    });
    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    console.error("[EVENT RESULT UPLOAD]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to upload event screenshot." }, { status: 500 });
  }
}
