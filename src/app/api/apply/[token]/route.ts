import { NextResponse } from "next/server";

import { getApplicantSession } from "@/lib/auth/applicant";
import { prisma } from "@/lib/prisma";
import { scoreRooPlayers } from "@/lib/scoring/roo-scoring";

const STAT_FIELDS = [
  "pdef", "mdef", "pvpDamageBonus", "pvpDamageReduction", "pdmgPercent", "mdmgPercent",
  "pdmgReductionPercent", "mdmgReductionPercent", "critRes", "ignorePdef", "ignoreMdef",
  "damageVsMedium", "damageReductionVsMedium", "damageVsSmall", "damageReductionVsSmall",
  "damageVsDemiHuman", "damageReductionVsDemiHuman", "damageVsBrute", "damageReductionVsBrute",
  "equipmentPdefPercent", "equipmentMdefPercent", "patk", "matk", "hp",
] as const;

function cleanNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(/,/g, "").replace(/%/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const session = await getApplicantSession();
  if (!session) return NextResponse.json({ error: "Discord authentication required." }, { status: 401 });

  const { token } = await context.params;
  const invite = await prisma.applicantInvite.findFirst({ where: { token, active: true } });
  if (!invite) return NextResponse.json({ error: "This application link is invalid or has been revoked." }, { status: 404 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "Discord identity could not be found." }, { status: 401 });

  const existingMember = await prisma.guildMember.findFirst({ where: { guildId: invite.guildId, discordUserId: user.discordId }, select: { id: true } });
  if (existingMember) return NextResponse.json({ error: "You are already a member of this guild." }, { status: 409 });

  const body = (await request.json()) as Record<string, unknown>;
  const characterName = String(body.characterName ?? "").trim();
  const job = String(body.job ?? "").trim();
  if (!characterName) return NextResponse.json({ error: "Character Name is required." }, { status: 400 });
  if (!job) return NextResponse.json({ error: "Job is required." }, { status: 400 });

  const applicantStats = Object.fromEntries(STAT_FIELDS.map((field) => [field, cleanNumber(body[field])])) as Record<(typeof STAT_FIELDS)[number], number>;
  const members = await prisma.guildMember.findMany({
    where: { guildId: invite.guildId, active: true },
    select: {
      job: true, pdef: true, mdef: true, pvpDamageBonus: true, pvpDamageReduction: true,
      pdmgPercent: true, mdmgPercent: true, pdmgReductionPercent: true, mdmgReductionPercent: true,
      critRes: true, ignorePdef: true, ignoreMdef: true, damageVsMedium: true, damageReductionVsMedium: true,
      damageVsSmall: true, damageReductionVsSmall: true, damageVsDemiHuman: true, damageReductionVsDemiHuman: true,
      damageVsBrute: true, damageReductionVsBrute: true, equipmentPdefPercent: true, equipmentMdefPercent: true,
      patk: true, matk: true, hp: true,
    },
  });
  const scored = scoreRooPlayers([...members, { ...applicantStats, job }]);
  const applicant = scored[scored.length - 1];
  const existing = await prisma.guildApplicant.findUnique({ where: { guildId_discordUserId: { guildId: invite.guildId, discordUserId: user.discordId } } });
  if (existing?.status === "ACCEPTED") return NextResponse.json({ error: "Your application has already been accepted." }, { status: 409 });

  const payload = {
    inviteId: invite.id,
    discordUserId: user.discordId,
    discordUsername: user.username,
    userId: user.id,
    characterName,
    job,
    ...applicantStats,
    dpsScore: applicant.dpsScore,
    tankScore: applicant.tankScore,
    pvpScore: applicant.pvpScore,
    dpsPercentile: applicant.dpsPercentile,
    tankPercentile: applicant.tankPercentile,
    pvpPercentile: applicant.pvpPercentile,
    status: "PENDING" as const,
    reviewedAt: null,
    reviewedByUserId: null,
    decidedAt: null,
    decidedByUserId: null,
  };

  const saved = existing
    ? await prisma.guildApplicant.update({ where: { id: existing.id }, data: payload })
    : await prisma.guildApplicant.create({ data: { guildId: invite.guildId, ...payload } });

  return NextResponse.json({ application: saved });
}
