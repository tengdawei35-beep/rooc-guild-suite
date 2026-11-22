import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SwitchGuildPage() {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/login?error=authentication_required");

  const memberships = await prisma.guildMembership.findMany({
    where: { userId: auth.user.id },
    include: { guild: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="hmdl-guild-access-workspace flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12">
      <div className="hmdl-access-card w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <Link href="/" className="text-sm text-zinc-500 hover:text-white">← Back to dashboard</Link>
        <h1 className="mt-6 text-2xl font-semibold text-white">Switch Guild</h1>
        <p className="mt-2 text-sm text-zinc-400">Choose which guild you want to manage. Your account and access to each guild will remain unchanged.</p>
        <div className="mt-6 space-y-3">
          {memberships.map((membership) => (
            <form key={membership.guildId} action="/api/auth/guild/switch" method="POST">
              <input type="hidden" name="guildId" value={membership.guildId} />
              <button
                type="submit"
                disabled={membership.guildId === auth.guild.id}
                className="flex w-full items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-left transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-default disabled:border-emerald-800/70 disabled:bg-emerald-950/20"
              >
                <span>
                  <span className="block font-medium text-white">{membership.guild.name}</span>
                  <span className="mt-1 block text-xs uppercase tracking-wide text-zinc-500">{membership.role} · {membership.guild.gameType}</span>
                </span>
                <span className="ml-4 text-xs font-medium text-zinc-400">{membership.guildId === auth.guild.id ? "Current guild" : "Switch →"}</span>
              </button>
            </form>
          ))}
        </div>
        {memberships.length < 2 && <p className="mt-5 text-sm text-zinc-500">Your account currently has access to only one guild.</p>}
      </div>
    </main>
  );
}
