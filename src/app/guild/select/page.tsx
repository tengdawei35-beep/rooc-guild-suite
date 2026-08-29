import Link from "next/link";
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
    where: { userId: selection.userId },
    include: { guild: true },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length === 0) {
    cookieStore.set(GUILD_SELECTION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    redirect("/billing/new");
  }

  const user = await prisma.user.findUnique({
    where: { id: selection.userId },
  });

  const creator = user
    ? await prisma.platformGuildCreator.findUnique({
        where: { discordUserId: user.discordId },
      })
    : null;

  const ownedGuildCount = creator
    ? await prisma.guild.count({ where: { ownerUserId: selection.userId } })
    : 0;
  const canCreateGuild = Boolean(
    creator?.active && ownedGuildCount < creator.maxGuilds
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white">Select Guild</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Choose a guild to manage, or create another guild if your account is authorized to do so.
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

        {canCreateGuild && (
          <div className="mt-6 border-t border-zinc-800 pt-6">
            <Link
              href="/billing/new"
              className="flex w-full items-center justify-center rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              Create another guild
            </Link>
            <p className="mt-2 text-center text-xs text-zinc-600">
              {creator?.maxGuilds! - ownedGuildCount} guild creation slot{creator?.maxGuilds! - ownedGuildCount === 1 ? "" : "s"} remaining.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
