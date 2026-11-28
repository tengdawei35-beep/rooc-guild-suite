import ManagementPageHeader from "@/app/ManagementPageHeader";
import {
  requirePageAuth,
} from "@/lib/auth";

import {
  hasPermission,
} from "@/lib/permissions";
import { hasGuildModule, RESOURCE_SUITE_MODULE } from "@/lib/auth/modules";

import {
  prisma,
} from "@/lib/prisma";

import ReservationsClient from "./ReservationsClient";

export default async function ReservationsPage() {
  const auth =
    await requirePageAuth();

  if (!(await hasGuildModule(auth.guild.id, RESOURCE_SUITE_MODULE))) {
    return (
      <main className="hmdl-management hmdl-reservations-workspace min-h-screen bg-zinc-950 text-white">
        <div className="hmdl-page mx-auto max-w-7xl px-6 py-10">
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
            <h1 className="text-xl font-semibold">Resource Suite required</h1>
            <p className="mt-2 text-sm text-zinc-400">Reservations are part of the Resource Suite and are not enabled for this guild.</p>
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
      <main className="hmdl-management hmdl-reservations-workspace min-h-screen bg-zinc-950 text-white">
        <div className="hmdl-page mx-auto max-w-7xl px-6 py-10">

          <div className="rounded-2xl border border-red-900 bg-zinc-900 p-8">
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

  const canEdit = hasPermission(auth.role, "allocation.run");

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
              characterName:
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
                  characterName:
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
      <main className="hmdl-management hmdl-reservations-workspace min-h-screen bg-zinc-950 text-white">
        <div className="hmdl-page mx-auto max-w-7xl px-6 py-10">

          <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
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

        characterName:
          member.characterName,

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
            .characterName,

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
    <main className="hmdl-management hmdl-reservations-workspace min-h-screen bg-zinc-950 text-white">
      <div className="hmdl-page mx-auto max-w-7xl px-6 py-10">
        <ManagementPageHeader
          eyebrow="RESOURCES"
          title="Reservations"
          description="Reserve resources for specific guild members before an allocation run."
        />

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
          canEdit={canEdit}
        />
      </div>
    </main>
  );
}