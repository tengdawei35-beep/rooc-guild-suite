import { NextResponse } from "next/server";

const DISCORD_AUTHORIZE_URL =
  "https://discord.com/oauth2/authorize";

export async function GET(
  request: Request
) {
  const clientId =
    process.env
      .DISCORD_CLIENT_ID;

  const appUrl =
    process.env.APP_URL;

  if (
    !clientId ||
    !appUrl
  ) {
    return NextResponse.json(
      {
        error:
          "Discord authentication is not configured.",
      },
      {
        status: 500,
      }
    );
  }

  const redirectUri =
    `${appUrl}/api/auth/discord/callback`;

  const url =
    new URL(
      DISCORD_AUTHORIZE_URL
    );

  url.searchParams.set(
    "client_id",
    clientId
  );

  url.searchParams.set(
    "redirect_uri",
    redirectUri
  );

  url.searchParams.set(
    "response_type",
    "code"
  );

  url.searchParams.set(
    "scope",
    "identify"
  );

  return NextResponse.redirect(
    url
  );
}