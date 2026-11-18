import { NextResponse } from "next/server";

import {
  getCurrentAuth,
} from "@/lib/auth";

export async function GET() {
  const auth =
    await getCurrentAuth();

  if (!auth) {
    return NextResponse.json(
      {
        authenticated: false,
      },
      {
        status: 401,
      }
    );
  }

  return NextResponse.json({
    authenticated: true,

    user: {
      id:
        auth.user.id,

      discordId:
        auth.user.discordId,

      username:
        auth.user.username,

      avatarUrl:
        auth.user.avatarUrl,
    },

    guild: {
      id:
        auth.guild.id,

      discordGuildId:
        auth.guild.discordGuildId,

      name:
        auth.guild.name,
    },

    role:
      auth.role,
  });
}