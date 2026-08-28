import Link from "next/link";

import {
  requirePageAuth,
} from "@/lib/auth";

import {
  hasPermission,
} from "@/lib/permissions";

import {
  prisma,
} from "@/lib/prisma";

import ResourcesClient from "./ResourcesClient";

export default async function ResourcesPage() {
  const auth =
    await requirePageAuth();

  if (
    !hasPermission(
      auth.role,
      "allocation.view"
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
              You do not have permission to view guild resources.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const guild =
    await prisma.guild.findUnique(
      {
        where: {
          id:
            auth.guild.id,
        },

        include: {
          resources: {
            orderBy: [
              {
                type: "asc",
              },

              {
                name: "asc",
              },
            ],
          },
        },
      }
    );

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

          <div className="mt-8 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
            <h1 className="text-xl font-semibold">
              Guild unavailable
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              Your current guild could not be found.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const resources =
    guild.resources.map(
      (resource) => ({
        id:
          resource.id,

        name:
          resource.name,

        type:
          resource.type,

        total:
          resource.total,

        perPlayerLimit:
          resource.perPlayerLimit,

        hardCap:
          resource.hardCap,

        active:
          resource.active,
      })
    );

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-8">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-white"
          >
            ← Dashboard
          </Link>

          <div className="mt-4">
            <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
              {guild.name}
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Resources
            </h1>

            <p className="mt-2 text-zinc-400">
              Manage feathers, cards and their allocation limits.
            </p>
          </div>
        </header>

        <ResourcesClient
          initialResources={
            resources
          }
        />
      </div>
    </main>
  );
}