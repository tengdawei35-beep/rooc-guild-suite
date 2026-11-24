# RO3 member scoring model — preliminary v1

These weights are an intentionally provisional starting point for relative build comparison. They are not official game ratings or predictions of match outcomes. Revisit after validating the imported simulator against in-game tests.

## Scoring method

Normalize each stat family to 0–100 using documented reference ranges or percentile ranks within the selected comparison cohort. Prefer comparisons within the same role/archetype. Winsorize extreme outliers where percentile normalization is used. The implementation accepts normalized component scores, excludes missing components, and proportionally rebalances the remaining weights. It never silently treats missing values as zero.

Physical DPS uses PATK and physical penetration; Magic DPS uses MATK and magic penetration. Do not blend attack channels for the default role score. The skill/build profile determines whether critical output is relevant.

## DPS weights

| Component | Non-crit build | Crit-capable build | Included stats |
| --- | ---: | ---: | --- |
| Attack power | 30% | 25% | PATK for physical; MATK for magic |
| Penetration | 25% | 20% | Physical penetration / ignore PDEF; magic penetration / ignore MDEF |
| Damage amplification | 25% | 25% | Applicable physical/magic and general damage bonuses |
| Target bonuses | 20% | 20% | Supported size, race and elemental matchup bonuses |
| Critical output | — | 10% | Critical rate and critical damage, only when the selected build supports critical hits |
| **Total** | **100%** | **100%** | |

HIT and ASPD are deliberately excluded from this score. Critical output is not part of the non-crit baseline and must not be inferred from a character's job alone; use the selected skill/build's actual critical capability.

## Tank weights

| Component | Weight | Included stats |
| --- | ---: | --- |
| Effective health | 25% | HP |
| Defence | 20% | PDEF and MDEF, evaluated against relevant damage channels |
| Damage reduction | 30% | Physical, magic and general damage reduction |
| PvP survivability | 15% | PvP damage reduction and supported Demi-human reduction |
| Critical resilience | 10% | Critical resistance / critical damage mitigation where applicable |
| **Total** | **100%** | |

## PvP readiness weights

| Component | Weight | Included stats |
| --- | ---: | --- |
| PvP damage output | 25% | PvP damage bonus |
| Penetration | 15% | Relevant physical/magic penetration |
| General damage amplification | 15% | Applicable physical/magic and general damage bonuses |
| Target bonuses | 10% | Relevant Demi-human, size and elemental bonuses |
| PvP survivability | 20% | PvP damage reduction |
| General durability | 15% | HP and relevant defence |
| **Total** | **100%** | |

PvP readiness is a stat-based comparison, not a simulated win probability. The upstream simulator does not fully model all PvP effects, healing, shields, or some Divine Totem effects.

## Guardrails and implementation notes

- The code model is versioned as `RO3_PRELIMINARY_V1` in `src/lib/ro3-combat-simulator/scoring.ts`.
- The score function accepts normalized 0–100 component values, returns the applied weights and per-component contributions, and rebalances weights when inputs are missing.
- Do not include HIT or ASPD in any of these preliminary score categories.
- Do not include critical output in a build that cannot crit with its selected damage skills.
- Avoid double-counting overlapping bonus brackets. Verify whether general and specialized bonuses are additive, multiplicative, conditional, or mutually exclusive before combining them.
- Penetration weights are provisional. The currently imported evaluator's visible defence formula uses PDEF/MDEF mitigation and does not establish a simple flat penetration subtraction. Validate actual penetration and penetration-defence behavior before treating these weights as calibrated.
- The simulator has inferred and unsupported effects. Display an estimate disclaimer and preserve upstream attribution.
- Keep historic score versions attached to computed scores so rankings remain explainable when weights change.
