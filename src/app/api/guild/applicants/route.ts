import { NextResponse } from "next/server";
import { getCurrentAuth, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findClosestRooMember, scoreRooPlayers } from "@/lib/scoring/roo-scoring";

const MEMBER_STATS_SELECT = {
  job: true, pdef: true, mdef: true, pvpDamageBonus: true, pvpDamageReduction: true,
  pdmgPercent: true, mdmgPercent: true, pdmgReductionPercent: true, mdmgReductionPercent: true,
  critRes: true, ignorePdef: true, ignoreMdef: true, damageVsMedium: true, damageReductionVsMedium: true,
  damageVsSmall: true, damageReductionVsSmall: true, damageVsDemiHuman: true, damageReductionVsDemiHuman: true,
  damageVsBrute: true, damageReductionVsBrute: true, equipmentPdefPercent: true, equipmentMdefPercent: true,
  patk: true, matk: true, hp: true,
} as const;

function forbidden() {
  return NextResponse.json({ error: "You do not have permission to manage guild applicants." }, { status: 403 });
}

async function buildComparison(guildId: string, applicant: Awaited<ReturnType<typeof prisma.guildApplicant.findFirst>>) {
  if (!applicant) return null;

  const members = await prisma.guildMember.findMany({ where: { guildId, active: true }, select: { id: true, characterName: true, ...MEMBER_STATS_SELECT } });
  const scored = scoreRooPlayers([
    ...members,
    {
      characterName: applicant.characterName,
      job: applicant.job, pdef: applicant.pdef, mdef: applicant.mdef,
      pvpDamageBonus: applicant.pvpDamageBonus, pvpDamageReduction: applicant.pvpDamageReduction,
      pdmgPercent: applicant.pdmgPercent, mdmgPercent: applicant.mdmgPercent,
      pdmgReductionPercent: applicant.pdmgReductionPercent, mdmgReductionPercent: applicant.mdmgReductionPercent,
      critRes: applicant.critRes, ignorePdef: applicant.ignorePdef, ignoreMdef: applicant.ignoreMdef,
      damageVsMedium: applicant.damageVsMedium, damageReductionVsMedium: applicant.damageReductionVsMedium,
      damageVsSmall: applicant.damageVsSmall, damageReductionVsSmall: applicant.damageReductionVsSmall,
      damageVsDemiHuman: applicant.damageVsDemiHuman, damageReductionVsDemiHuman: applicant.damageReductionVsDemiHuman,
      damageVsBrute: applicant.damageVsBrute, damageReductionVsBrute: applicant.damageReductionVsBrute,
      equipmentPdefPercent: applicant.equipmentPdefPercent, equipmentMdefPercent: applicant.equipmentMdefPercent,
      patk: applicant.patk, matk: applicant.matk, hp: applicant.hp,
    },
  ]);

  const applicantScore = scored[scored.length - 1];
  const currentMemberScores = scored.slice(0, -1);
  const closest = findClosestRooMember(applicantScore, currentMemberScores);

  return {
    scores: {
      dpsScore: applicantScore.dpsScore, tankScore: applicantScore.tankScore, pvpScore: applicantScore.pvpScore,
      dpsPercentile: applicantScore.dpsPercentile, tankPercentile: applicantScore.tankPercentile, pvpPercentile: applicantScore.pvpPercentile,
      rawPdef: applicantScore.rawPdef, rawMdef: applicantScore.rawMdef,
    },
    closest: closest ? {
      distance: closest.distance,
      characterName: closest.member.characterName ?? null,
      job: closest.member.job ?? null,
      dpsScore: closest.member.dpsScore, tankScore: closest.member.tankScore, pvpScore: closest.member.pvpScore,
      dpsPercentile: closest.member.dpsPercentile, tankPercentile: closest.member.tankPercentile, pvpPercentile: closest.member.pvpPercentile,
    } : null,
  };
}

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "applicants.view")) return forbidden();

  const applicants = await prisma.guildApplicant.findMany({ where: { guildId: auth.guild.id }, orderBy: { createdAt: "desc" } });
  const result = await Promise.all(applicants.map(async (applicant) => ({ ...applicant, comparison: await buildComparison(auth.guild.id, applicant) })));
  return NextResponse.json({ applicants: result });
}

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "applicants.manage")) return forbidden();

  const body = (await request.json()) as { id?: string; decision?: "ACCEPTED" | "DENIED"; remarks?: string };
  if (!body.id || !body.decision) return NextResponse.json({ error: "Applicant ID and decision are required." }, { status: 400 });

  const applicant = await prisma.guildApplicant.findFirst({ where: { id: body.id, guildId: auth.guild.id } });
  if (!applicant) return NextResponse.json({ error: "Applicant not found." }, { status: 404 });
  if (applicant.status !== "PENDING") return NextResponse.json({ error: "This application has already been decided." }, { status: 409 });

  if (body.decision === "DENIED") {
    const updated = await prisma.guildApplicant.update({ where: { id: applicant.id }, data: { status: "DENIED", remarks: body.remarks?.trim() || null, decidedAt: new Date(), decidedByUserId: auth.user.id } });
    return NextResponse.json({ application: updated });
  }

  const existingMember = await prisma.guildMember.findFirst({ where: { guildId: auth.guild.id, discordUserId: applicant.discordUserId } });
  if (existingMember) return NextResponse.json({ error: "This Discord account is already a guild member." }, { status: 409 });
  if (!applicant.userId) return NextResponse.json({ error: "Applicant Discord account is not linked to a user record." }, { status: 409 });
  if (!applicant.characterName?.trim()) return NextResponse.json({ error: "Applicant character name is required before acceptance." }, { status: 409 });
  if (!applicant.job?.trim()) return NextResponse.json({ error: "Applicant job is required before acceptance." }, { status: 409 });

  const created = await prisma.$transaction(async (tx) => {
    const member = await tx.guildMember.create({
      data: {
        guildId: auth.guild.id, userId: applicant.userId, discordUserId: applicant.discordUserId, discordUsername: applicant.discordUsername,
        characterName: applicant.characterName.trim(), job: applicant.job.trim(), active: true, eligible: true,
        pdef: applicant.pdef, mdef: applicant.mdef, pvpDamageBonus: applicant.pvpDamageBonus, pvpDamageReduction: applicant.pvpDamageReduction,
        pdmgPercent: applicant.pdmgPercent, mdmgPercent: applicant.mdmgPercent, pdmgReductionPercent: applicant.pdmgReductionPercent,
        mdmgReductionPercent: applicant.mdmgReductionPercent, critRes: applicant.critRes, ignorePdef: applicant.ignorePdef, ignoreMdef: applicant.ignoreMdef,
        damageVsMedium: applicant.damageVsMedium, damageReductionVsMedium: applicant.damageReductionVsMedium,
        damageVsSmall: applicant.damageVsSmall, damageReductionVsSmall: applicant.damageReductionVsSmall,
        damageVsDemiHuman: applicant.damageVsDemiHuman, damageReductionVsDemiHuman: applicant.damageReductionVsDemiHuman,
        damageVsBrute: applicant.damageVsBrute, damageReductionVsBrute: applicant.damageReductionVsBrute,
        equipmentPdefPercent: applicant.equipmentPdefPercent, equipmentMdefPercent: applicant.equipmentMdefPercent,
        patk: applicant.patk, matk: applicant.matk, hp: applicant.hp,
      },
    });

    await tx.guildMembership.upsert({
      where: { userId_guildId: { userId: applicant.userId, guildId: auth.guild.id } },
      update: { role: "MEMBER" },
      create: { userId: applicant.userId, guildId: auth.guild.id, role: "MEMBER" },
    });

    await tx.guildApplicant.update({ where: { id: applicant.id }, data: { status: "ACCEPTED", remarks: body.remarks?.trim() || null, decidedAt: new Date(), decidedByUserId: auth.user.id } });
    return member;
  });

  return NextResponse.json({ success: true, member: created });
}
