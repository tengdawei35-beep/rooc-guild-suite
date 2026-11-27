import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth";
import { destroyPlatformUserSession } from "@/lib/auth/platform";
import { stopImpersonation } from "@/lib/impersonation";

const GUILD_SELECTION_COOKIE = "rooc_guild_selection";
const OAUTH_STATE_COOKIE = "rooc_discord_oauth_state";

/**
 * Never construct a security-sensitive redirect from forwarded host headers.
 * APP_URL is the deployment's configured canonical origin and is required by
 * the Discord OAuth flow as well.
 */
function getPublicOrigin() {
  const configured = process.env.APP_URL;
  if (!configured) throw new Error("APP_URL is not configured.");
  const origin = new URL(configured);
  if (origin.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new Error("APP_URL must use HTTPS in production.");
  }
  return origin.origin;
}

export async function POST() {
  await stopImpersonation("ADMIN_LOGOUT");
  await destroySession();
  await destroyPlatformUserSession();

  const response = NextResponse.redirect(new URL("/login", getPublicOrigin()));
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
