import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { hasCombatSimulatorAccess } from "@/lib/ro3-combat-simulator/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth) return new NextResponse("Unauthorized", { status: 401 });
  if (!(await hasCombatSimulatorAccess(auth.user.id, auth.guild.id))) {
    return new NextResponse("Subscription required", { status: 403 });
  }

  const htmlPath = join(process.cwd(), "src", "lib", "ro3-combat-simulator", "ro3-damage-sim.html");
  const html = await readFile(htmlPath, "utf8");
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox allow-scripts allow-forms allow-modals; default-src 'self' data: blob: 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' data: blob:",
      "Referrer-Policy": "no-referrer",
    },
  });
}
