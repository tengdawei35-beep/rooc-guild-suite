import RankingsClient from "./RankingsClient";

import {
  requirePageAuth,
} from "@/lib/auth";

import {
  hasPermission,
} from "@/lib/permissions";

import Link from "next/link";

export default async function RankingsPage() {
  const auth =
    await requirePageAuth();

  if (
    !hasPermission(
      auth.role,
      "members.view"
    )
  ) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-white"
          >
            ← Dashboard
          </Link>

          <div className="mt-8 rounded-2xl border border-red-900 bg-zinc-900 p-8">
            <h1 className="text-xl font-semibold">
              Access Denied
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              You do not have permission to view guild rankings.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <RankingsClient />
  );
}