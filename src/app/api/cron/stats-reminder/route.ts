import { NextResponse } from "next/server";
import { notifyStatsForAllGuilds } from "@/lib/discord-notifications";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await notifyStatsForAllGuilds();
  return NextResponse.json({ success: true });
}
