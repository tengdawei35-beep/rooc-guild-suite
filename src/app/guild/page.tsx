import Link from "next/link";

import {
  prisma,
} from "@/lib/prisma";

import {
  requirePageAuth,
  hasPermission,
} from "@/lib/auth";

import GuildForm from "./GuildForm";

export default async function GuildPage() {
  const auth = await requirePageAuth();

  if (!hasPermission(auth.role, "guild.manage")) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <Link href="/" className="text-sm text-zinc-500 hover:text-white">← Dashboard</Link>
          <div className="mt-8 rounded-2xl border border-red-900 bg-zinc-900 p-8">
            <h1 className="text-xl font-semibold">Access Denied</h1>
            <p className="mt-2 text-sm text-zinc-400">You do not have permission to manage guild settings.</p>
          </div>
        </div>
      </main>
    );
  }

  const guild = await prisma.guild.findUnique({ where: { id: auth.guild.id } });

  if (!guild) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <Link href="/" className="text-sm text-zinc-500 hover:text-white">← Dashboard</Link>
          <div className="mt-8 rounded-2xl border border-red-900 bg-zinc-900 p-8">
            <h1 className="text-xl font-semibold">Guild Not Found</h1>
            <p className="mt-2 text-sm text-zinc-400">The guild associated with your session could not be found.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-8">
          <Link href="/" className="mb-6 inline-block text-sm text-zinc-500 transition hover:text-white">← Dashboard</Link>
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-zinc-500">ROO Guild Suite</p>
          <h1 className="text-3xl font-bold tracking-tight">Guild</h1>
          <p className="mt-2 text-zinc-400">Manage your guild configuration, members and access.</p>
        </header>

        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Guild Management</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/guild/members" className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-600 hover:bg-zinc-800">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-zinc-100 group-hover:text-white">Members</h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-500">Manage guild members, character profiles, jobs, statistics and availability.</p>
                </div>
                <span className="text-zinc-600 transition group-hover:text-zinc-300">→</span>
              </div>
            </Link>

            <Link href="/guild/users" className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-600 hover:bg-zinc-800">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-zinc-100 group-hover:text-white">Users</h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-500">Manage Discord accounts and their guild roles and access.</p>
                </div>
                <span className="text-zinc-600 transition group-hover:text-zinc-300">→</span>
              </div>
            </Link>

            <Link href="/guild/notifications" className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-600 hover:bg-zinc-800 sm:col-span-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-zinc-100 group-hover:text-white">Discord Notifications</h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-500">Connect dedicated Discord channels for roster updates, completed bid pages and stat reminders.</p>
                </div>
                <span className="text-zinc-600 transition group-hover:text-zinc-300">→</span>
              </div>
            </Link>
          </div>
        </section>

        <section>
          <div className="mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Guild Setup</h2>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <GuildForm guild={{ id: guild.id, name: guild.name, discordGuildId: guild.discordGuildId }} />
          </div>
        </section>
      </div>
    </main>
  );
}
