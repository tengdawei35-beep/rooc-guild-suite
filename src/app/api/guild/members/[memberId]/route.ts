import { NextResponse } from "next/server";
import { getCurrentAuth, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jobsForGame } from "@/lib/constants/jobs";
import { RO3_STAT_KEYS } from "@/lib/ocr/ro3-stats";
import { calculateRawPdef } from "@/lib/scoring/roo-scoring";
import { refreshGuildRankings } from "@/lib/scoring/refresh-guild-rankings";

type RouteContext = { params: Promise<{ memberId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!hasPermission(auth.role, "members.view")) return NextResponse.json({ error: "You do not have permission to view members." }, { status: 403 });
    const { memberId } = await context.params;
    const member = await prisma.guildMember.findFirst({ where: { id: memberId, guildId: auth.guild.id }, include: { leaveDates: { orderBy: { date: "asc" }, select: { id: true, date: true, reason: true } }, rosterAssignments: { where: { party: { roster: { event: { guildId: auth.guild.id } } } }, orderBy: { createdAt: "desc" }, include: { party: { include: { roster: { include: { event: { select: { id: true, type: true, date: true } } } } } } } } } });
    if (!member) return NextResponse.json({ error: "Guild member not found." }, { status: 404 });

    const guild = await prisma.guild.findUnique({ where: { id: auth.guild.id }, select: { gameType: true } });
    const isOwnProfile = member.userId === auth.user.id || member.discordUserId === auth.user.discordId;
    const canViewCharacterStats = auth.role !== "MEMBER" || isOwnProfile;

    const history = canViewCharacterStats && guild?.gameType !== "RO3" ? member.rosterAssignments.map((assignment) => ({ rosterMemberId: assignment.id, event: { id: assignment.party.roster.event.id, type: assignment.party.roster.event.type, date: assignment.party.roster.event.date }, battlefield: assignment.party.battlefield, partyNumber: assignment.party.partyNumber, slotNumber: assignment.slotNumber, guildPercentile: assignment.guildPercentile, tankScore: assignment.tankScore, dpsScore: assignment.dpsScore, pvpScore: assignment.pvpScore, createdAt: assignment.createdAt })) : [];

    let current = null;
    if (canViewCharacterStats && guild?.gameType !== "RO3") {
      await refreshGuildRankings(auth.guild.id);
      const liveMember = await prisma.guildMember.findUnique({ where: { id: member.id }, select: { guildPercentile: true, tankScore: true, dpsScore: true, pvpScore: true } });
      const latestAssignment = member.rosterAssignments[0] ?? null;
      current = liveMember ? { guildPercentile: liveMember.guildPercentile ?? 0, tankScore: liveMember.tankScore ?? 0, dpsScore: liveMember.dpsScore ?? 0, pvpScore: liveMember.pvpScore ?? 0, event: latestAssignment ? { id: latestAssignment.party.roster.event.id, type: latestAssignment.party.roster.event.type, date: latestAssignment.party.roster.event.date, battlefield: latestAssignment.party.battlefield, partyNumber: latestAssignment.party.partyNumber, slotNumber: latestAssignment.slotNumber } : null } : null;
    }

    const stats = canViewCharacterStats ? (guild?.gameType === "RO3" ? { ro3Stats: member.ro3Stats } : { ro3Stats: null, pdef: member.pdef, mdef: member.mdef, rawPdef: calculateRawPdef(member.pdef, member.equipmentPdefPercent), patk: member.patk, matk: member.matk, hp: member.hp, critRes: member.critRes, ignorePdef: member.ignorePdef, ignoreMdef: member.ignoreMdef, pvpDamageBonus: member.pvpDamageBonus, pvpDamageReduction: member.pvpDamageReduction, pdmgPercent: member.pdmgPercent, mdmgPercent: member.mdmgPercent, pdmgReductionPercent: member.pdmgReductionPercent, mdmgReductionPercent: member.mdmgReductionPercent, damageVsSmall: member.damageVsSmall, damageReductionVsSmall: member.damageReductionVsSmall, damageVsMedium: member.damageVsMedium, damageReductionVsMedium: member.damageReductionVsMedium, damageVsDemiHuman: member.damageVsDemiHuman, damageReductionVsDemiHuman: member.damageReductionVsDemiHuman, damageVsBrute: member.damageVsBrute, damageReductionVsBrute: member.damageReductionVsBrute, equipmentPdefPercent: member.equipmentPdefPercent, equipmentMdefPercent: member.equipmentMdefPercent }) : {};

    return NextResponse.json({ gameType: guild?.gameType === "RO3" ? "RO3" : "ROOC", member: { id: member.id, userId: member.userId, discordUserId: member.discordUserId, discordUsername: member.discordUsername, characterName: member.characterName, job: member.job, active: member.active, eligible: member.eligible, priority: member.priority, remarks: member.remarks, leaveDates: member.leaveDates, ...stats }, current, history, canViewCharacterStats });
  } catch (error) {
    console.error("[MEMBER PROFILE] Failed to fetch:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch member profile." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!hasPermission(auth.role, "profile.editOwn")) return NextResponse.json({ error: "You do not have permission to edit this profile." }, { status: 403 });
    const { memberId } = await context.params;
    const member = await prisma.guildMember.findFirst({ where: { id: memberId, guildId: auth.guild.id, OR: [{ userId: auth.user.id }, { discordUserId: auth.user.discordId }] }, select: { id: true } });
    if (!member) return NextResponse.json({ error: "You can only update your own guild member profile." }, { status: 403 });
    const guild = await prisma.guild.findUnique({ where: { id: auth.guild.id }, select: { gameType: true } });
    const body = await request.json();
    const numericFields = ["pdef", "mdef", "patk", "matk", "hp", "pvpDamageBonus", "pvpDamageReduction", "pdmgPercent", "mdmgPercent", "pdmgReductionPercent", "mdmgReductionPercent", "critRes", "ignorePdef", "ignoreMdef", "damageVsMedium", "damageReductionVsMedium", "damageVsSmall", "damageReductionVsSmall", "damageVsDemiHuman", "damageReductionVsDemiHuman", "damageVsBrute", "damageReductionVsBrute", "equipmentPdefPercent", "equipmentMdefPercent"] as const;
    const data: Record<string, unknown> = {};

    if ("job" in body) {
      if (body.job === null || body.job === "") data.job = null;
      else if (typeof body.job === "string" && (jobsForGame(guild?.gameType === "RO3" ? "RO3" : "ROOC") as readonly string[]).includes(body.job)) data.job = body.job;
      else return NextResponse.json({ error: "Invalid job." }, { status: 400 });
    }

    if ("ro3Stats" in body) {
      if (guild?.gameType !== "RO3") return NextResponse.json({ error: "RO3 stats cannot be saved for a ROOC guild." }, { status: 400 });
      const stats = body.ro3Stats;
      if (!stats || typeof stats !== "object" || Array.isArray(stats)) return NextResponse.json({ error: "RO3 stats must be an object." }, { status: 400 });
      const clean: Record<string, number | null> = {};
      for (const [key, value] of Object.entries(stats as Record<string, unknown>)) {
        if (!(RO3_STAT_KEYS as readonly string[]).includes(key)) return NextResponse.json({ error: `Unknown RO3 stat: ${key}.` }, { status: 400 });
        if (value === null || value === "") { clean[key] = null; continue; }
        const number = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(number) || number < 0) return NextResponse.json({ error: `Invalid value for RO3 stat ${key}.` }, { status: 400 });
        if (["bladeCrystal", "shieldCrystal", "manaCrystal", "magicDefCrystal"].includes(key) && number > 50) return NextResponse.json({ error: `${key} must be between 0 and 50.` }, { status: 400 });
        clean[key] = number;
      }
      data.ro3Stats = clean;
    }
    if (guild?.gameType === "RO3" && numericFields.some((field) => field in body)) return NextResponse.json({ error: "Use the RO3 stats object for RO3 character statistics." }, { status: 400 });
    for (const field of numericFields) { if (!(field in body)) continue; if (body[field] === null || body[field] === "") data[field] = null; else if (typeof body[field] === "number" && Number.isFinite(body[field])) data[field] = body[field]; else return NextResponse.json({ error: `Invalid value for ${field}.` }, { status: 400 }); }
    const updated = await prisma.guildMember.update({ where: { id: member.id }, data, select: { id: true, characterName: true, job: true, updatedAt: true } });
    await refreshGuildRankings(auth.guild.id);
    return NextResponse.json({ success: true, member: updated });
  } catch (error) { console.error("[MEMBER PROFILE] Failed to update:", error); return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update member profile." }, { status: 500 }); }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!hasPermission(auth.role, "members.delete")) return NextResponse.json({ error: "You do not have permission to delete members." }, { status: 403 });
    const { memberId } = await context.params;
    if (!memberId) return NextResponse.json({ error: "Member ID is required." }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const member = await tx.guildMember.findFirst({
        where: { id: memberId, guildId: auth.guild.id },
        include: { leaveDates: true },
      });
      if (!member) throw new Error("Guild member not found.");

      for (const leave of member.leaveDates) {
        await tx.$executeRaw`
          INSERT INTO "LeaveHistory" ("id", "guildId", "originalMemberId", "discordUserId", "discordUsername", "characterName", "job", "date", "reason")
          VALUES (${crypto.randomUUID()}, ${auth.guild.id}, ${member.id}, ${member.discordUserId}, ${member.discordUsername}, ${member.characterName}, ${member.job}, ${leave.date}, ${leave.reason})
        `;
      }

      await tx.guildMember.delete({ where: { id: memberId } });
      return { id: memberId };
    });

    await refreshGuildRankings(auth.guild.id);
    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    console.error("[MEMBER PROFILE] Failed to delete:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete member." }, { status: 500 });
  }
}
