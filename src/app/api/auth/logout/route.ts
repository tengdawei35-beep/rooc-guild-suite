import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth";
import { destroyPlatformUserSession } from "@/lib/auth/platform";

const GUILD_SELECTION_COOKIE = "rooc_guild_selection";
const OAUTH_STATE_COOKIE = "rooc_discord_oauth_state";

function getPublicOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = forwardedHost ?? request.headers.get("host");
  const proto = forwardedProto ?? new URL(request.url).protocol.replace(":", "");

  if (host) return `${proto}://${host}`;
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  await destroySession();
  await destroyPlatformUserSession();

  const response = NextResponse.redirect(new URL("/login", getPublicOrigin(request)));
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
