import { NextResponse } from "next/server";
import { getCurrentAuth, hasPermission } from "@/lib/auth";
import { getNotificationConfig, isDiscordWebhookUrl, saveNotificationConfig } from "@/lib/discord-notifications";

type NotificationSettings = {
  rosterWebhookUrl?: string | null;
  bidWebhookUrl?: string | null;
  statsWebhookUrl?: string | null;
};

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "guild.manage")) return NextResponse.json({ error: "You do not have permission to manage guild settings." }, { status: 403 });

  const config = await getNotificationConfig(auth.guild.id);
  return NextResponse.json({
    configured: {
      roster: !!config?.rosterWebhookUrl,
      bid: !!config?.bidWebhookUrl,
      stats: !!config?.statsWebhookUrl,
    },
  });
}

export async function PUT(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "guild.manage")) return NextResponse.json({ error: "You do not have permission to manage guild settings." }, { status: 403 });

  try {
    const body = await request.json() as {
      rosterWebhookUrl?: string | null;
      bidWebhookUrl?: string | null;
      statsWebhookUrl?: string | null;
      clearRoster?: boolean;
      clearBid?: boolean;
      clearStats?: boolean;
    };

    const values: NotificationSettings = {};
    const entries: Array<[keyof NotificationSettings, string | null | undefined, boolean | undefined]> = [
      ["rosterWebhookUrl", body.rosterWebhookUrl, body.clearRoster],
      ["bidWebhookUrl", body.bidWebhookUrl, body.clearBid],
      ["statsWebhookUrl", body.statsWebhookUrl, body.clearStats],
    ];

    for (const [key, value, clear] of entries) {
      if (clear) values[key] = null;
      else if (typeof value === "string" && value.trim()) {
        const normalized = value.trim();
        if (!isDiscordWebhookUrl(normalized)) {
          return NextResponse.json({ error: `Invalid Discord webhook URL for ${key}.` }, { status: 400 });
        }
        values[key] = normalized;
      }
    }

    await saveNotificationConfig(auth.guild.id, values);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DISCORD] Failed to save notification settings:", error);
    return NextResponse.json({ error: "Failed to save notification settings." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "guild.manage")) return NextResponse.json({ error: "You do not have permission to manage guild settings." }, { status: 403 });

  const body = await request.json() as { type?: "roster" | "bid" | "stats" };
  const type = body.type;
  if (!type) return NextResponse.json({ error: "Notification type is required." }, { status: 400 });

  const config = await getNotificationConfig(auth.guild.id);
  const configured = type === "roster" ? config?.rosterWebhookUrl : type === "bid" ? config?.bidWebhookUrl : config?.statsWebhookUrl;
  if (!configured) return NextResponse.json({ error: "That notification channel is not configured." }, { status: 400 });

  try {
    const response = await fetch(configured, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `✅ HMDL ${type} notification test`, allowed_mentions: { parse: [] } }),
    });
    if (!response.ok) throw new Error(`Discord returned ${response.status}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DISCORD] Test notification failed:", error);
    return NextResponse.json({ error: "Discord rejected the test notification." }, { status: 502 });
  }
}
