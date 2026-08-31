import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureCallTables, sendReminder } from "@/lib/call-to-arms";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) return new NextResponse("Unauthorized", { status: 401 });
  }
  await ensureCallTables();
  const now = new Date();
  const lower = new Date(now.getTime() + 29 * 60 * 1000);
  const upper = new Date(now.getTime() + 31 * 60 * 1000);
  const calls = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "guild_calls" WHERE status IN ('FILLED','CONFIRMED') AND reminder_sent_at IS NULL AND start_at >= $1 AND start_at <= $2`, lower, upper);
  let sent = 0;
  for (const call of calls) {
    try { await sendReminder(call.id); sent += 1; } catch (error) { console.error("[CALL TO ARMS] reminder failed", call.id, error); }
  }
  return NextResponse.json({ checked: calls.length, sent });
}
