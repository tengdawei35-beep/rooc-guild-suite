import { NextResponse } from "next/server";

import { getGuildCreationEligibility } from "@/lib/guild-creation";

export async function GET() {
  try {
    const eligibility = await getGuildCreationEligibility();

    if (!eligibility) {
      return NextResponse.json(
        { error: "Discord authentication required." },
        { status: 401 }
      );
    }

    return NextResponse.json({ eligibility });
  } catch (error) {
    console.error("[GUILD CREATION] Failed to check eligibility:", error);
    return NextResponse.json(
      { error: "Failed to check guild creation eligibility." },
      { status: 500 }
    );
  }
}
