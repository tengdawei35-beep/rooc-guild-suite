import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getPlatformAdmin } from "@/lib/platform-admin";
import GuildCreatorsClient from "./GuildCreatorsClient";

export default async function GuildCreatorsAdminPage() {
  const admin = await getPlatformAdmin();

  if (!admin) {
    redirect("/login");
  }

  const creators = await prisma.platformGuildCreator.findMany({
    orderBy: { discordUsername: "asc" },
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/" className="text-sm text-zinc-500 hover:text-white">
          ← Dashboard
        </Link>

        <div className="mt-8">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
            Platform Administration
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Guild Creators
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Control which Discord accounts can create guilds and how many guilds each account may own.
          </p>
        </div>

        <div className="mt-8">
          <GuildCreatorsClient initialCreators={creators} />
        </div>
      </div>
    </main>
  );
}
