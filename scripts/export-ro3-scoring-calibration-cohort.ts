import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";
import {
  isRo3DpsJob,
  isRo3TankOrSupportJob,
} from "../src/lib/ro3-combat-simulator/scoring-v2-experimental";

const STAT_KEYS = [
  "hp", "patk", "matk", "pdef", "mdef",
  "healingDonePercent", "critDamagePercent", "critDamageReductionPercent",
  "physicalDamageBonusPercent", "physicalDamageReductionPercent",
  "magicDamageBonusPercent", "magicDamageReductionPercent",
  "damageIncreasePercent", "damageReductionPercent",
  "physicalPenetrationPercent", "magicPenetrationPercent",
  "damageVsAllJob", "damageReductionVsAllJob",
  "damageVsMedium", "damageReductionVsMedium",
  "damageVsDemiHuman", "damageReductionVsDemiHuman",
  "bladeCrystal", "shieldCrystal", "manaCrystal", "magicDefCrystal",
] as const;

type StatKey = (typeof STAT_KEYS)[number];
type Archetype = "PHYSICAL_DPS" | "MAGIC_DPS" | "TANK_SUPPORT";
type Row = { job: string; archetype: Archetype } & Record<StatKey, number | null>;

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

function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function summarize(rows: Row[]) {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    for (const group of [row.archetype, `${row.archetype}::${row.job}`]) {
      const groupRows = groups.get(group) ?? [];
      groupRows.push(row);
      groups.set(group, groupRows);
    }
  }

  return Object.fromEntries([...groups.entries()].map(([group, groupRows]) => {
    const stats = Object.fromEntries(STAT_KEYS.map((key) => {
      const values = groupRows
        .map((row) => row[key])
        .filter((value): value is number => value !== null)
        .sort((a, b) => a - b);
      return [key, {
        sampleCount: values.length,
        coverage: groupRows.length ? values.length / groupRows.length : 0,
        p10: percentile(values, 0.10),
        p50: percentile(values, 0.50),
        p90: percentile(values, 0.90),
      }];
    }));
    return [group, { characterCount: groupRows.length, stats }];
  }));
}

async function main() {
  const members = await prisma.guildMember.findMany({
    where: { active: true, guild: { gameType: "RO3" } },
    select: { job: true, ro3Stats: true },
  });

  const rows: Row[] = members.flatMap((member) => {
    const job = member.job;
    if (!job || (!isRo3DpsJob(job) && !isRo3TankOrSupportJob(job))) return [];
    if (!member.ro3Stats || typeof member.ro3Stats !== "object" || Array.isArray(member.ro3Stats)) return [];

    const snapshot = member.ro3Stats as Record<string, unknown>;
    const archetype: Archetype = isRo3TankOrSupportJob(job)
      ? "TANK_SUPPORT"
      : job === "Warlock" ? "MAGIC_DPS" : "PHYSICAL_DPS";
    const values = Object.fromEntries(
      STAT_KEYS.map((key) => [key, numericValue(snapshot[key])]),
    ) as Record<StatKey, number | null>;

    if (!STAT_KEYS.some((key) => values[key] !== null)) return [];
    return [{ job, archetype, ...values }];
  });

  const header = ["job", "archetype", ...STAT_KEYS];
  const csv = [
    header.join(","),
    ...rows.map((row) => header.map((key) =>
      csvCell(row[key as keyof Row] as string | number | null),
    ).join(",")),
  ].join("\n");

  const summary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    referenceLevel: 99,
    population: "All active RO3 members with an explicitly recognized RO3 job and a persisted ro3Stats snapshot",
    qualifyingCharacters: rows.length,
    archetypeCounts: {
      PHYSICAL_DPS: rows.filter((row) => row.archetype === "PHYSICAL_DPS").length,
      MAGIC_DPS: rows.filter((row) => row.archetype === "MAGIC_DPS").length,
      TANK_SUPPORT: rows.filter((row) => row.archetype === "TANK_SUPPORT").length,
    },
    distributions: summarize(rows),
    limitations: [
      "This export is descriptive input for calibration, not a score or ranking.",
      "No member, Discord, character, or guild identifiers are selected or exported.",
      "Unsuffixed legacy Royal Guard and Rune Knight jobs are excluded until explicitly classified.",
      "Percentiles describe the observed cohort and must not be used as live-moving score baselines.",
      "Stored values and source-screen units still require semantic verification before simulator mapping.",
    ],
  };

  const csvPath = process.env.RO3_CALIBRATION_EXPORT_PATH ?? "ro3-calibration-cohort.csv";
  const summaryPath = process.env.RO3_CALIBRATION_SUMMARY_PATH ?? "ro3-calibration-distribution.json";
  await writeFile(csvPath, `${csv}\n`, "utf8");
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(`Exported ${rows.length} anonymized active RO3 stat snapshots to ${csvPath}`);
  console.log(`P10/P50/P90 distribution summary written to ${summaryPath}`);
  console.log(JSON.stringify(summary.archetypeCounts, null, 2));
}

main()
  .catch((error) => {
    console.error("RO3 calibration cohort export failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
