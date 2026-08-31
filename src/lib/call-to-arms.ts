import { prisma } from "@/lib/prisma";

export type CallStatus = "OPEN" | "FILLED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
export type CallParticipantStatus = "ACTIVE" | "WAITLIST";

const SUPPORT_JOBS = new Set([
  "High Priest",
  "Bard",
  "Gypsy",
  "Biochemist (Plant)",
  "Doram (Support)",
  "Lord Knight",
]);

export const GENERIC_ROLES = ["DPS"] as const;

export function requirementMatchesJob(requirement: string, job: string | null | undefined) {
  if (!job) return false;
  if (requirement === "DPS") return !SUPPORT_JOBS.has(job);
  return requirement === job;
}

export async function ensureCallTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "guild_calls" (
      "id" text PRIMARY KEY,
      "guild_id" text NOT NULL,
      "creator_user_id" text NOT NULL,
      "title" text NOT NULL,
      "description" text,
      "start_at" timestamptz NOT NULL,
      "status" text NOT NULL DEFAULT 'OPEN',
      "discord_webhook_url" text,
      "announced_at" timestamptz,
      "reminder_sent_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "guild_calls_guild_start_idx" ON "guild_calls" ("guild_id", "start_at");
    CREATE TABLE IF NOT EXISTS "guild_call_requirements" (
      "id" text PRIMARY KEY,
      "call_id" text NOT NULL,
      "requirement" text NOT NULL,
      "quantity" integer NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "guild_call_requirements_call_idx" ON "guild_call_requirements" ("call_id");
    CREATE TABLE IF NOT EXISTS "guild_call_participants" (
      "id" text PRIMARY KEY,
      "call_id" text NOT NULL,
      "requirement_id" text NOT NULL,
      "member_id" text NOT NULL,
      "status" text NOT NULL DEFAULT 'ACTIVE',
      "signed_up_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      UNIQUE ("call_id", "member_id")
    );
    CREATE INDEX IF NOT EXISTS "guild_call_participants_call_idx" ON "guild_call_participants" ("call_id");
    CREATE TABLE IF NOT EXISTS "guild_call_webhooks" (
      "guild_id" text PRIMARY KEY,
      "webhook_url" text NOT NULL,
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );
  `);
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export async function refreshCallStatus(callId: string) {
  await ensureCallTables();
  const rows = await prisma.$queryRawUnsafe<Array<{ required: bigint; active: bigint; status: string }>>(`
    SELECT
      COALESCE((SELECT SUM(quantity) FROM "guild_call_requirements" WHERE call_id = $1), 0) AS required,
      COALESCE((SELECT COUNT(*) FROM "guild_call_participants" WHERE call_id = $1 AND status = 'ACTIVE'), 0) AS active,
      (SELECT status FROM "guild_calls" WHERE id = $1) AS status
  `, callId);
  const row = rows[0];
  if (!row || ["CANCELLED", "COMPLETED"].includes(row.status)) return row?.status as CallStatus | undefined;
  const next = Number(row.active) >= Number(row.required) ? "FILLED" : "OPEN";
  if (next !== row.status) await prisma.$executeRawUnsafe(`UPDATE "guild_calls" SET status = $2, updated_at = now() WHERE id = $1`, callId, next);
  return next as CallStatus;
}
