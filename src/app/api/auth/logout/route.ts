import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth";
import { destroyPlatformUserSession } from "@/lib/auth/platform";

const GUILD_SELECTION_COOKIE = "rooc_guild_selection";
const OAUTH_STATE_COOKIE = "rooc_discord_oauth_state";

export async function POST(request: Request) {
  await destroySession();
  await destroyPlatformUserSession();

  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set(GUILD_SELECTION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
