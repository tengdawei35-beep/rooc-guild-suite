import { getApplicantSession } from "@/lib/auth/applicant";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ApplicantApplyClient from "./ApplicantApplyClient";

export default async function ApplicantApplyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await prisma.applicantInvite.findFirst({ where: { token, active: true } });

  if (!invite) {
    return <main className="min-h-screen bg-zinc-950 p-6 text-white"><div className="mx-auto max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-8"><h1 className="text-2xl font-bold">Application link unavailable</h1><p className="mt-3 text-zinc-400">This guild application link is invalid or has been revoked.</p></div></main>;
  }

  const session = await getApplicantSession();
  const user = session ? await prisma.user.findUnique({ where: { id: session.userId } }) : null;

  if (!user) {
    const loginHref = `/api/auth/discord?apply=${encodeURIComponent(token)}`;
    return <main className="min-h-screen bg-zinc-950 p-6 text-white"><div className="mx-auto max-w-xl py-16"><div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center"><p className="text-sm font-medium uppercase tracking-widest text-zinc-500">ROO Guild Suite</p><h1 className="mt-3 text-3xl font-bold">Apply to {invite.guildId}</h1><p className="mt-3 text-zinc-400">You must sign in with Discord before submitting a guild application.</p><a href={loginHref} className="mt-7 inline-flex rounded-lg bg-white px-5 py-3 font-medium text-black">Continue with Discord</a></div></div></main>;
  }

  const existing = await prisma.guildApplicant.findFirst({
    where: { guildId: invite.guildId, discordUserId: user.discordId, status: "PENDING" },
    orderBy: { updatedAt: "desc" },
  });

  return <ApplicantApplyClient
    token={token}
    guildId={invite.guildId}
    discordUserId={user.discordId}
    discordUsername={user.username}
    existingApplication={existing ? {
      id: existing.id,
      characterName: existing.characterName,
      job: existing.job,
      pdef: existing.pdef,
      mdef: existing.mdef,
      pvpDamageBonus: existing.pvpDamageBonus,
      pvpDamageReduction: existing.pvpDamageReduction,
      pdmgPercent: existing.pdmgPercent,
      mdmgPercent: existing.mdmgPercent,
      pdmgReductionPercent: existing.pdmgReductionPercent,
      mdmgReductionPercent: existing.mdmgReductionPercent,
      critRes: existing.critRes,
      ignorePdef: existing.ignorePdef,
      ignoreMdef: existing.ignoreMdef,
      damageVsMedium: existing.damageVsMedium,
      damageReductionVsMedium: existing.damageReductionVsMedium,
      damageVsSmall: existing.damageVsSmall,
      damageReductionVsSmall: existing.damageReductionVsSmall,
      damageVsDemiHuman: existing.damageVsDemiHuman,
      damageReductionVsDemiHuman: existing.damageReductionVsDemiHuman,
      damageVsBrute: existing.damageVsBrute,
      damageReductionVsBrute: existing.damageReductionVsBrute,
      equipmentPdefPercent: existing.equipmentPdefPercent,
      equipmentMdefPercent: existing.equipmentMdefPercent,
      patk: existing.patk,
      matk: existing.matk,
      hp: existing.hp,
    } : null}
  />;
}
