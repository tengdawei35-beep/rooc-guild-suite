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

async function getActiveGuildMembers(guildId: string) {
  return prisma.guildMember.findMany({
    where: { guildId, active: true },
    select: { id: true, characterName: true, ...MEMBER_STATS_SELECT },
  });
}

function buildComparison(
  applicant: Awaited<ReturnType<typeof prisma.guildApplicant.findFirst>>,
  members: Awaited<ReturnType<typeof getActiveGuildMembers>>,
) {
  if (!applicant) return null;
  // This helper is called only for ROOC guilds; RO3 does not use ROOC scoring.
  const scored = scoreRooPlayers([...members, { characterName: applicant.characterName, job: applicant.job, pdef: applicant.pdef, mdef: applicant.mdef, pvpDamageBonus: applicant.pvpDamageBonus, pvpDamageReduction: applicant.pvpDamageReduction, pdmgPercent: applicant.pdmgPercent, mdmgPercent: applicant.mdmgPercent, pdmgReductionPercent: applicant.pdmgReductionPercent, mdmgReductionPercent: applicant.mdmgReductionPercent, critRes: applicant.critRes, ignorePdef: applicant.ignorePdef, ignoreMdef: applicant.ignoreMdef, damageVsMedium: applicant.damageVsMedium, damageReductionVsMedium: applicant.damageReductionVsMedium, damageVsSmall: applicant.damageVsSmall, damageReductionVsSmall: applicant.damageReductionVsSmall, damageVsDemiHuman: applicant.damageVsDemiHuman, damageReductionVsDemiHuman: applicant.damageReductionVsDemiHuman, damageVsBrute: applicant.damageVsBrute, damageReductionVsBrute: applicant.damageReductionVsBrute, equipmentPdefPercent: applicant.equipmentPdefPercent, equipmentMdefPercent: applicant.equipmentMdefPercent, patk: applicant.patk, matk: applicant.matk, hp: applicant.hp }]);
  const applicantScore = scored[scored.length - 1];
  const closest = findClosestRooMember(applicantScore, scored.slice(0, -1));
  return { scores: { dpsScore: applicantScore.dpsScore, tankScore: applicantScore.tankScore, pvpScore: applicantScore.pvpScore, dpsPercentile: applicantScore.dpsPercentile, tankPercentile: applicantScore.tankPercentile, pvpPercentile: applicantScore.pvpPercentile, rawPdef: applicantScore.rawPdef, rawMdef: applicantScore.rawMdef }, closest: closest ? { distance: closest.distance, characterName: closest.member.characterName ?? null, job: closest.member.job ?? null, dpsScore: closest.member.dpsScore, tankScore: closest.member.tankScore, pvpScore: closest.member.pvpScore, dpsPercentile: closest.member.dpsPercentile, tankPercentile: closest.member.tankPercentile, pvpPercentile: closest.member.pvpPercentile } : null };
}

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "applicants.view")) return forbidden();
  // Load the guild roster once. Previously this query ran once per applicant,
  // multiplying database work and delaying the entire response.
  const [guild, applicants, members] = await Promise.all([
    prisma.guild.findUnique({ where: { id: auth.guild.id }, select: { gameType: true } }),
    prisma.guildApplicant.findMany({ where: { guildId: auth.guild.id } }),
    getActiveGuildMembers(auth.guild.id),
  ]);
  const gameType = guild?.gameType === "RO3" ? "RO3" : "ROOC";
  const rankedApplicants = applicants.map((applicant) => ({
    ...applicant,
    comparison: gameType === "ROOC" ? buildComparison(applicant, members) : null,
  }));

  const statusOrder = { PENDING: 0, ACCEPTED: 1, DENIED: 2 } as const;
  rankedApplicants.sort((a, b) => {
    // Pending applicants always appear before applications that have been decided.
    const statusDifference = statusOrder[a.status] - statusOrder[b.status];
    if (statusDifference !== 0) return statusDifference;

    // Within each status group, rank by projected PvP percentile, highest first.
    const standingDifference =
      (b.comparison?.scores.pvpPercentile ?? -1) -
      (a.comparison?.scores.pvpPercentile ?? -1);
    if (standingDifference !== 0) return standingDifference;

    // Then show the newest application first.
    const dateDifference = b.createdAt.getTime() - a.createdAt.getTime();
    if (dateDifference !== 0) return dateDifference;

    return statusDifference;
  });

  return NextResponse.json({ gameType, applicants: rankedApplicants });
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
  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
    // Re-read mutable records inside the transaction so a concurrent game switch
    // or second acceptance cannot create a member using stale application state.
    const [currentGuild, currentApplicant] = await Promise.all([
      tx.guild.findUnique({ where: { id: auth.guild.id }, select: { gameType: true } }),
      tx.guildApplicant.findFirst({ where: { id: applicant.id, guildId: auth.guild.id } }),
    ]);
    if (!currentGuild || !currentApplicant) throw new Error("Guild or applicant not found.");
    if (currentApplicant.status !== "PENDING") throw new Error("This application has already been decided.");
    const gameType = currentGuild.gameType === "RO3" ? "RO3" : "ROOC";
    const validJobs = gameType === "RO3" ? RO3_JOBS : ROOC_JOBS;
    const currentJob = currentApplicant.job?.trim();
    const currentCharacterName = currentApplicant.characterName?.trim();
    if (!currentApplicant.userId || !currentCharacterName || !currentJob || !validJobs.includes(currentJob as never)) {
      throw new Error("Applicant identity or job is invalid for the guild's current game.");
    }
    if (gameType === "RO3") {
      const stats = currentApplicant.ro3Stats;
      if (!stats || typeof stats !== "object" || Array.isArray(stats) || Object.keys(stats).length === 0) {
        throw new Error("RO3 character stats are missing from this application.");
      }
      for (const [key, value] of Object.entries(stats as Record<string, unknown>)) {
        if (!RO3_STAT_KEYS.includes(key as (typeof RO3_STAT_KEYS)[number]) || (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0))) {
          throw new Error("RO3 character stats are invalid. Ask the applicant to resubmit.");
        }
        if (["bladeCrystal", "shieldCrystal", "manaCrystal", "magicDefCrystal"].includes(key) && typeof value === "number" && value > 50) {
          throw new Error("RO3 crystal values must be between 0 and 50.");
        }
      }
    }

    const existingMember = await tx.guildMember.findFirst({
      where: { guildId: auth.guild.id, discordUserId: currentApplicant.discordUserId },
      select: { id: true },
    });
    if (existingMember) throw new Error("This Discord account is already a guild member.");

    const userId = currentApplicant.userId;
    const member = await tx.guildMember.create({ data: {
      guildId: auth.guild.id, userId, discordUserId: currentApplicant.discordUserId,
      discordUsername: currentApplicant.discordUsername?.trim() || null,
      characterName: currentCharacterName, job: currentJob, active: true, eligible: true,
      ro3Stats: gameType === "RO3" ? currentApplicant.ro3Stats ?? {} : null,
      pdef: gameType === "ROOC" ? currentApplicant.pdef : null,
      mdef: gameType === "ROOC" ? currentApplicant.mdef : null,
      pvpDamageBonus: gameType === "ROOC" ? currentApplicant.pvpDamageBonus : null,
      pvpDamageReduction: gameType === "ROOC" ? currentApplicant.pvpDamageReduction : null,
      pdmgPercent: gameType === "ROOC" ? currentApplicant.pdmgPercent : null,
      mdmgPercent: gameType === "ROOC" ? currentApplicant.mdmgPercent : null,
      pdmgReductionPercent: gameType === "ROOC" ? currentApplicant.pdmgReductionPercent : null,
      mdmgReductionPercent: gameType === "ROOC" ? currentApplicant.mdmgReductionPercent : null,
      critRes: gameType === "ROOC" ? currentApplicant.critRes : null,
      ignorePdef: gameType === "ROOC" ? currentApplicant.ignorePdef : null,
      ignoreMdef: gameType === "ROOC" ? currentApplicant.ignoreMdef : null,
      damageVsMedium: gameType === "ROOC" ? currentApplicant.damageVsMedium : null,
      damageReductionVsMedium: gameType === "ROOC" ? currentApplicant.damageReductionVsMedium : null,
      damageVsSmall: gameType === "ROOC" ? currentApplicant.damageVsSmall : null,
      damageReductionVsSmall: gameType === "ROOC" ? currentApplicant.damageReductionVsSmall : null,
      damageVsDemiHuman: gameType === "ROOC" ? currentApplicant.damageVsDemiHuman : null,
      damageReductionVsDemiHuman: gameType === "ROOC" ? currentApplicant.damageReductionVsDemiHuman : null,
      damageVsBrute: gameType === "ROOC" ? currentApplicant.damageVsBrute : null,
      damageReductionVsBrute: gameType === "ROOC" ? currentApplicant.damageReductionVsBrute : null,
      equipmentPdefPercent: gameType === "ROOC" ? currentApplicant.equipmentPdefPercent : null,
      equipmentMdefPercent: gameType === "ROOC" ? currentApplicant.equipmentMdefPercent : null,
      patk: gameType === "ROOC" ? currentApplicant.patk : null,
      matk: gameType === "ROOC" ? currentApplicant.matk : null,
      hp: gameType === "ROOC" ? currentApplicant.hp : null,
    } });
    await tx.guildMembership.upsert({
      where: { userId_guildId: { userId, guildId: auth.guild.id } },
      update: { role: "MEMBER" },
      create: { userId, guildId: auth.guild.id, role: "MEMBER" },
    });
    const decision = await tx.guildApplicant.updateMany({
      where: { id: currentApplicant.id, guildId: auth.guild.id, status: "PENDING" },
      data: { status: "ACCEPTED", remarks: body.remarks?.trim() || null, decidedAt: new Date(), decidedByUserId: auth.user.id },
    });
    if (decision.count !== 1) throw new Error("This application has already been decided.");
    return member;
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    console.error("[APPLICANTS] Acceptance failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to accept applicant." }, { status: 409 });
  }
  return NextResponse.json({ success: true, member: created });
}
