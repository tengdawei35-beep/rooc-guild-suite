import { NextResponse } from "next/server";

import { getCurrentAuth, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jobsForGame } from "@/lib/constants/jobs";
import { RO3_STAT_KEYS } from "@/lib/ocr/ro3-stats";
import { refreshGuildRankings } from "@/lib/scoring/refresh-guild-rankings";

type MemberRequest = {
  id?: string;
  discordUserId?: string | null;
  discordUsername?: string | null;
  characterName?: string;
  job?: string;
  ro3Stats?: Record<string, unknown>;
  pdef?: number | null;
  mdef?: number | null;
  pvpDamageBonus?: number | null;
  pvpDamageReduction?: number | null;
  pdmgPercent?: number | null;
  mdmgPercent?: number | null;
  pdmgReductionPercent?: number | null;
  mdmgReductionPercent?: number | null;
  critRes?: number | null;
  ignorePdef?: number | null;
  ignoreMdef?: number | null;
  damageVsMedium?: number | null;
  damageReductionVsMedium?: number | null;
  damageVsSmall?: number | null;
  damageReductionVsSmall?: number | null;
  damageVsDemiHuman?: number | null;
  damageReductionVsDemiHuman?: number | null;
  damageVsBrute?: number | null;
  damageReductionVsBrute?: number | null;
  equipmentPdefPercent?: number | null;
  equipmentMdefPercent?: number | null;
  patk?: number | null;
  matk?: number | null;
  hp?: number | null;
  active?: boolean;
  eligible?: boolean;
  priority?: "LEADER" | "OFFICER" | "COUNCIL" | "MEMBER";
  remarks?: string | null;
};

