import Link from "next/link";
import { prisma } from "@/lib/prisma";
import MembersClient from "./MembersClient";
import { requirePageAuth } from "@/lib/auth";

export default async function MembersPage() {
  const auth = await requirePageAuth();
  const guild = await prisma.guild.findUnique({
    where: { id: auth.guild.id },
    include: {
      members: {
        orderBy: { characterName: "asc" },
        include: {
          leaveDates: {
            orderBy: { date: "asc" },
          },
        },
      },
    },
  });

  if (!guild) {
    return (
      <main className="hmdl-management hmdl-member-directory-workspace min-h-screen text-white">
        <div className="hmdl-page mx-auto max-w-7xl">
          <div className="hmdl-empty">
            <h1 className="text-xl font-semibold text-zinc-200">No guild configured</h1>
            <p className="mt-2 text-sm">Configure your guild before managing members.</p>
            <Link href="/guild" className="hmdl-btn hmdl-btn-primary mt-5">Configure Guild</Link>
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
      ro3Stats: canViewCharacterStats ? member.ro3Stats as Record<string, number | null> | null : null,
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
    <MembersClient initialMembers={members} gameType={guild.gameType} />
  );
}