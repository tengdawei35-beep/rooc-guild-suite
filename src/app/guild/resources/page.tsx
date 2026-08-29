import Link from "next/link";

import {
  requirePageAuth,
} from "@/lib/auth";

import {
  hasPermission,
} from "@/lib/permissions";

import {
  hasGuildModule,
  RESOURCE_SUITE_MODULE,
} from "@/lib/auth/modules";

import {
  prisma,
} from "@/lib/prisma";

import ResourcesClient from "./ResourcesClient";

export default async function ResourcesPage() {
  const auth =
    await requirePageAuth();

  if (
    !(await hasGuildModule(
      auth.guild.id,
      RESOURCE_SUITE_MODULE
    ))
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

          <div className="mt-8 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
            <h1 className="text-xl font-semibold">
              Resource Suite required
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              Guild Resources are part of the Resource Suite and are not enabled for this guild.
            </p>
          </div>
        </div>
      </main>
    );
  }

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
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-white"
        >
          ← Dashboard
        </Link>

        <div className="mt-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Guild Resources
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            Manage the resources available for allocation and bidding.
          </p>
        </div>

        <ResourcesClient
          initialResources={resources}
        />
      </div>
    </main>
  );
}
