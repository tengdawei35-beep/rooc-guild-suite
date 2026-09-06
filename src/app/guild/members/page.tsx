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
          characterName: "asc",
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
          <Link href="/" className="text-sm text-zinc-500 hover:text-white">← Dashboard</Link>
          <div className="mt-8 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
            <h1 className="text-xl font-semibold">No guild configured</h1>
            <p className="mt-2 text-sm text-zinc-400">Configure your guild before managing members.</p>
            <Link href="/guild" className="mt-6 inline-flex rounded-lg bg-white px-5 py-3 font-medium text-black hover:bg-zinc-200">Configure Guild</Link>
          </div>
        </div>
      </main>
    );
  }

  const canViewOtherStats = auth.role !== "MEMBER";

  const members = guild.members.map((member) => {
    const isOwnMember = member.userId === auth.user.id || member.discordUserId === auth.user.discordId;
    const canViewCharacterStats = canViewOtherStats || isOwnMember;

    return {
      id: member.id,
      updatedAt: member.updatedAt.toISOString(),
      userId: member.userId,
      discordUserId: member.discordUserId,
      discordUsername: member.discordUsername,
      characterName: member.characterName,
      job: member.job,

      pdef: canViewCharacterStats ? member.pdef : null,
      mdef: canViewCharacterStats ? member.mdef : null,
      pvpDamageBonus: canViewCharacterStats ? member.pvpDamageBonus : null,
      pvpDamageReduction: canViewCharacterStats ? member.pvpDamageReduction : null,
      pdmgPercent: canViewCharacterStats ? member.pdmgPercent : null,
      mdmgPercent: canViewCharacterStats ? member.mdmgPercent : null,
      pdmgReductionPercent: canViewCharacterStats ? member.pdmgReductionPercent : null,
      mdmgReductionPercent: canViewCharacterStats ? member.mdmgReductionPercent : null,
      critRes: canViewCharacterStats ? member.critRes : null,
      ignorePdef: canViewCharacterStats ? member.ignorePdef : null,
      ignoreMdef: canViewCharacterStats ? member.ignoreMdef : null,
      damageVsMedium: canViewCharacterStats ? member.damageVsMedium : null,
      damageReductionVsMedium: canViewCharacterStats ? member.damageReductionVsMedium : null,
      damageVsSmall: canViewCharacterStats ? member.damageVsSmall : null,
      damageReductionVsSmall: canViewCharacterStats ? member.damageReductionVsSmall : null,
      damageVsDemiHuman: canViewCharacterStats ? member.damageVsDemiHuman : null,
      damageReductionVsDemiHuman: canViewCharacterStats ? member.damageReductionVsDemiHuman : null,
      damageVsBrute: canViewCharacterStats ? member.damageVsBrute : null,
      damageReductionVsBrute: canViewCharacterStats ? member.damageReductionVsBrute : null,
      equipmentPdefPercent: canViewCharacterStats ? member.equipmentPdefPercent : null,
      equipmentMdefPercent: canViewCharacterStats ? member.equipmentMdefPercent : null,
      patk: canViewCharacterStats ? member.patk : null,
      matk: canViewCharacterStats ? member.matk : null,
      hp: canViewCharacterStats ? member.hp : null,

      active: member.active,
      eligible: member.eligible,
      priority: member.priority,
      remarks: member.remarks,
      leaveDates: member.leaveDates.map((leave) => ({
        id: leave.id,
        date: leave.date.toISOString(),
        reason: leave.reason,
      })),
    };
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-8">
          <Link href="/" className="text-sm text-zinc-500 hover:text-white">← Dashboard</Link>
          <div className="mt-4">
            <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">{guild.name}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Guild Members</h1>
            <p className="mt-2 text-zinc-400">Manage member profiles, jobs, combat statistics, eligibility and activity.</p>
          </div>
        </header>
        <MembersClient initialMembers={members} />
      </div>
    </main>
  );
}
