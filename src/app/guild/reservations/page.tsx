import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ReservationsClient from "./ReservationsClient";
import { requirePageAuth } from "@/lib/auth";

export default async function ReservationsPage() {
  await requirePageAuth();
  const guild = await prisma.guild.findFirst({
    include: {
      members: {
        where: {
          active: true,
        },
        orderBy: {
          displayName: "asc",
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
              displayName: "asc",
            },
          },
          {
            resource: {
              name: "asc",
            },
          },
        ],
      },
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

          <div className="mt-8 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
            <h1 className="text-xl font-semibold">
              No guild configured
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              Configure your guild before adding reservations.
            </p>

            <Link
              href="/guild"
              className="mt-6 inline-flex rounded-lg bg-white px-5 py-3 font-medium text-black hover:bg-zinc-200"
            >
              Configure Guild
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const members = guild.members.map((member) => ({
    id: member.id,
    displayName: member.displayName,
    priority: member.priority,
    eligible: member.eligible,
  }));

  const resources = guild.resources.map((resource) => ({
    id: resource.id,
    name: resource.name,
    type: resource.type,
    total: resource.total,
    perPlayerLimit: resource.perPlayerLimit,
  }));

  const reservations = guild.reservedAllocations.map(
    (reservation) => ({
      id: reservation.id,
      memberId: reservation.memberId,
      resourceId: reservation.resourceId,
      quantity: reservation.quantity,
      memberName: reservation.member.displayName,
      resourceName: reservation.resource.name,
      resourceType: reservation.resource.type,
      resourceTotal: reservation.resource.total,
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
          initialMembers={members}
          initialResources={resources}
          initialReservations={reservations}
        />
      </div>
    </main>
  );
}