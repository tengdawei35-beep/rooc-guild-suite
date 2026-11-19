export const RO3_STAT_FIELDS = [
  { key: "hp", label: "HP", group: "Core Stats", aliases: ["HP"] },
  { key: "patk", label: "PATK", group: "Core Stats", aliases: ["PATK"] },
  { key: "matk", label: "MATK", group: "Core Stats", aliases: ["MATK"] },
  { key: "pdef", label: "PDEF", group: "Core Stats", aliases: ["PDEF"] },
  { key: "mdef", label: "MDEF", group: "Core Stats", aliases: ["MDEF"] },
  { key: "healingDonePercent", label: "Healing Done %", group: "Combat Modifiers", aliases: ["HEALING DONE", "HEALING DONE %"], percent: true },
  { key: "critDamagePercent", label: "Crit Damage %", group: "Combat Modifiers", aliases: ["CRIT DAMAGE", "CRIT DAMAGE %"], percent: true },
  { key: "critDamageReductionPercent", label: "Crit Damage Reduction %", group: "Combat Modifiers", aliases: ["CRIT DAMAGE REDUCTION", "CRIT DAMAGE REDUCTION %"], percent: true },
  { key: "physicalDamageBonusPercent", label: "Physical Damage Bonus %", group: "Combat Modifiers", aliases: ["PHYSICAL DAMAGE BONUS", "PHYSICAL DAMAGE BONUS %"], percent: true },
  { key: "physicalDamageReductionPercent", label: "Physical Damage Reduction %", group: "Combat Modifiers", aliases: ["PHYSICAL DAMAGE REDUCTION", "PHYSICAL DAMAGE REDUCTION %"], percent: true },
  { key: "magicDamageBonusPercent", label: "Magic Damage Bonus %", group: "Combat Modifiers", aliases: ["MAGIC DAMAGE BONUS", "MAGIC DAMAGE BONUS %"], percent: true },
  { key: "magicDamageReductionPercent", label: "Magic Damage Reduction %", group: "Combat Modifiers", aliases: ["MAGIC DAMAGE REDUCTION", "MAGIC DAMAGE REDUCTION %"], percent: true },
  { key: "damageIncreasePercent", label: "Damage Increase %", group: "Combat Modifiers", aliases: ["DAMAGE INCREASE", "DAMAGE INCREASE %"], percent: true },
  { key: "damageReductionPercent", label: "Damage Reduction %", group: "Combat Modifiers", aliases: ["DAMAGE REDUCTION", "DAMAGE REDUCTION %"], percent: true },
  { key: "physicalPenetrationPercent", label: "Physical Penetration %", group: "Combat Modifiers", aliases: ["PHYSICAL PENETRATION", "PHYSICAL PENETRATION %", "PENETRATION P"], percent: true },
  { key: "magicPenetrationPercent", label: "Magic Penetration %", group: "Combat Modifiers", aliases: ["MAGIC PENETRATION", "MAGIC PENETRATION %", "PENETRATION M"], percent: true },
  { key: "damageVsAllJob", label: "DMG vs All Job", group: "Target Modifiers", aliases: ["DMG VS ALL JOB", "DAMAGE VS ALL JOB"] },
  { key: "damageReductionVsAllJob", label: "DMG Reduction vs All Job", group: "Target Modifiers", aliases: ["DMG REDUCTION VS ALL JOB", "DAMAGE REDUCTION VS ALL JOB"] },
  { key: "damageVsMedium", label: "DMG vs Medium", group: "Target Modifiers", aliases: ["DMG VS MEDIUM", "DAMAGE VS MEDIUM"] },
  { key: "damageReductionVsMedium", label: "DMG Reduction vs Medium", group: "Target Modifiers", aliases: ["DMG REDUCTION VS MEDIUM", "DAMAGE REDUCTION VS MEDIUM"] },
  { key: "bladeCrystal", label: "Blade Crystal", group: "Special Dish", aliases: ["BLADE CRYSTAL"], crystal: true },
  { key: "shieldCrystal", label: "Shield Crystal", group: "Special Dish", aliases: ["SHIELD CRYSTAL"], crystal: true },
  { key: "manaCrystal", label: "Mana Crystal", group: "Special Dish", aliases: ["MANA CRYSTAL"], crystal: true },
  { key: "magicDefCrystal", label: "Magic DEF Crystal", group: "Special Dish", aliases: ["MAGIC DEF CRYSTAL"], crystal: true },
] as const;

export type RO3StatKey = (typeof RO3_STAT_FIELDS)[number]["key"];
export const RO3_STAT_KEYS = RO3_STAT_FIELDS.map(({ key }) => key) as readonly RO3StatKey[];
export const RO3_STAT_LABELS = Object.fromEntries(RO3_STAT_FIELDS.map(({ key, label }) => [key, label])) as Record<RO3StatKey, string>;
export const RO3_STAT_INPUT_FIELDS = RO3_STAT_FIELDS.map(({ key, label }) => [key, label] as const);