async function getAuth() {
  return getCurrentAuth();
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validateMember(body: MemberRequest, gameType: "ROOC" | "RO3") {
  const discordUserId = body.discordUserId?.trim() || null;
  const discordUsername = body.discordUsername?.trim() || null;

  if (!discordUserId) return { error: "Discord User ID is required." };
  if (!/^\d{17,20}$/.test(discordUserId)) {
    return { error: "Discord User ID must be a valid numeric Discord ID." };
  }

  if (!discordUsername) return { error: "Discord Username is required." };

  const characterName = body.characterName?.trim();
  if (!characterName) return { error: "Character name is required." };

  if (!body.job || !(jobsForGame(gameType) as readonly string[]).includes(body.job)) {
    return { error: "A valid job is required." };
  }

  const priority = body.priority ?? "MEMBER";
  if (!["LEADER", "OFFICER", "COUNCIL", "MEMBER"].includes(priority)) {
    return { error: "Invalid member priority." };
  }

  const numericFields: Array<[keyof MemberRequest, string]> = [
    ["pdef", "PDEF"],
    ["mdef", "MDEF"],
    ["patk", "PATK"],
    ["matk", "MATK"],
    ["hp", "HP"],
    ["pvpDamageBonus", "PvP Damage Bonus"],
    ["pvpDamageReduction", "PvP Damage Reduction"],
    ["pdmgPercent", "Physical Damage %"],
    ["mdmgPercent", "Magic Damage %"],
    ["pdmgReductionPercent", "Physical Damage Reduction %"],
    ["mdmgReductionPercent", "Magic Damage Reduction %"],
    ["critRes", "Crit Resistance"],
    ["ignorePdef", "Ignore PDEF"],
    ["ignoreMdef", "Ignore MDEF"],
    ["damageVsMedium", "Damage vs Medium"],
    ["damageReductionVsMedium", "Damage Reduction vs Medium"],
    ["damageVsSmall", "Damage vs Small"],
    ["damageReductionVsSmall", "Damage Reduction vs Small"],
    ["damageVsDemiHuman", "Damage vs Demi-Human"],
    ["damageReductionVsDemiHuman", "Damage Reduction vs Demi-Human"],
    ["damageVsBrute", "Damage vs Brute"],
    ["damageReductionVsBrute", "Damage Reduction vs Brute"],
    ["equipmentPdefPercent", "Equipment PDEF %"],
    ["equipmentMdefPercent", "Equipment MDEF %"],
  ];

  for (const [field, label] of numericFields) {
    if (body[field] !== null && body[field] !== undefined && body[field] !== "" && numberOrNull(body[field]) === null) {
      return { error: `${label} must be a valid number.` };
    }
  }

  if (gameType === "RO3" && numericFields.some(([field]) => body[field] !== null && body[field] !== undefined && body[field] !== "")) {
    return { error: "Use the RO3 stats object for RO3 character statistics." };
  }

  let ro3Stats: Record<string, number | null> | null = null;
  if (gameType === "RO3") {
    if (!body.ro3Stats || typeof body.ro3Stats !== "object" || Array.isArray(body.ro3Stats)) return { error: "RO3 stats are required." };
    ro3Stats = {};
    for (const [key, value] of Object.entries(body.ro3Stats)) {
      if (!(RO3_STAT_KEYS as readonly string[]).includes(key)) return { error: `Unknown RO3 stat: ${key}.` };
      if (value === null || value === "") { ro3Stats[key] = null; continue; }
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0) return { error: `Invalid value for RO3 stat ${key}.` };
      if (["bladeCrystal", "shieldCrystal", "manaCrystal", "magicDefCrystal"].includes(key) && number > 50) return { error: `${key} must be between 0 and 50.` };
      ro3Stats[key] = number;
    }
  } else if (body.ro3Stats !== undefined) return { error: "RO3 stats cannot be saved for a ROOC guild." };

  return {
    ro3Stats,
    discordUserId,
    discordUsername,
    characterName,
    job: body.job,
    pdef: numberOrNull(body.pdef),
    mdef: numberOrNull(body.mdef),
    pvpDamageBonus: numberOrNull(body.pvpDamageBonus),
    pvpDamageReduction: numberOrNull(body.pvpDamageReduction),
    pdmgPercent: numberOrNull(body.pdmgPercent),
    mdmgPercent: numberOrNull(body.mdmgPercent),
    pdmgReductionPercent: numberOrNull(body.pdmgReductionPercent),
    mdmgReductionPercent: numberOrNull(body.mdmgReductionPercent),
    critRes: numberOrNull(body.critRes),
    ignorePdef: numberOrNull(body.ignorePdef),
    ignoreMdef: numberOrNull(body.ignoreMdef),
    damageVsMedium: numberOrNull(body.damageVsMedium),
    damageReductionVsMedium: numberOrNull(body.damageReductionVsMedium),
    damageVsSmall: numberOrNull(body.damageVsSmall),
    damageReductionVsSmall: numberOrNull(body.damageReductionVsSmall),
    damageVsDemiHuman: numberOrNull(body.damageVsDemiHuman),
    damageReductionVsDemiHuman: numberOrNull(body.damageReductionVsDemiHuman),
    damageVsBrute: numberOrNull(body.damageVsBrute),
    damageReductionVsBrute: numberOrNull(body.damageReductionVsBrute),
    equipmentPdefPercent: numberOrNull(body.equipmentPdefPercent),
    equipmentMdefPercent: numberOrNull(body.equipmentMdefPercent),
    patk: numberOrNull(body.patk),
    matk: numberOrNull(body.matk),
    hp: numberOrNull(body.hp),
    active: body.active ?? true,
    eligible: body.eligible ?? true,
    priority,
    remarks: body.remarks?.trim() || null,
  };
}

