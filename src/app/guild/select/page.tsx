import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import {
  GUILD_SELECTION_COOKIE,
  verifyGuildSelectionToken,
} from "@/lib/guild-selection";

export default async function GuildSelectionPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(GUILD_SELECTION_COOKIE)?.value;

  if (!token) {
    redirect("/login?error=authentication_failed");
  }

  const selection = verifyGuildSelectionToken(token);

  if (!selection) {
    cookieStore.set(GUILD_SELECTION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    redirect("/login?error=authentication_failed");
  }

  const memberships = await prisma.guildMembership.findMany({
    where: {
      userId: selection.userId,
    },
    include: {
      guild: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (memberships.length === 0) {
    cookieStore.set(GUILD_SELECTION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    redirect("/login?error=no_guild_access");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white">Select Guild</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Your Discord account has access to multiple guilds. Choose where you want to continue.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          {memberships.map((membership) => (
            <form key={membership.guildId} action="/api/auth/guild/select" method="POST">
              <input type="hidden" name="guildId" value={membership.guildId} />
              <button
                type="submit"
                className="block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-4 text-left transition hover:border-zinc-500 hover:bg-zinc-700"
              >
                <div className="font-medium text-white">{membership.guild.name}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
                  {membership.role}
                </div>
              </button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
