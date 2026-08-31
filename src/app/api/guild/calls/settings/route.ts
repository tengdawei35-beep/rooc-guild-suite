import { NextResponse } from "next/server";
import { getCurrentAuth, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCallTables } from "@/lib/call-to-arms";

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "events.view")) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  await ensureCallTables();
  const rows = await prisma.$queryRawUnsafe<Array<{ webhook_url: string }>>(`SELECT webhook_url FROM "guild_call_webhooks" WHERE guild_id = $1`, auth.guild.id);
  return NextResponse.json({ configured: Boolean(rows[0]) });
}

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!["ADMIN", "MANAGER", "OFFICER"].includes(auth.role)) return NextResponse.json({ error: "Only guild managers can configure Discord notifications." }, { status: 403 });
  const body = await request.json();
  const webhookUrl = String(body.webhookUrl ?? "").trim();
  if (webhookUrl && !/^https:\/\/discord(?:app)?\.com\/api\/webhooks\//.test(webhookUrl)) return NextResponse.json({ error: "Enter a valid Discord webhook URL." }, { status: 400 });
  await ensureCallTables();
  if (!webhookUrl) await prisma.$executeRawUnsafe(`DELETE FROM "guild_call_webhooks" WHERE guild_id = $1`, auth.guild.id);
  else await prisma.$executeRawUnsafe(`INSERT INTO "guild_call_webhooks" (guild_id, webhook_url) VALUES ($1,$2) ON CONFLICT (guild_id) DO UPDATE SET webhook_url = EXCLUDED.webhook_url, updated_at = now()`, auth.guild.id, webhookUrl);
  await prisma.$executeRawUnsafe(`UPDATE "guild_calls" SET discord_webhook_url = $1, updated_at = now() WHERE guild_id = $2 AND status IN ('OPEN','FILLED','CONFIRMED')`, webhookUrl || null, auth.guild.id);
  return NextResponse.json({ configured: Boolean(webhookUrl) });
}
