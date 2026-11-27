import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Atomic, database-backed fixed-window limiter suitable for serverless
 * instances. The persisted key is a digest so account identifiers are not
 * exposed in the rate-limit table.
 */
export async function consumeRateLimit(
  scope: string,
  subject: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const digest = createHash("sha256").update(scope).update(":").update(subject).digest("hex");
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);

  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitBucket" ("key", "windowStart", "count", "updatedAt")
    VALUES (${digest}, ${windowStart}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."windowStart" < EXCLUDED."windowStart" THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "windowStart" = GREATEST("RateLimitBucket"."windowStart", EXCLUDED."windowStart"),
      "updatedAt" = EXCLUDED."updatedAt"
    RETURNING "count"
  `;

  return Number(rows[0]?.count ?? limit + 1) <= limit;
}
