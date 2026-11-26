import type { RO3StatKey } from "@/lib/constants/ro3-stats";

/**
 * Converts persisted member profile values into the simulator's attribute
 * units for fields whose capture units are known.
 *
 * RO3 OCR stores displayed percentages as ordinary percentage numbers
 * (e.g. "12.5%" -> 12.5). The simulator's attribute sheet represents these
 * bonuses in basis points (12.5% -> 1250, then /10000 in its formula).
 *
 * This adapter intentionally excludes fields whose display semantics or
 * aggregation have not been verified. It does not create a score or baseline.
 */
export type PersistedRo3Stats = Partial<Record<RO3StatKey, number | string | null | undefined>>;

export type SimulatorAttributeSnapshot = {
  attributes: Record<number, number>;
  excluded: Array<{ key: RO3StatKey; reason: string }>;
};

const DIRECT_ATTRIBUTE_IDS: Partial<Record<RO3StatKey, number>> = {
  hp: 101,
  patk: 103,
  matk: 104,
  pdef: 105,
  mdef: 106,
};

const PERCENT_TO_BASIS_POINTS: Partial<Record<RO3StatKey, number>> = {};

const EXCLUDED_KEYS: Partial<Record<RO3StatKey, string>> = {
  critDamagePercent: "Persisted source/aggregation semantics are not verified; excluded from simulator-backed member evaluation.",
  physicalDamageBonusPercent: "Persisted source/aggregation semantics are not verified; excluded from simulator-backed member evaluation.",
  magicDamageBonusPercent: "Persisted source/aggregation semantics are not verified; excluded from simulator-backed member evaluation.",
  damageIncreasePercent: "Persisted source/aggregation semantics are not verified; excluded from simulator-backed member evaluation.",
  physicalPenetrationPercent: "The current evaluator does not apply physical penetration.",
  magicPenetrationPercent: "The current evaluator does not apply magic penetration.",
  physicalDamageReductionPercent: "No validated incoming physical damage evaluator.",
  magicDamageReductionPercent: "No validated incoming magic damage evaluator.",
  damageReductionPercent: "No validated incoming damage evaluator.",
  critDamageReductionPercent: "No validated incoming critical damage evaluator.",
  damageVsAllJob: "Target-job bonus semantics are not mapped to the evaluator.",
  damageReductionVsAllJob: "No validated incoming damage evaluator.",
  damageVsMedium: "Displayed units and target-bonus aggregation are not verified.",
  damageReductionVsMedium: "No validated incoming damage evaluator.",
  damageVsDemiHuman: "Displayed units and target-bonus aggregation are not verified.",
  damageReductionVsDemiHuman: "No validated incoming damage evaluator.",
  healingDonePercent: "Healing is outside the current damage evaluator.",
  bladeCrystal: "Special Dish crystal effect is not mapped.",
  shieldCrystal: "Special Dish crystal effect is not mapped.",
  manaCrystal: "Special Dish crystal effect is not mapped.",
  magicDefCrystal: "Special Dish crystal effect is not mapped.",
};

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function persistedRo3StatsToSimulatorAttributes(
  stats: PersistedRo3Stats,
): SimulatorAttributeSnapshot {
  const attributes: Record<number, number> = {};
  const excluded: SimulatorAttributeSnapshot["excluded"] = [];

  for (const [rawKey, rawValue] of Object.entries(stats)) {
    const key = rawKey as RO3StatKey;
    const value = finiteNumber(rawValue);
    if (value === null) continue;

    const directId = DIRECT_ATTRIBUTE_IDS[key];
    if (directId !== undefined) {
      attributes[directId] = value;
      continue;
    }

    const percentageId = PERCENT_TO_BASIS_POINTS[key];
    if (percentageId !== undefined) {
      attributes[percentageId] = value * 100;
      continue;
    }

    excluded.push({
      key,
      reason: EXCLUDED_KEYS[key] ?? "No verified persisted-field to simulator-attribute conversion.",
    });
  }

  return { attributes, excluded };
}
