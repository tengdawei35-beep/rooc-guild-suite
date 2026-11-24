import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasCombatSimulatorAccess } from "@/lib/ro3-combat-simulator/entitlements";

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (auth.guild.gameType !== "RO3") return NextResponse.json({ error: "RO3_GUILD_REQUIRED" }, { status: 409 });
  if (!(await hasCombatSimulatorAccess(auth.user.id, auth.guild.id))) {
    return NextResponse.json({ error: "COMBAT_SIMULATOR_NOT_SUBSCRIBED" }, { status: 403 });
  }

  const members = await prisma.guildMember.findMany({
    where: { guildId: auth.guild.id, active: true },
    orderBy: [{ characterName: "asc" }, { discordUsername: "asc" }, { id: "asc" }],
    select: {
      id: true, characterName: true, discordUsername: true, job: true, ro3Stats: true,
      hp: true, patk: true, matk: true, pdef: true, mdef: true,
      pdmgPercent: true, mdmgPercent: true, pdmgReductionPercent: true, mdmgReductionPercent: true,
      pvpDamageBonus: true, pvpDamageReduction: true, critRes: true, ignorePdef: true, ignoreMdef: true,
      damageVsMedium: true, damageReductionVsMedium: true, damageVsSmall: true, damageReductionVsSmall: true,
      damageVsDemiHuman: true, damageReductionVsDemiHuman: true, damageVsBrute: true, damageReductionVsBrute: true,
    },
  });

  return NextResponse.json({
    members: members.map((member) => ({
      ...member,
      ro3Stats: member.ro3Stats && typeof member.ro3Stats === "object" && !Array.isArray(member.ro3Stats) ? member.ro3Stats : null,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
