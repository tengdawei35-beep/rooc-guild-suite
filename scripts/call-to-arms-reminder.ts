import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { ensureCallTables, sendReminder } from "@/lib/call-to-arms";

async function run() {
  await ensureCallTables();

  const now = new Date();
  await prisma.$executeRawUnsafe(
    `UPDATE "guild_calls" SET status = 'COMPLETED', updated_at = now() WHERE status IN ('FILLED','CONFIRMED') AND start_at < $1`,
    now,
  );

  // Use a narrow window so each scheduled invocation handles only calls
  // that are approximately 30 minutes away.
  const lower = new Date(now.getTime() + 29 * 60 * 1000);
  const upper = new Date(now.getTime() + 31 * 60 * 1000);
  const calls = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "guild_calls"
     WHERE status IN ('FILLED','CONFIRMED')
       AND reminder_sent_at IS NULL
       AND start_at >= $1
       AND start_at <= $2`,
    lower,
    upper,
  );

  for (const call of calls) {
    try {
      await sendReminder(call.id);
      console.log(`[CALL TO ARMS] reminder sent: ${call.id}`);
    } catch (error) {
      console.error(`[CALL TO ARMS] reminder failed: ${call.id}`, error);
    }
  }
}

try {
  await run();
} finally {
  await prisma.$disconnect();
}
