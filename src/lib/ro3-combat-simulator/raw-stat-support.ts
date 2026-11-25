import type { RO3StatKey } from "@/lib/constants/ro3-stats";

export type Ro3RawStatSupportStatus =
  | "simulator-supported"
  | "simulator-supported-units-verified-semantics-unverified"
  | "simulator-supported-unit-unverified"
  | "tank-context-only"
  | "not-modeled";

export type Ro3RawStatSupport = {
  status: Ro3RawStatSupportStatus;
  simulatorAttributeId?: number;
  use: "outgoing-damage" | "defensive-context" | "none";
  note: string;
};

/**
 * Evidence map between persisted RO3 fields and the current HTML simulator.
 *
 * This is deliberately a capability registry, not a stat-to-score formula.
 * The current simulator is the authoritative calculation model. Supported
 * mappings are eligible for simulator-derived outputs; this does not imply
 * population normalization or final component weights.
 */
export const RO3_RAW_STAT_SUPPORT: Partial<Record<RO3StatKey, Ro3RawStatSupport>> = {
  hp: {
    status: "tank-context-only",
    simulatorAttributeId: 101,
    use: "defensive-context",
    note: "HP is a Tank input candidate; it does not directly multiply outgoing damage.",
  },
  patk: {
    status: "simulator-supported",
    simulatorAttributeId: 103,
    use: "outgoing-damage",
    note: "Physical attack input; skill ratios and flat skill values still determine damage.",
  },
  matk: {
    status: "simulator-supported",
    simulatorAttributeId: 104,
    use: "outgoing-damage",
    note: "Magic attack input; skill ratios and flat skill values still determine damage.",
  },
  pdef: {
    status: "simulator-supported",
    simulatorAttributeId: 105,
    use: "defensive-context",
    note: "Used as a target DEF input in outgoing-damage calculations; not a complete incoming player-damage model.",
  },
  mdef: {
    status: "simulator-supported",
    simulatorAttributeId: 106,
    use: "defensive-context",
    note: "Used as a target MDEF input in outgoing-damage calculations; not a complete incoming player-damage model.",
  },
  critDamagePercent: {
    status: "simulator-supported",
    simulatorAttributeId: 209,
    use: "outgoing-damage",
    note: "OCR requires an explicit percent sign and stores the displayed percentage number. The simulator consumes basis points (divide by 10000); conversion is ×100. The persisted OCR percentage is converted to simulator basis points and used as the corresponding simulator attribute.",
  },
  physicalDamageBonusPercent: {
    status: "simulator-supported",
    simulatorAttributeId: 211,
    use: "outgoing-damage",
    note: "OCR requires an explicit percent sign and stores the displayed percentage number. The adapter converts it to simulator basis points (×100); the current persisted field is used as the matching simulator attribute.",
  },
  magicDamageBonusPercent: {
    status: "simulator-supported",
    simulatorAttributeId: 213,
    use: "outgoing-damage",
    note: "OCR requires an explicit percent sign and stores the displayed percentage number. The simulator consumes basis points (divide by 10000); conversion is ×100. Aggregation/source semantics remain to be verified.",
  },
  damageIncreasePercent: {
    status: "simulator-supported",
    simulatorAttributeId: 215,
    use: "outgoing-damage",
    note: "OCR requires an explicit percent sign and stores the displayed percentage number. The simulator consumes basis points (divide by 10000); conversion is ×100. Aggregation/source semantics remain to be verified.",
  },
  damageVsDemiHuman: {
    status: "simulator-supported-unit-unverified",
    simulatorAttributeId: 402,
    use: "outgoing-damage",
    note: "Candidate race-specific modifier for Demi-Human target race ID 2; units and source aggregation require verification.",
  },
  damageVsMedium: {
    status: "simulator-supported-unit-unverified",
    simulatorAttributeId: 503,
    use: "outgoing-damage",
    note: "Candidate size-specific modifier for Medium target size ID 2; units and source aggregation require verification.",
  },
  physicalPenetrationPercent: {
    status: "not-modeled",
    use: "none",
    note: "Persisted, but not applied by the current outgoing-damage evaluator. Do not score as simulator-backed penetration.",
  },
  magicPenetrationPercent: {
    status: "not-modeled",
    use: "none",
    note: "Persisted, but not applied by the current outgoing-damage evaluator. Do not score as simulator-backed penetration.",
  },
  physicalDamageReductionPercent: {
    status: "not-modeled",
    use: "none",
    note: "No validated incoming physical damage evaluator.",
  },
  magicDamageReductionPercent: {
    status: "not-modeled",
    use: "none",
    note: "No validated incoming magic damage evaluator.",
  },
  damageReductionPercent: {
    status: "not-modeled",
    use: "none",
    note: "No validated incoming damage evaluator.",
  },
  critDamageReductionPercent: {
    status: "not-modeled",
    use: "none",
    note: "No validated incoming critical damage evaluator.",
  },
  damageReductionVsAllJob: {
    status: "not-modeled",
    use: "none",
    note: "Not modeled by the current outgoing-damage evaluator.",
  },
  damageReductionVsMedium: {
    status: "not-modeled",
    use: "none",
    note: "Not modeled by the current outgoing-damage evaluator.",
  },
  damageReductionVsDemiHuman: {
    status: "not-modeled",
    use: "none",
    note: "Not modeled by the current outgoing-damage evaluator.",
  },
  healingDonePercent: {
    status: "not-modeled",
    use: "none",
    note: "Healing output is outside the current damage evaluator.",
  },
  damageVsAllJob: {
    status: "not-modeled",
    use: "none",
    note: "No validated mapping to the simulator's current target bonus logic.",
  },
  bladeCrystal: {
    status: "not-modeled",
    use: "none",
    note: "Special Dish crystal effect is not represented in the persisted-field damage evaluator mapping.",
  },
  shieldCrystal: {
    status: "not-modeled",
    use: "none",
    note: "Special Dish crystal effect is not represented in the persisted-field damage evaluator mapping.",
  },
  manaCrystal: {
    status: "not-modeled",
    use: "none",
    note: "Special Dish crystal effect is not represented in the persisted-field damage evaluator mapping.",
  },
  magicDefCrystal: {
    status: "not-modeled",
    use: "none",
    note: "Special Dish crystal effect is not represented in the persisted-field damage evaluator mapping.",
  },
};

export function getRo3RawStatSupport(key: RO3StatKey): Ro3RawStatSupport {
  return RO3_RAW_STAT_SUPPORT[key] ?? {
    status: "not-modeled",
    use: "none",
    note: "No explicit simulator support mapping exists for this persisted stat.",
  };
}

export function isRo3RawStatEligibleForDamageCalibration(key: RO3StatKey): boolean {
  const support = getRo3RawStatSupport(key);
  return support.use === "outgoing-damage" && support.status === "simulator-supported";
}
