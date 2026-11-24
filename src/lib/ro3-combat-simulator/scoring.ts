/**
 * Preliminary RO3 member scoring model.
 *
 * Scores are estimates for relative build comparison, not predictions of match
 * outcomes. Each component supplied here must already be normalized to 0–100
 * against a documented reference range or comparison cohort.
 */

export type Ro3ScoreCategory = "PHYSICAL_DPS" | "MAGIC_DPS" | "TANK" | "PVP";

export type Ro3ScoreComponents = Partial<Record<
  | "attackPower"
  | "penetration"
  | "damageAmplification"
  | "targetBonuses"
  | "criticalOutput"
  | "effectiveHealth"
  | "defence"
  | "damageReduction"
  | "pvpSurvivability"
  | "criticalResilience"
  | "pvpDamageOutput"
  | "generalDurability",
  number
>>;

export type Ro3ScoreResult = {
  score: number | null;
  version: "RO3_PRELIMINARY_V1";
  category: Ro3ScoreCategory;
  weights: Record<string, number>;
  contributions: Record<string, number>;
  missingComponents: string[];
  note: string;
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

const TANK: WeightedComponent[] = [
  { key: "effectiveHealth", weight: 25 },
  { key: "defence", weight: 20 },
  { key: "damageReduction", weight: 30 },
  { key: "pvpSurvivability", weight: 15 },
  { key: "criticalResilience", weight: 10 },
];

const PVP: WeightedComponent[] = [
  { key: "pvpDamageOutput", weight: 25 },
  { key: "penetration", weight: 15 },
  { key: "damageAmplification", weight: 15 },
  { key: "targetBonuses", weight: 10 },
  { key: "pvpSurvivability", weight: 20 },
  { key: "generalDurability", weight: 15 },
];

export function getRo3ScoreWeights(
  category: Ro3ScoreCategory,
  options: { supportsCriticalHits?: boolean } = {},
): WeightedComponent[] {
  if (category === "PHYSICAL_DPS" || category === "MAGIC_DPS") {
    return (options.supportsCriticalHits ? DPS_CRIT : DPS_NON_CRIT).map((item) => ({ ...item }));
  }
  return (category === "TANK" ? TANK : PVP).map((item) => ({ ...item }));
}

/**
 * Missing values are excluded and the remaining weights are proportionally
 * rebalanced. Values outside 0–100 are clamped. No HIT or ASPD component exists.
 */
export function calculateRo3Score(
  category: Ro3ScoreCategory,
  components: Ro3ScoreComponents,
  options: { supportsCriticalHits?: boolean } = {},
): Ro3ScoreResult {
  const configured = getRo3ScoreWeights(category, options);
  const valid = configured.filter(({ key }) => {
    const value = components[key];
    return typeof value === "number" && Number.isFinite(value);
  });
  const totalWeight = valid.reduce((sum, item) => sum + item.weight, 0);

  const weights = Object.fromEntries(configured.map(({ key, weight }) => [key, weight]));
  const missingComponents = configured
    .filter(({ key }) => !valid.some((item) => item.key === key))
    .map(({ key }) => String(key));

  if (totalWeight === 0) {
    return {
      score: null,
      version: "RO3_PRELIMINARY_V1",
      category,
      weights,
      contributions: {},
      missingComponents,
      note: "Insufficient stat coverage to calculate a score.",
    };
  }

  const contributions: Record<string, number> = {};
  let score = 0;
  for (const { key, weight } of valid) {
    const normalized = Math.max(0, Math.min(100, components[key] as number));
    const effectiveWeight = weight / totalWeight;
    contributions[String(key)] = normalized * effectiveWeight;
    score += contributions[String(key)];
  }

  return {
    score: Math.round(score * 100) / 100,
    version: "RO3_PRELIMINARY_V1",
    category,
    weights,
    contributions,
    missingComponents,
    note: "Preliminary relative-build score; not an official rating or match-outcome prediction.",
  };
}
