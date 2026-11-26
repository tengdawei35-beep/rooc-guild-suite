import type { Metadata } from "next";
import { getApplicantSession } from "@/lib/auth/applicant";
import { HMDL_MARK } from "@/lib/hmdl-brand";
import { prisma } from "@/lib/prisma";
import ApplicantApplyClient from "./ApplicantApplyClient";

type ApplicantPageProps = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: ApplicantPageProps): Promise<Metadata> {
  const { token } = await params;
  const invite = await prisma.applicantInvite.findFirst({
    where: { token, active: true },
    select: { guildId: true },
  });
  const guild = invite
    ? await prisma.guild.findUnique({ where: { id: invite.guildId }, select: { name: true, gameType: true } })
    : null;
  if (!guild) return { title: "Application link unavailable | Heimdall", description: "This guild application link is invalid or has been revoked.", robots: { index: false, follow: false } };
  const title = `Apply to ${guild.name} | Heimdall`;
  const description = `Submit your ${guild.gameType === "RO3" ? "RO3" : "ROOC"} guild application to ${guild.name} through Heimdall.`;
  return { title, description, openGraph: { title, description, type: "website", siteName: "Heimdall" }, twitter: { card: "summary", title, description }, robots: { index: false, follow: false } };
}

export default async function ApplicantApplyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.applicantInvite.findFirst({ where: { token, active: true } });

  if (!invite) {
    return <main className="hmdl-applicant-portal min-h-screen bg-zinc-950 p-6 text-white"><div className="hmdl-page mx-auto max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-8"><img src={HMDL_MARK} alt="HMDL — Heimdall" className="mb-5 h-20 w-20 object-contain" /><h1 className="text-2xl font-bold">Application link unavailable</h1><p className="mt-3 text-zinc-400">This guild application link is invalid or has been revoked.</p></div></main>;
  }

  const guild = await prisma.guild.findUnique({ where: { id: invite.guildId }, select: { name: true, gameType: true } });
  const session = await getApplicantSession();
  const user = session ? await prisma.user.findUnique({ where: { id: session.userId } }) : null;

  if (!user) {
    const loginHref = `/api/auth/discord?apply=${encodeURIComponent(token)}`;
    return <main className="min-h-screen bg-zinc-950 p-6 text-white"><div className="hmdl-page mx-auto max-w-xl py-16"><div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center"><img src={HMDL_MARK} alt="HMDL — Heimdall" className="mx-auto mb-5 h-24 w-24 object-contain" /><p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300/75">HEIMDALL · GUILD MANAGEMENT SUITE</p><h1 className="mt-3 text-3xl font-bold">Apply to {guild?.name ?? "this guild"}</h1><p className="mt-3 text-zinc-400">You must sign in with Discord before submitting a guild application.</p><a href={loginHref} className="mt-7 inline-flex rounded-lg bg-white px-5 py-3 font-medium text-black">Continue with Discord</a></div></div></main>;
  }

  const existingMember = await prisma.guildMember.findFirst({ where: { guildId: invite.guildId, discordUserId: user.discordId }, select: { id: true } });
  const existing = await prisma.guildApplicant.findFirst({
    where: { guildId: invite.guildId, discordUserId: user.discordId },
    orderBy: { updatedAt: "desc" },
  });

  // An ACCEPTED application only remains locked while the applicant is an
  // active guild member. Former members may use the same application link
  // to submit a fresh application.
  const displayStatus = existing?.status === "ACCEPTED" && !existingMember
    ? "DENIED" as const
    : existing?.status;

  return <ApplicantApplyClient
    token={token}
    guildId={invite.guildId}
    guildName={guild?.name ?? "this guild"}
    gameType={guild?.gameType === "RO3" ? "RO3" : "ROOC"}
    discordUserId={user.discordId}
    discordUsername={user.username}
    existingApplication={existing ? {
      ro3Stats: existing.ro3Stats as Record<string, number|string|null> | undefined,
      id: existing.id,
      characterName: existing.characterName,
      job: existing.job,
      status: displayStatus,
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
