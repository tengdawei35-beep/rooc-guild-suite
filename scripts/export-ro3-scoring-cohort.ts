import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";

const STAT_KEYS = [
  "hp",
  "patk",
  "matk",
  "pdef",
  "mdef",
  "healingDonePercent",
  "critDamagePercent",
  "critDamageReductionPercent",
  "physicalDamageBonusPercent",
  "physicalDamageReductionPercent",
  "magicDamageBonusPercent",
  "magicDamageReductionPercent",
  "damageIncreasePercent",
  "damageReductionPercent",
  "physicalPenetrationPercent",
  "magicPenetrationPercent",
  "damageVsAllJob",
  "damageReductionVsAllJob",
  "damageVsMedium",
  "damageReductionVsMedium",
  "damageVsDemiHuman",
  "damageReductionVsDemiHuman",
  "bladeCrystal",
  "shieldCrystal",
  "manaCrystal",
  "magicDefCrystal",
] as const;

type StatKey = (typeof STAT_KEYS)[number];

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main() {
  const members = await prisma.guildMember.findMany({
    where: {
      active: true,
      guild: { gameType: "RO3" },
    },
    select: {
      job: true,
      ro3Stats: true,
    },
  });

  const rows = members.flatMap((member) => {
    if (!member.ro3Stats || typeof member.ro3Stats !== "object" || Array.isArray(member.ro3Stats)) {
      return [];
    }

    const snapshot = member.ro3Stats as Record<string, unknown>;
    const values = Object.fromEntries(
      STAT_KEYS.map((key) => [key, numericValue(snapshot[key])]),
    ) as Record<StatKey, number | null>;

    // Do not emit records with no numeric stat values.
    if (!STAT_KEYS.some((key) => values[key] !== null)) return [];

    return [{
      // Job is retained only to support broad archetype grouping. No member,
      // Discord, guild, or character identifiers are exported.
      job: member.job ?? "",
      ...values,
    }];
  });

  const header = ["job", ...STAT_KEYS];
  const csv = [
    header.join(","),
    ...rows.map((row) => header.map((key) => csvCell(row[key as keyof typeof row] as string | number | null)).join(",")),
  ].join("\n");

  const outputPath = process.env.RO3_SCORING_EXPORT_PATH ?? "ro3-scoring-cohort.csv";
  await writeFile(outputPath, `${csv}\n`, "utf8");

  console.log(`Exported ${rows.length} anonymized active RO3 stat snapshots to ${outputPath}`);
  console.log("No member IDs, Discord IDs, character names, or guild identifiers were selected or exported.");
}

main()
  .catch((error) => {
    console.error("RO3 scoring cohort export failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