async function resolveDiscordIdentity(
  guildId: string,
  discordUserId: string,
  discordUsername: string,
  existingMemberId?: string
) {
  const user = await prisma.user.findUnique({
    where: { discordId: discordUserId },
    select: { id: true, discordId: true, username: true },
  });

  if (user && discordUsername && user.username !== discordUsername) {
    throw new Error("The Discord User ID and Discord Username do not belong to the same Discord account.");
  }

  const linkedMember = await prisma.guildMember.findFirst({
    where: {
      guildId,
      discordUserId,
      ...(existingMemberId ? { NOT: { id: existingMemberId } } : {}),
    },
    select: { id: true },
  });

  if (linkedMember) {
    throw new Error("That Discord account is already linked to another guild member.");
  }

  return { discordUserId, discordUsername, userId: user?.id ?? null };
}

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!hasPermission(auth.role, "members.view")) {
      return NextResponse.json({ error: "You do not have permission to view members." }, { status: 403 });
    }

    const guild = await prisma.guild.findUnique({ where: { id: auth.guild.id }, select: { gameType: true } });
    if (guild?.gameType !== "RO3") await refreshGuildRankings(auth.guild.id);
    const members = await prisma.guildMember.findMany({
      where: { guildId: auth.guild.id },
      include: { leaveDates: { orderBy: { date: "asc" } } },
      orderBy: { characterName: "asc" },
    });

    const canViewOtherStats = auth.role !== "MEMBER";
    const safeMembers = members.map((member) => {
      const canViewCharacterStats =
        canViewOtherStats ||
        member.userId === auth.user.id ||
        member.discordUserId === auth.user.discordId;

      if (canViewCharacterStats) return member;

      return {
        ...member,
        ro3Stats: null,
        pdef: null,
        mdef: null,
        pvpDamageBonus: null,
        pvpDamageReduction: null,
        pdmgPercent: null,
        mdmgPercent: null,
        pdmgReductionPercent: null,
        mdmgReductionPercent: null,
        critRes: null,
        ignorePdef: null,
        ignoreMdef: null,
        damageVsMedium: null,
        damageReductionVsMedium: null,
        damageVsSmall: null,
        damageReductionVsSmall: null,
        damageVsDemiHuman: null,
        damageReductionVsDemiHuman: null,
        damageVsBrute: null,
        damageReductionVsBrute: null,
        equipmentPdefPercent: null,
        equipmentMdefPercent: null,
        patk: null,
        matk: null,
        hp: null,
      };
    });

    return NextResponse.json({ gameType: guild?.gameType === "RO3" ? "RO3" : "ROOC", members: safeMembers });
  } catch (error) {
    console.error("[MEMBERS] Failed to fetch members:", error);
    return NextResponse.json({ error: "Failed to fetch members." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!hasPermission(auth.role, "members.edit")) {
      return NextResponse.json({ error: "You do not have permission to add members." }, { status: 403 });
    }

    const guild = await prisma.guild.findUnique({ where: { id: auth.guild.id }, select: { gameType: true } });
    const gameType = guild?.gameType === "RO3" ? "RO3" : "ROOC";
    const body = (await request.json()) as MemberRequest;
    const data = validateMember(body, gameType);
    if ("error" in data) return NextResponse.json(data, { status: 400 });

    let discordIdentity;
    try {
      discordIdentity = await resolveDiscordIdentity(auth.guild.id, data.discordUserId, data.discordUsername);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid Discord identity." }, { status: 409 });
    }

    const existing = await prisma.guildMember.findFirst({
      where: { guildId: auth.guild.id, characterName: data.characterName },
    });
    if (existing) {
      return NextResponse.json({ error: "A member with this character name already exists." }, { status: 409 });
    }

    const member = await prisma.guildMember.create({
      data: {
        guildId: auth.guild.id,
        discordUserId: discordIdentity.discordUserId,
        discordUsername: discordIdentity.discordUsername,
        userId: discordIdentity.userId,
        characterName: data.characterName,
        job: data.job,
        ro3Stats: data.ro3Stats,
        pdef: data.pdef,
        mdef: data.mdef,
        pvpDamageBonus: data.pvpDamageBonus,
        pvpDamageReduction: data.pvpDamageReduction,
        pdmgPercent: data.pdmgPercent,
        mdmgPercent: data.mdmgPercent,
        pdmgReductionPercent: data.pdmgReductionPercent,
        mdmgReductionPercent: data.mdmgReductionPercent,
        critRes: data.critRes,
        ignorePdef: data.ignorePdef,
        ignoreMdef: data.ignoreMdef,
        damageVsMedium: data.damageVsMedium,
        damageReductionVsMedium: data.damageReductionVsMedium,
        damageVsSmall: data.damageVsSmall,
        damageReductionVsSmall: data.damageReductionVsSmall,
        damageVsDemiHuman: data.damageVsDemiHuman,
        damageReductionVsDemiHuman: data.damageReductionVsDemiHuman,
        damageVsBrute: data.damageVsBrute,
        damageReductionVsBrute: data.damageReductionVsBrute,
        equipmentPdefPercent: data.equipmentPdefPercent,
        equipmentMdefPercent: data.equipmentMdefPercent,
        patk: data.patk,
        matk: data.matk,
        hp: data.hp,
        active: data.active,
        eligible: data.eligible,
        priority: data.priority,
        remarks: data.remarks,
      },
      include: { leaveDates: true },
    });

    if (gameType !== "RO3") await refreshGuildRankings(auth.guild.id);
    return NextResponse.json({ member });
  } catch (error) {
    console.error("[MEMBERS] Failed to create member:", error);
    return NextResponse.json({ error: "Failed to create member." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const body = (await request.json()) as MemberRequest;
    if (!body.id) return NextResponse.json({ error: "Member ID is required." }, { status: 400 });

    const existing = await prisma.guildMember.findFirst({
      where: { id: body.id, guildId: auth.guild.id },
    });
    if (!existing) return NextResponse.json({ error: "Member not found." }, { status: 404 });

    const canEditAny = hasPermission(auth.role, "members.edit");
    const isOwnMember = existing.userId !== null && existing.userId === auth.user.id;
    const canEditOwn = hasPermission(auth.role, "profile.editOwn") && isOwnMember;

    if (!canEditAny && !canEditOwn) {
      return NextResponse.json({ error: "You do not have permission to edit this member." }, { status: 403 });
    }

    const guild = await prisma.guild.findUnique({ where: { id: auth.guild.id }, select: { gameType: true } });
    const gameType = guild?.gameType === "RO3" ? "RO3" : "ROOC";
    const data = validateMember(body, gameType);
    if ("error" in data) return NextResponse.json(data, { status: 400 });

    let discordIdentity = {
      discordUserId: existing.discordUserId,
      discordUsername: existing.discordUsername,
      userId: existing.userId,
    };

    if (canEditAny) {
      try {
        discordIdentity = await resolveDiscordIdentity(
          auth.guild.id,
          data.discordUserId,
          data.discordUsername,
          existing.id
        );
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid Discord identity." }, { status: 409 });
      }
    }

    const duplicate = await prisma.guildMember.findFirst({
      where: {
        guildId: auth.guild.id,
        characterName: data.characterName,
        NOT: { id: body.id },
      },
    });

    if (duplicate) {
      return NextResponse.json({ error: "A member with this character name already exists." }, { status: 409 });
    }

    const updateData: Record<string, unknown> = {
      characterName: data.characterName,
      job: data.job,
      ro3Stats: data.ro3Stats,
      pdef: data.pdef,
      mdef: data.mdef,
      pvpDamageBonus: data.pvpDamageBonus,
      pvpDamageReduction: data.pvpDamageReduction,
      pdmgPercent: data.pdmgPercent,
      mdmgPercent: data.mdmgPercent,
      pdmgReductionPercent: data.pdmgReductionPercent,
      mdmgReductionPercent: data.mdmgReductionPercent,
      critRes: data.critRes,
      ignorePdef: data.ignorePdef,
      ignoreMdef: data.ignoreMdef,
      damageVsMedium: data.damageVsMedium,
      damageReductionVsMedium: data.damageReductionVsMedium,
      damageVsSmall: data.damageVsSmall,
      damageReductionVsSmall: data.damageReductionVsSmall,
      damageVsDemiHuman: data.damageVsDemiHuman,
      damageReductionVsDemiHuman: data.damageReductionVsDemiHuman,
      damageVsBrute: data.damageVsBrute,
      damageReductionVsBrute: data.damageReductionVsBrute,
      equipmentPdefPercent: data.equipmentPdefPercent,
      equipmentMdefPercent: data.equipmentMdefPercent,
      patk: data.patk,
      matk: data.matk,
      hp: data.hp,
    };

    if (canEditAny) {
      updateData.discordUserId = discordIdentity.discordUserId;
      updateData.discordUsername = discordIdentity.discordUsername;
      updateData.userId = discordIdentity.userId;
      updateData.active = data.active;
      updateData.eligible = data.eligible;
      updateData.priority = data.priority;
      updateData.remarks = data.remarks;
    }

    const member = await prisma.guildMember.update({
      where: { id: body.id },
      data: updateData,
      include: { leaveDates: true },
    });

    await refreshGuildRankings(auth.guild.id);
    return NextResponse.json({ member });
  } catch (error) {
    console.error("[MEMBERS] Failed to update member:", error);
    return NextResponse.json({ error: "Failed to update member." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!hasPermission(auth.role, "members.delete")) {
      return NextResponse.json({ error: "You do not have permission to delete members." }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Member ID is required." }, { status: 400 });

    const existing = await prisma.guildMember.findFirst({ where: { id, guildId: auth.guild.id } });
    if (!existing) return NextResponse.json({ error: "Member not found." }, { status: 404 });

    await prisma.guildMember.delete({ where: { id } });
    const guild = await prisma.guild.findUnique({ where: { id: auth.guild.id }, select: { gameType: true } });
    if (guild?.gameType !== "RO3") await refreshGuildRankings(auth.guild.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MEMBERS] Failed to delete member:", error);
    return NextResponse.json({ error: "Failed to delete member." }, { status: 500 });
  }
}
