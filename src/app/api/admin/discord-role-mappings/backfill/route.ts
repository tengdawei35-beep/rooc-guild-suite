import { NextResponse } from "next/server";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { syncGuildSubscriptionDiscordRoles } from "@/lib/discord/subscription-roles";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Reconcile all existing subscribers in bounded batches to support historical backfills. */
export async function POST() {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_OFFICIAL_GUILD_ID) {
      return NextResponse.json({ error: "DISCORD_CONFIGURATION_MISSING" }, { status: 503 });
    }

    const subscriptions = await prisma.guildSubscription.findMany({
      where: { status: { in: ["ACTIVE", "TRIALING"] } },
      select: { guildId: true },
      distinct: ["guildId"],
    });
    const guildIds = subscriptions.map((subscription) => subscription.guildId);
    let synced = 0;
    const failures: Array<{ guildId: string; error: string }> = [];

    // Keep the Discord API request volume bounded; one guild is reconciled at a time.
    for (const guildId of guildIds) {
      try {
        await syncGuildSubscriptionDiscordRoles(guildId);
        synced += 1;
      } catch (error) {
        failures.push({ guildId, error: error instanceof Error ? error.message : "SYNC_FAILED" });
      }
    }

    return NextResponse.json({
      success: failures.length === 0,
      totalGuilds: guildIds.length,
      syncedGuilds: synced,
      failedGuilds: failures.length,
      failures: failures.slice(0, 20),
      message: failures.length
        ? "Backfill completed with errors. Review the per-guild diagnostics, resolve the Discord permission/configuration issue, and retry."
        : "Historical subscription roles have been reconciled.",
    }, { status: failures.length ? 207 : 200 });
  } catch (error) {
    console.error("[DISCORD ROLE BACKFILL]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "ROLE_BACKFILL_FAILED" }, { status: 500 });
  }
}
