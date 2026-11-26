/**
 * EXPERIMENTAL RO3 member score composition engine. No final numeric DPS, Tank, or PvP weights have been approved; do not use this module for live rankings.
 *
 * RO3 member score composition engine.
 *
 * This module deliberately accepts normalized 0–100 component values. It does
 * not invent stat caps or infer unsupported combat mechanics from raw stats.
 * Raw-stat simulation/reference calibration is a separate, versioned layer.
 */

export const RO3_MEMBER_SCORE_STATUS = "EXPERIMENTAL" as const;

export type Ro3ScoreCategory = "PHYSICAL_DPS" | "MAGIC_DPS" | "TANK" | "PVP";

export type Ro3ScoreComponents = Partial<Record<
  | "attackPower"
  | "penetration"
  | "damageAmplification"
  | "targetBonuses"
  | "criticalOutput"
  | "hp"
  | "defence"
  | "damageReduction"
  | "pvpSurvivability"
  | "criticalResilience",
  number
>>;

export type Ro3ScoreResult = {
  score: number | null;
  version: "RO3_MEMBER_V2_EXPERIMENTAL";
  category: Ro3ScoreCategory;
  weights: Record<string, number>;
  contributions: Record<string, number>;
  missingComponents: string[];
  note: string;
};

export type Ro3MemberScoreResult = {
  version: "RO3_MEMBER_V2_EXPERIMENTAL";
  job: string | null;
  dps: Ro3ScoreResult | null;
  tank: Ro3ScoreResult;
  pvp: Ro3ScoreResult;
  pvpComposition: { dpsWeight: number; tankWeight: number };
};

type WeightedComponent = { key: keyof Ro3ScoreComponents; weight: number };

const DPS_NON_CRIT: WeightedComponent[] = [
  { key: "attackPower", weight: 30 },
  { key: "penetration", weight: 25 },
  { key: "damageAmplification", weight: 25 },
  { key: "targetBonuses", weight: 20 },
];

const DPS_CRIT: WeightedComponent[] = [
  { key: "attackPower", weight: 25 },
  { key: "penetration", weight: 20 },
  { key: "damageAmplification", weight: 25 },
  { key: "targetBonuses", weight: 20 },
  { key: "criticalOutput", weight: 10 },
];

/**
 * Tank HP is a permanent 5% component. The remaining four defensive
 * components mirror the 30:25:25:20 relative DPS weighting, scaled to 95%.
 */
const TANK: WeightedComponent[] = [
  { key: "hp", weight: 5 },
  { key: "defence", weight: 28.5 },
  { key: "damageReduction", weight: 23.75 },
  { key: "pvpSurvivability", weight: 23.75 },
  { key: "criticalResilience", weight: 19 },
];

const DPS_JOBS = [
  "Mechanic",
  "Royal Guard (DPS)",
  "Rune Knight (DPS)",
  "Warlock",
  "Ranger",
  "Guillotine Cross",
] as const;

const TANK_JOBS = ["Royal Guard (Tank)", "Rune Knight (Tank)", "Archbishop"] as const;

export function isRo3DpsJob(job: string | null | undefined): boolean {
  return typeof job === "string" && (DPS_JOBS as readonly string[]).includes(job);
}

export function isRo3TankOrSupportJob(job: string | null | undefined): boolean {
  return typeof job === "string" && (TANK_JOBS as readonly string[]).includes(job);
}

function resolveRo3Role(job: string | null | undefined, role?: "DPS" | "TANK"): "DPS" | "TANK" {
  if (job === "Archbishop" || (typeof job === "string" && job.endsWith(" (Tank)"))) return "TANK";
  if (typeof job === "string" && job.endsWith(" (DPS)")) return "DPS";
  // The optional override remains for legacy, unsuffixed hybrid job values.
  return role ?? "DPS";
}

