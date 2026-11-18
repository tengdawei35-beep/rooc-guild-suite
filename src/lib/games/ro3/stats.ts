/** RO3 V1 character-stat definition shared by applicant and member data. */
export const RO3_NUMERIC_STATS = [
  { key: "hp", label: "HP", kind: "number" },
  { key: "patk", label: "PATK", kind: "number" },
  { key: "matk", label: "MATK", kind: "number" },
  { key: "pdef", label: "PDEF", kind: "number" },
  { key: "mdef", label: "MDEF", kind: "number" },
  { key: "healingDone", label: "Healing Done", kind: "percentage" },
  { key: "critDamage", label: "Crit Damage", kind: "percentage" },
  { key: "critDamageReduction", label: "Crit Damage Reduction", kind: "percentage" },
  { key: "physicalDamageBonus", label: "Physical Damage Bonus", kind: "percentage" },
  { key: "physicalDamageReduction", label: "Physical Damage Reduction", kind: "percentage" },
  { key: "magicDamageBonus", label: "Magic Damage Bonus", kind: "percentage" },
  { key: "magicDamageReduction", label: "Magic Damage Reduction", kind: "percentage" },
  { key: "damageIncrease", label: "Damage Increase", kind: "percentage" },
  { key: "damageReduction", label: "Damage Reduction", kind: "percentage" },
  { key: "physicalPenetration", label: "Physical Penetration", kind: "percentage" },
  { key: "magicPenetration", label: "Magic Penetration", kind: "percentage" },
  { key: "damageVsAllJob", label: "DMG vs All Job", kind: "percentage" },
  { key: "damageReductionVsAllJob", label: "DMG Reduction vs All Job", kind: "percentage" },
  { key: "damageVsMediumEnemy", label: "DMG vs Medium Enemy", kind: "percentage" },
  { key: "damageReductionVsMediumEnemy", label: "DMG Reduction vs Medium Enemy", kind: "percentage" },
] as const;

export const RO3_SPECIAL_DISH_SLOTS = [
  { key: "specialDish1", initialLabel: "Blade Crystal", min: 0, max: 50 },
  { key: "specialDish2", initialLabel: "Shield Crystal", min: 0, max: 50 },
  { key: "specialDish3", initialLabel: "Mana Crystal", min: 0, max: 50 },
  { key: "specialDish4", initialLabel: "Magic DEF Crystal", min: 0, max: 50 },
] as const;

/** Season-adjustable labels; slot keys remain stable across seasons. */
export type RO3SpecialDishLabels = Record<(typeof RO3_SPECIAL_DISH_SLOTS)[number]["key"], string>;

export const RO3_DEFAULT_SPECIAL_DISH_LABELS: RO3SpecialDishLabels = {
  specialDish1: "Blade Crystal",
  specialDish2: "Shield Crystal",
  specialDish3: "Mana Crystal",
  specialDish4: "Magic DEF Crystal",
};

export type RO3CharacterStats = {
  [K in (typeof RO3_NUMERIC_STATS)[number]["key"]]: number;
} & {
  [K in (typeof RO3_SPECIAL_DISH_SLOTS)[number]["key"]]: number;
};
