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

import ReservationsClient from "./ReservationsClient";

export default async function ReservationsPage() {
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
              You do not have permission to view guild reservations.
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
          members: {
            where: {
              active: true,
            },

            orderBy: {
              displayName:
                "asc",
            },
          },

          resources: {
            where: {
              active: true,
            },

            orderBy: {
              name: "asc",
            },
          },

          reservedAllocations: {
            include: {
              member: true,
              resource: true,
            },

            orderBy: [
              {
                member: {
                  displayName:
                    "asc",
                },
              },

              {
                resource: {
                  name:
                    "asc",
                },
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

  const members =
    guild.members.map(
      (member) => ({
        id:
          member.id,

        displayName:
          member.displayName,

        priority:
          member.priority,

        eligible:
          member.eligible,
      })
    );

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
      })
    );

  const reservations =
    guild.reservedAllocations.map(
      (reservation) => ({
        id:
          reservation.id,

        memberId:
          reservation.memberId,

        resourceId:
          reservation.resourceId,

        quantity:
          reservation.quantity,

        memberName:
          reservation.member
            .displayName,

        resourceName:
          reservation.resource
            .name,

        resourceType:
          reservation.resource
            .type,

        resourceTotal:
          reservation.resource
            .total,
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
              Reservations
            </h1>

            <p className="mt-2 text-zinc-400">
              Reserve resources for specific guild members before an allocation run.
            </p>
          </div>
        </header>

        <ReservationsClient
          initialMembers={
            members
          }
          initialResources={
            resources
          }
          initialReservations={
            reservations
          }
        />
      </div>
    </main>
  );
}