export function getRo3ScoreWeights(
  category: Ro3ScoreCategory,
  options: { supportsCriticalHits?: boolean } = {},
): WeightedComponent[] {
  if (category === "PHYSICAL_DPS" || category === "MAGIC_DPS") {
    return (options.supportsCriticalHits ? DPS_CRIT : DPS_NON_CRIT).map((item) => ({ ...item }));
  }
  if (category === "TANK") return TANK.map((item) => ({ ...item }));
  // PvP is composed from the independently calculated DPS and Tank scores.
  return [];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalize(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * Missing DPS components are excluded and the remaining DPS weights are
 * proportionally rebalanced. Tank is handled separately because its HP
 * component has a fixed, non-rebalanced 5% allocation.
 */
export function calculateRo3Score(
  category: Exclude<Ro3ScoreCategory, "PVP">,
  components: Ro3ScoreComponents,
  options: { supportsCriticalHits?: boolean } = {},
): Ro3ScoreResult {
  const configured = getRo3ScoreWeights(category, options);
  const valid = configured.filter(({ key }) => {
    const value = components[key];
    return typeof value === "number" && Number.isFinite(value);
  });
  const missingComponents = configured
    .filter(({ key }) => !valid.some((item) => item.key === key))
    .map(({ key }) => String(key));
  const weights = Object.fromEntries(configured.map(({ key, weight }) => [key, weight]));

  if (category === "TANK") {
    const hp = components.hp;
    if (typeof hp !== "number" || !Number.isFinite(hp)) {
      return {
        score: null, version: "RO3_MEMBER_V2_EXPERIMENTAL", category, weights,
        contributions: {}, missingComponents,
        note: "HP is required because it has a permanent 5% Tank allocation.",
      };
    }

    const defensive = valid.filter(({ key }) => key !== "hp");
    const defensiveWeight = defensive.reduce((sum, item) => sum + item.weight, 0);
    const contributions: Record<string, number> = { hp: normalize(hp) * 0.05 };
    let score = contributions.hp;

    if (defensiveWeight > 0) {
      for (const { key, weight } of defensive) {
        const contribution = normalize(components[key] as number) * 0.95 * (weight / defensiveWeight);
        contributions[String(key)] = contribution;
        score += contribution;
      }
    } else {
      return {
        score: null, version: "RO3_MEMBER_V2_EXPERIMENTAL", category, weights,
        contributions: {}, missingComponents,
        note: "Insufficient defensive stat coverage to calculate a Tank score.",
      };
    }

    return {
      score: round(score), version: "RO3_MEMBER_V2_EXPERIMENTAL", category, weights,
      contributions, missingComponents,
      note: "Tank score: fixed 5% HP plus defensive components normalized across the remaining 95%.",
    };
  }

  const totalWeight = valid.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) {
    return {
      score: null, version: "RO3_MEMBER_V2_EXPERIMENTAL", category, weights,
      contributions: {}, missingComponents,
      note: "Insufficient stat coverage to calculate a score.",
    };
  }

  const contributions: Record<string, number> = {};
  let score = 0;
  for (const { key, weight } of valid) {
    const contribution = normalize(components[key] as number) * (weight / totalWeight);
    contributions[String(key)] = contribution;
    score += contribution;
  }

  return {
    score: round(score), version: "RO3_MEMBER_V2_EXPERIMENTAL", category, weights,
    contributions, missingComponents,
    note: "DPS component score; missing components are excluded and remaining weights are proportionally rebalanced.",
  };
}

/**
 * DPS PvP = 60% DPS + 40% Tank. Archbishop PvP = 100% Tank.
 * A DPS PvP score is withheld unless both underlying scores are available.
 */
export function calculateRo3PvPScore(
  job: string | null | undefined,
  dpsScore: number | null | undefined,
  tankScore: number | null | undefined,
  role?: "DPS" | "TANK",
): Ro3ScoreResult {
  const isDps = resolveRo3Role(job, role) === "DPS";
  const weights: Record<string, number> = isDps ? { dps: 60, tank: 40 } : { tank: 100 };
  const missingComponents: string[] = [];
  if (typeof tankScore !== "number" || !Number.isFinite(tankScore)) missingComponents.push("tank");
  if (isDps && (typeof dpsScore !== "number" || !Number.isFinite(dpsScore))) missingComponents.push("dps");

  if (missingComponents.length) {
    return {
      score: null, version: "RO3_MEMBER_V2_EXPERIMENTAL", category: "PVP", weights,
      contributions: {}, missingComponents,
      note: "PvP score unavailable until all required underlying scores are calculated.",
    };
  }

  const tankContribution = normalize(tankScore as number) * (isDps ? 0.4 : 1);
  const contributions: Record<string, number> = { tank: tankContribution };
  let score = tankContribution;
  if (isDps) {
    const dpsContribution = normalize(dpsScore as number) * 0.6;
    contributions.dps = dpsContribution;
    score += dpsContribution;
  }

  return {
    score: round(score), version: "RO3_MEMBER_V2_EXPERIMENTAL", category: "PVP",
    weights, contributions, missingComponents: [],
    note: isDps
      ? "DPS PvP score: 60% DPS and 40% Tank."
      : "Archbishop PvP score: 100% Tank.",
  };
}

/**
 * Compose the member's role-specific scores from already normalized
 * component scores. Raw stat-to-component calibration is intentionally not
 * performed here.
 */
export function calculateRo3MemberScores(input: {
  job: string | null | undefined;
  role?: "DPS" | "TANK";
  dpsCategory?: "PHYSICAL_DPS" | "MAGIC_DPS";
  dpsComponents?: Ro3ScoreComponents;
  tankComponents: Ro3ScoreComponents;
  supportsCriticalHits?: boolean;
}): Ro3MemberScoreResult {
  const dpsCategory = input.dpsCategory ?? (input.job === "Warlock" ? "MAGIC_DPS" : "PHYSICAL_DPS");
  const isDpsRole = resolveRo3Role(input.job, input.role) === "DPS";
  const dps = isDpsRole
    ? calculateRo3Score(dpsCategory, input.dpsComponents ?? {}, {
        supportsCriticalHits: input.supportsCriticalHits,
      })
    : null;
  const tank = calculateRo3Score("TANK", input.tankComponents);
  const pvp = calculateRo3PvPScore(input.job, dps?.score, tank.score, input.role);

  return {
    version: "RO3_MEMBER_V2_EXPERIMENTAL",
    job: input.job ?? null,
    dps,
    tank,
    pvp,
    pvpComposition: isDpsRole
      ? { dpsWeight: 60, tankWeight: 40 }
      : { dpsWeight: 0, tankWeight: 100 },
  };
}
