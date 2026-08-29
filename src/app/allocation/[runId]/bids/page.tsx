import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import BidsClient from "./BidsClient";

import {
  requirePageAuth,
} from "@/lib/auth";
import {
  hasGuildModule,
  RESOURCE_SUITE_MODULE,
} from "@/lib/auth/modules";

type Props = {
  params: Promise<{
    runId: string;
  }>;
};

export default async function BidsPage({ params }: Props) {
  const auth = await requirePageAuth();

  if (!(await hasGuildModule(auth.guild.id, RESOURCE_SUITE_MODULE))) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <Link href="/" className="text-sm text-zinc-500 hover:text-white">
            ← Dashboard
          </Link>
          <section className="mt-8 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
            <h1 className="text-xl font-semibold">Resource Suite required</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Bid Pages are part of the Resource Suite and are not enabled for this guild.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const { runId } = await params;

  const run = await prisma.allocationRun.findFirst({
    where: {
      id: runId,
      guildId: auth.guild.id,
    },
    include: {
      guild: { select: { name: true } },
      bidPages: {
        orderBy: [{ type: "asc" }, { pageNumber: "asc" }],
        include: {
          slots: {
            orderBy: { slotNumber: "asc" },
            include: {
              member: { select: { id: true, characterName: true } },
              resource: { select: { id: true, name: true, type: true } },
            },
          },
        },
      },
    },
  });

  if (!run) {
    notFound();
  }

  const feathers = run.bidPages.filter((page) => page.type === "FEATHER");
  const cards = run.bidPages.filter((page) => page.type === "CARD");

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/bid-pages" className="text-sm text-zinc-500 hover:text-white">
            ← Bid Pages
          </Link>
        </div>

        <header className="mt-6">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
            {run.guild.name}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Bid Pages</h1>
          <p className="mt-2 text-sm text-zinc-400">Run {run.id}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <StatusBadge status={run.status} />
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
              {feathers.length} Feather {feathers.length === 1 ? "Page" : "Pages"}
            </span>
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
              {cards.length} Card {cards.length === 1 ? "Page" : "Pages"}
            </span>
          </div>
        </header>

        {run.bidPages.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
            <h2 className="text-xl font-semibold">No bid pages generated</h2>
            <p className="mt-2 text-sm text-zinc-400">
              This allocation was created before bid page generation was enabled.
            </p>
          </section>
        ) : (
          <BidsClient feathers={feathers} cards={cards} />
        )}
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "COMPLETED") {
    return <span className="rounded-full border border-emerald-900 bg-emerald-950/40 px-3 py-1 text-xs text-emerald-400">Completed</span>;
  }
  if (status === "FAILED") {
    return <span className="rounded-full border border-red-900 bg-red-950/40 px-3 py-1 text-xs text-red-400">Failed</span>;
  }
  return <span className="rounded-full border border-amber-900 bg-amber-950/40 px-3 py-1 text-xs text-amber-400">Running</span>;
}
