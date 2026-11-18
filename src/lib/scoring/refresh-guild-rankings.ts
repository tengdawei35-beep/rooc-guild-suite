import { prisma } from "@/lib/prisma";
import { scoreRooPlayers } from "@/lib/scoring/roo-scoring";

const DPS_JOBS = new Set([
  "Lord Knight",
  "Paladin",
  "High Wizard",
  "Sniper",
  "Assassin Cross",
  "Stalker",
  "Champion",
  "Mastersmith",
  "Biochemist (Physical)",
  "Doram (Physical)",
  "Gunslinger",
  "Super Novice",
  "Doram (Magic)",
  "Shiranui",
]);

type LiveMember = {
  id: string;
  job: string | null;
  pdef: number | null;
  mdef: number | null;
  pvpDamageBonus: number | null;
  pvpDamageReduction: number | null;
  pdmgPercent: number | null;
  mdmgPercent: number | null;
  pdmgReductionPercent: number | null;
  mdmgReductionPercent: number | null;
  critRes: number | null;
  ignorePdef: number | null;
  ignoreMdef: number | null;
  damageVsMedium: number | null;
  damageReductionVsMedium: number | null;
  damageVsSmall: number | null;
  damageReductionVsSmall: number | null;
  damageVsDemiHuman: number | null;
  damageReductionVsDemiHuman: number | null;
  damageVsBrute: number | null;
  damageReductionVsBrute: number | null;
  equipmentPdefPercent: number | null;
  equipmentMdefPercent: number | null;
  patk: number | null;
  matk: number | null;
  hp: number | null;
};

function percentile(value: number, values: number[]) {
  const unique = [...new Set(values)].sort((a, b) => a - b);
  if (unique.length <= 1) return 100;

  let lower = 0;
  for (const candidate of unique) {
    if (candidate < value) lower += 1;
  }

  return (lower / (unique.length - 1)) * 100;
}

export async function refreshGuildRankings(guildId: string) {
  const members = await prisma.guildMember.findMany({
    where: {
      guildId,
      active: true,
      eligible: true,
    },
    select: {
      id: true,
      job: true,
      pdef: true,
      mdef: true,
      pvpDamageBonus: true,
      pvpDamageReduction: true,
      pdmgPercent: true,
      mdmgPercent: true,
      pdmgReductionPercent: true,
      mdmgReductionPercent: true,
      critRes: true,
      ignorePdef: true,
      ignoreMdef: true,
      damageVsMedium: true,
      damageReductionVsMedium: true,
      damageVsSmall: true,
      damageReductionVsSmall: true,
      damageVsDemiHuman: true,
      damageReductionVsDemiHuman: true,
      damageVsBrute: true,
      damageReductionVsBrute: true,
      equipmentPdefPercent: true,
      equipmentMdefPercent: true,
      patk: true,
      matk: true,
      hp: true,
    },
  }) as LiveMember[];

  if (members.length === 0) return;

  const scored = scoreRooPlayers(members);
  const tankValues = scored.map((member) => member.tankScore);
  const dpsRanked = scored.filter((member) => DPS_JOBS.has(member.job ?? ""));
  const dpsValues = dpsRanked.map((member) => member.dpsScore);
  const pvpValues = scored.map((member) => member.pvpScore);

  const rows = scored.map((member) => ({
    id: member.id,
    guildPercentile: percentile(member.pvpScore, pvpValues),
    tankScore: member.tankScore,
    tankPercentile: percentile(member.tankScore, tankValues),
    dpsScore: member.dpsScore,
    dpsPercentile: dpsRanked.length > 0 ? percentile(member.dpsScore, dpsValues) : 100,
    pvpScore: member.pvpScore,
    pvpPercentile: percentile(member.pvpScore, pvpValues),
  }));

  const guildOrder = [...rows].sort((a, b) => b.guildPercentile - a.guildPercentile);
  const tankOrder = [...rows].sort((a, b) => b.tankScore - a.tankScore);
  const dpsRowsById = new Map(rows.map((row) => [row.id, row]));
  const dpsOrder = dpsRanked
    .map((member) => dpsRowsById.get(member.id))
    .filter((row): row is (typeof rows)[number] => Boolean(row))
    .sort((a, b) => b.dpsScore - a.dpsScore);
  const pvpOrder = [...rows].sort((a, b) => b.pvpScore - a.pvpScore);

  const guildRank = new Map(guildOrder.map((row, index) => [row.id, index + 1]));
  const tankRank = new Map(tankOrder.map((row, index) => [row.id, index + 1]));
  const dpsRank = new Map(dpsOrder.map((row, index) => [row.id, index + 1]));
  const pvpRank = new Map(pvpOrder.map((row, index) => [row.id, index + 1]));

  // Ranking refreshes must not change GuildMember.updatedAt. That timestamp
  // is used by the dashboard as the member-profile activity timestamp.
  // Prisma update() would automatically touch updatedAt, making every live
  // ranking refresh appear as "Member profile updated".
  await prisma.$transaction(
    rows.map((row) =>
      prisma.$executeRawUnsafe(
        `UPDATE "GuildMember"
         SET "guildPercentile" = $1,
             "tankScore" = $2,
             "tankPercentile" = $3,
             "dpsScore" = $4,
             "dpsPercentile" = $5,
             "pvpScore" = $6,
             "pvpPercentile" = $7,
             "guildRank" = $8,
             "tankRank" = $9,
             "dpsRank" = $10,
             "pvpRank" = $11
         WHERE "id" = $12`,
        row.guildPercentile,
        row.tankScore,
        row.tankPercentile,
        row.dpsScore,
        row.dpsPercentile,
        row.pvpScore,
        row.pvpPercentile,
        guildRank.get(row.id) ?? null,
        tankRank.get(row.id) ?? null,
        dpsRank.get(row.id) ?? null,
        pvpRank.get(row.id) ?? null,
        row.id
      )
    )
  );
}
