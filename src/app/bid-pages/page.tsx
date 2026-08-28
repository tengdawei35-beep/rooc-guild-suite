import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageAuth } from "@/lib/auth";

export default async function BidPagesPage() {
  await requirePageAuth();
  const guild = await prisma.guild.findFirst({
    select: {
      id: true,
      name: true,
    },
  });

  if (!guild) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-white"
          >
            ← Dashboard
          </Link>

          <section className="mt-8 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
            <h1 className="text-xl font-semibold">
              No guild configured
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              Configure your guild before viewing bid pages.
            </p>

            <Link
              href="/guild"
              className="mt-6 inline-flex rounded-lg bg-white px-5 py-3 font-medium text-black hover:bg-zinc-200"
            >
              Configure Guild
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const latestRun =
    await prisma.allocationRun.findFirst({
      where: {
        guildId: guild.id,
        status: "COMPLETED",

        bidPages: {
          some: {},
        },
      },

      orderBy: {
        createdAt: "desc",
      },

      select: {
        id: true,
      },
    });

  if (latestRun) {
    redirect(
      `/allocation/${latestRun.id}/bids`
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-white"
        >
          ← Dashboard
        </Link>

        <section className="mt-8 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
          <h1 className="text-xl font-semibold">
            No bid pages available
          </h1>

          <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-400">
            There are no completed allocations with generated
            bidding pages yet.
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/allocation"
              className="rounded-lg bg-white px-5 py-3 font-medium text-black hover:bg-zinc-200"
            >
              Create Allocation
            </Link>

            <Link
              href="/allocation/history"
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-3 font-medium text-white hover:bg-zinc-800"
            >
              Allocation History
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}