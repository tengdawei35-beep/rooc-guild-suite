import { NextResponse } from "next/server";

import { getApplicantSession } from "@/lib/auth/applicant";
import { prisma } from "@/lib/prisma";
import { hasActiveGuildSubscription } from "@/lib/auth";
import { scoreRooPlayers } from "@/lib/scoring/roo-scoring";
import { RO3_JOBS, ROOC_JOBS } from "@/lib/constants/jobs";
import { RO3_STAT_KEYS } from "@/lib/constants/ro3-stats";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { readBoundedRequestText, RequestBodyTooLargeError } from "@/lib/security/multipart";

const MAX_APPLICATION_BODY_BYTES = 64 * 1024;
const APPLICATION_RATE_LIMIT = 10;
const APPLICATION_RATE_WINDOW_MS = 15 * 60 * 1000;

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

function cleanRO3Number(value: unknown, key: string): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(String(value).replace(/,/g, "").replace(/%/g, "").trim());
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid value for RO3 stat ${key}.`);
  if (["bladeCrystal", "shieldCrystal", "manaCrystal", "magicDefCrystal"].includes(key) && parsed > 50) {
    throw new Error(`${key} must be between 0 and 50.`);
  }
  return parsed;
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const session = await getApplicantSession();
  if (!session) return NextResponse.json({ error: "Discord authentication required." }, { status: 401 });

  const { token } = await context.params;
  const invite = await prisma.applicantInvite.findFirst({ where: { token, active: true } });
  if (!invite) return NextResponse.json({ error: "This application link is invalid or has been revoked." }, { status: 404 });
  if (!(await hasActiveGuildSubscription(invite.guildId))) return NextResponse.json({ error: "This guild is not currently accepting applications." }, { status: 403 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "Discord identity could not be found." }, { status: 401 });

  const existingMember = await prisma.guildMember.findFirst({ where: { guildId: invite.guildId, discordUserId: user.discordId }, select: { id: true } });
  if (existingMember) return NextResponse.json({ error: "You are already a member of this guild." }, { status: 409 });

  if (!(await consumeRateLimit("applicant-submission", user.id, APPLICATION_RATE_LIMIT, APPLICATION_RATE_WINDOW_MS))) {
    return NextResponse.json({ error: "Too many application attempts. Please try again later." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    const rawBody = await readBoundedRequestText(request, MAX_APPLICATION_BODY_BYTES);
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid application payload." }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Application payload is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid application payload." }, { status: 400 });
  }

  const guild = await prisma.guild.findUnique({ where: { id: invite.guildId }, select: { gameType: true } });
  const isRO3 = guild?.gameType === "RO3";
  const characterName = String(body.characterName ?? "").trim();
  const job = String(body.job ?? "").trim();
  const normalizedCharacterName = characterName.toLocaleLowerCase();
  const watchlistPreset = await prisma.guildApplicantWatchlistEntry.findUnique({
    where: { guildId_normalizedCharacterName: { guildId: invite.guildId, normalizedCharacterName } },
    select: { watchlist: true },
  });
  if (!characterName) return NextResponse.json({ error: "Character Name is required." }, { status: 400 });
  if (!job) return NextResponse.json({ error: "Job is required." }, { status: 400 });
  const validJobs = isRO3 ? RO3_JOBS : ROOC_JOBS;
  if (!validJobs.includes(job as never)) return NextResponse.json({ error: "Invalid job for this guild game." }, { status: 400 });

  if (isRO3) {
    const unknownFields = Object.keys(body).filter((key) =>
      !["applicationId", "characterName", "job", ...RO3_STAT_KEYS].includes(key)
    );
    if (unknownFields.length) return NextResponse.json({ error: `Unknown application fields: ${unknownFields.join(", ")}.` }, { status: 400 });

    let ro3Stats: Record<string, number | null>;
    try {
      ro3Stats = Object.fromEntries(RO3_STAT_KEYS.map((key) => [key, cleanRO3Number(body[key], key)]));
      const missingStats = RO3_STAT_KEYS.filter((key) => ro3Stats[key] === null);
      if (missingStats.length && !isCasual) {
        return NextResponse.json({ error: `All RO3 stats are required. Missing: ${missingStats.join(", ")}.` }, { status: 400 });
      }
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid RO3 stats." }, { status: 400 });
    }

    const existing = await prisma.guildApplicant.findUnique({ where: { guildId_discordUserId: { guildId: invite.guildId, discordUserId: user.discordId } } });
    if (existing?.status === "ACCEPTED") return NextResponse.json({ error: "This application has already been accepted." }, { status: 409 });
    const payload = {
      inviteId: invite.id, discordUserId: user.discordId, discordUsername: user.username,
      userId: user.id, characterName, job, ro3Stats,
      ...(watchlistPreset ? { watchlist: watchlistPreset.watchlist } : {}),
      // Clear any legacy ROOC scalar values if this applicant previously applied
      // while the guild was configured for ROOC.
      pdef: null, mdef: null, pvpDamageBonus: null, pvpDamageReduction: null,
      pdmgPercent: null, mdmgPercent: null, pdmgReductionPercent: null,
      mdmgReductionPercent: null, critRes: null, ignorePdef: null, ignoreMdef: null,
      damageVsMedium: null, damageReductionVsMedium: null, damageVsSmall: null,
      damageReductionVsSmall: null, damageVsDemiHuman: null, damageReductionVsDemiHuman: null,
      damageVsBrute: null, damageReductionVsBrute: null, equipmentPdefPercent: null,
      equipmentMdefPercent: null, patk: null, matk: null, hp: null,
      dpsScore: null, tankScore: null, pvpScore: null,
      dpsPercentile: null, tankPercentile: null, pvpPercentile: null,
      status: "PENDING" as const, reviewedAt: null, reviewedByUserId: null,
      decidedAt: null, decidedByUserId: null,
    };
    try {
      const saved = await prisma.$transaction(async (tx) => {
        const [currentInvite, currentGuild, currentMember] = await Promise.all([
          tx.applicantInvite.findFirst({ where: { id: invite.id, guildId: invite.guildId, active: true } }),
          tx.guild.findUnique({ where: { id: invite.guildId }, select: { gameType: true } }),
          tx.guildMember.findFirst({ where: { guildId: invite.guildId, discordUserId: user.discordId }, select: { id: true } }),
        ]);
        if (!currentInvite) throw new Error("This application link has been revoked.");
        if (!currentGuild || currentGuild.gameType !== "RO3") throw new Error("The guild game configuration changed. Please reload the application.");
        if (currentMember) throw new Error("You are already a member of this guild.");
        const current = await tx.guildApplicant.findUnique({ where: { guildId_discordUserId: { guildId: invite.guildId, discordUserId: user.discordId } } });
        if (current?.status === "ACCEPTED") throw new Error("This application has already been accepted.");
        return current
          ? tx.guildApplicant.update({ where: { id: current.id }, data: payload })
          : tx.guildApplicant.create({ data: { guildId: invite.guildId, ...payload } });
      }, { isolationLevel: "Serializable" });
      return NextResponse.json({ application: saved });
    } catch (error) {
      console.error("[APPLY] RO3 submission failed:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to submit application." }, { status: 409 });
    }
  }

  const applicantStats = Object.fromEntries(STAT_FIELDS.map((field) => [field, isCasual && !String(body[field] ?? "").trim() ? null : cleanNumber(body[field])])) as Record<(typeof STAT_FIELDS)[number], number | null>;
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
  const payload = {
    inviteId: invite.id,
    discordUserId: user.discordId,
    discordUsername: user.username,
    userId: user.id,
    characterName,
    job,
    ...applicantStats,
    ...(watchlistPreset ? { watchlist: watchlistPreset.watchlist } : {}),
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

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const [currentInvite, currentGuild, currentMember] = await Promise.all([
        tx.applicantInvite.findFirst({ where: { id: invite.id, guildId: invite.guildId, active: true } }),
        tx.guild.findUnique({ where: { id: invite.guildId }, select: { gameType: true } }),
        tx.guildMember.findFirst({ where: { guildId: invite.guildId, discordUserId: user.discordId }, select: { id: true } }),
      ]);
      if (!currentInvite) throw new Error("This application link has been revoked.");
      if (!currentGuild || currentGuild.gameType !== "ROOC") throw new Error("The guild game configuration changed. Please reload the application.");
      if (currentMember) throw new Error("You are already a member of this guild.");
      const current = await tx.guildApplicant.findUnique({ where: { guildId_discordUserId: { guildId: invite.guildId, discordUserId: user.discordId } } });
      if (current?.status === "ACCEPTED") throw new Error("This application has already been accepted.");
      return current
        ? tx.guildApplicant.update({ where: { id: current.id }, data: payload })
        : tx.guildApplicant.create({ data: { guildId: invite.guildId, ...payload } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ application: saved });
  } catch (error) {
    console.error("[APPLY] ROOC submission failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to submit application." }, { status: 409 });
  }
}
