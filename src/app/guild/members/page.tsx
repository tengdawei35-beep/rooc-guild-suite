import Link from "next/link";
import { prisma } from "@/lib/prisma";
import MembersClient from "./MembersClient";
import { requirePageAuth } from "@/lib/auth";

export default async function MembersPage() {
  const auth = await requirePageAuth();
  const guild = await prisma.guild.findUnique({
    where: {
      id: auth.guild.id,
    },
    include: {
      members: {
        orderBy: {
          displayName: "asc",
        },
        include: {
          leaveDates: {
            orderBy: {
              date: "asc",
            },
          },
        },
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
              Configure your guild before managing members.
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

    // Used by MembersClient to determine
    // whether the authenticated MEMBER owns this profile.
    userId: member.userId,

    // Discord identity is stored separately from the
    // display name so authentication can match either
    // the numeric Discord ID or username as appropriate.
    discordUserId: member.discordUserId,
    discordUsername: member.discordUsername,

    displayName: member.displayName,
    characterName: member.characterName,
    job: member.job,

    pdef: member.pdef,
    mdef: member.mdef,

    pvpDamageBonus:
      member.pvpDamageBonus,

    pvpDamageReduction:
      member.pvpDamageReduction,

    pdmgPercent:
      member.pdmgPercent,

    mdmgPercent:
      member.mdmgPercent,

    pdmgReductionPercent:
      member.pdmgReductionPercent,

    mdmgReductionPercent:
      member.mdmgReductionPercent,

    critRes:
      member.critRes,

    ignorePdef:
      member.ignorePdef,

    ignoreMdef:
      member.ignoreMdef,

    damageVsMedium:
      member.damageVsMedium,

    damageReductionVsMedium:
      member.damageReductionVsMedium,

    damageVsSmall:
      member.damageVsSmall,

    damageReductionVsSmall:
      member.damageReductionVsSmall,

    damageVsDemiHuman:
      member.damageVsDemiHuman,

    damageReductionVsDemiHuman:
      member.damageReductionVsDemiHuman,

    damageVsBrute:
      member.damageVsBrute,

    damageReductionVsBrute:
      member.damageReductionVsBrute,

    equipmentPdefPercent:
      member.equipmentPdefPercent,

    equipmentMdefPercent:
      member.equipmentMdefPercent,

    patk: member.patk,
    matk: member.matk,
    hp: member.hp,

    active: member.active,
    eligible: member.eligible,

    priority: member.priority,

    remarks: member.remarks,

    leaveDates:
      member.leaveDates.map(
        (leave) => ({
          id: leave.id,

          date:
            leave.date.toISOString(),

          reason:
            leave.reason,
        })
      ),
  }));

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
              Guild Members
            </h1>

            <p className="mt-2 text-zinc-400">
              Manage member profiles, jobs,
              combat statistics, eligibility
              and activity.
            </p>
          </div>
        </header>

        <MembersClient
          initialMembers={members}
        />
      </div>
    </main>
  );
}
