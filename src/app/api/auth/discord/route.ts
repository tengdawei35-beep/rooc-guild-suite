import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const OAUTH_STATE_COOKIE = "rooc_discord_oauth_state";
const OAUTH_RETURN_COOKIE = "rooc_discord_oauth_return";
const OAUTH_STATE_MAX_AGE = 60 * 10;

export async function GET(request: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const appUrl = process.env.APP_URL;

  if (!clientId || !appUrl) {
    return NextResponse.json({ error: "Discord authentication is not configured." }, { status: 500 });
  }

  const requestUrl = new URL(request.url);
  const applyToken = requestUrl.searchParams.get("apply");
  const returnPath = applyToken && /^[A-Za-z0-9_-]{20,200}$/.test(applyToken)
    ? `/apply/${applyToken}`
    : null;

  const redirectUri = `${appUrl}/api/auth/discord/callback`;
  const state = randomBytes(32).toString("hex");
  const url = new URL(DISCORD_AUTHORIZE_URL);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url);

  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE,
  });

  if (returnPath) {
    response.cookies.set(OAUTH_RETURN_COOKIE, returnPath, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: OAUTH_STATE_MAX_AGE,
    });
  }

  return response;
}
