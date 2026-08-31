import { PrismaClient } from "../src/generated/prisma/index.js";
import { sendReminder, ensureCallTables } from "../src/lib/call-to-arms.js";

const prisma = new PrismaClient();

async function run() {
  await ensureCallTables();
  const now = new Date();
  await prisma.$executeRawUnsafe(`UPDATE "guild_calls" SET status = 'COMPLETED', updated_at = now() WHERE status IN ('FILLED','CONFIRMED') AND start_at < $1`, now);
  const lower = new Date(now.getTime() + 29 * 60 * 1000);
  const upper = new Date(now.getTime() + 31 * 60 * 1000);
  const calls = await prisma.$queryRawUnsafe(`SELECT id FROM "guild_calls" WHERE status IN ('FILLED','CONFIRMED') AND reminder_sent_at IS NULL AND start_at >= $1 AND start_at <= $2`, lower, upper);
  for (const call of calls) {
    try {
      await sendReminder(call.id);
      console.log(`[CALL TO ARMS] reminder sent: ${call.id}`);
    } catch (error) {
      console.error(`[CALL TO ARMS] reminder failed: ${call.id}`, error);
    }
  }
}

async function main() {
  try {
    await run();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
