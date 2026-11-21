import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getPrivateBlob } from "@/lib/vercel-blob";

type Context = { params: Promise<{ imageId: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "events.view")) return NextResponse.json({ error: "You do not have permission to view event results." }, { status: 403 });
  const { imageId } = await context.params;
  const image = await prisma.eventResultImage.findFirst({
    where: { id: imageId, guildId: auth.guild.id },
    select: { storagePath: true, contentType: true, fileName: true },
  });
  if (!image) return NextResponse.json({ error: "Screenshot not found." }, { status: 404 });
  try {
    const blob = await getPrivateBlob(image.storagePath);
    if (!blob || !blob.body) return NextResponse.json({ error: "Screenshot file not found in storage." }, { status: 404 });
    return new NextResponse(blob.body, {
      headers: {
        "Content-Type": image.contentType,
        "Content-Disposition": 'inline; filename="' + image.fileName.replace(/["\\\r\n]/g, "_") + '"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[EVENT RESULT VIEW]", error);
    return NextResponse.json({ error: "Unable to retrieve screenshot." }, { status: 502 });
  }
}
