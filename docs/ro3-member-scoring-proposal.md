# RO3 member scoring model — implementation v2 composition rules

This document defines the score composition rules implemented in `src/lib/ro3-combat-simulator/scoring.ts`. Scores are estimates for build comparison, not official game ratings or predictions of match outcomes.

## Score composition

The composition engine accepts normalized component scores (0–100). It does not normalize raw stat values or invent stat caps. The conversion from stored member stats into normalized components requires a separately validated, versioned reference-scenario model; until that exists, the composition layer must not be represented as a fully live-calibrated score.

## DPS score

Physical DPS and Magic DPS are separate categories. The default non-critical weighting is:

| Component | Weight |
| --- | ---: |
| Attack power | 30% |
| Penetration | 25% |
| Damage amplification | 25% |
| Target bonuses | 20% |
| **Total** | **100%** |

A critical-capable build can opt into the alternate 25/20/25/20/10 split, but critical output must not be enabled merely from the job name. The caller must establish that the selected build/skill supports critical hits and supply a normalized critical-output component.

Missing DPS components are excluded and the remaining available weights are proportionally rebalanced.

## Tank score

HP has a permanent 5% allocation. The remaining defensive components share 95%, preserving the same relative 30:25:25:20 proportions as the non-critical DPS score:

| Component | Weight |
| --- | ---: |
| HP | **5% fixed** |
| Defence | 28.50% |
| Damage reduction | 23.75% |
| PvP survivability | 23.75% |
| Critical resilience | 19.00% |
| **Total** | **100%** |

HP is mandatory for a Tank score because its 5% allocation is permanent. If HP is missing, the Tank score is unavailable; its weight is not redistributed. Missing defensive components are excluded and the remaining defensive weights are normalized within the 95% defensive allocation.

## PvP score

| Job category | DPS contribution | Tank contribution |
| --- | ---: | ---: |
| DPS jobs | **60%** | **40%** |
| Archbishop | 0% | **100%** |

A DPS PvP score is unavailable unless both its DPS score and Tank score are available. Archbishop PvP uses Tank score only and does not require a DPS score.

Current RO3 DPS job classification in the implementation is Mechanic, Royal Guard, Rune Knight, Warlock, Ranger, and Guillotine Cross. Archbishop is Tank-only for PvP composition. Warlock defaults to Magic DPS; other DPS jobs default to Physical DPS. Callers may explicitly provide the DPS category where a build requires it.

## Live and scheduled calculation boundary

The composition functions are pure and deterministic, so they can be called by a live update handler or a scheduled batch job without changing the score rules. However, this PR does not claim raw-stat-to-component normalization or database persistence is complete. That requires fixed, game-validated reference scenarios and confirmed handling for penetration, defensive reductions, and target bonuses. The stored stat snapshot and the visible outgoing-damage evaluator do not yet establish every defensive/PvP term needed for a defensible live score.

Do not substitute current guild percentiles or population-relative ranks for fixed reference scenarios: a member's score must not change merely because other members join or update their stats.

## Guardrails

- Version: `RO3_MEMBER_V2`.
- The engine accepts normalized 0–100 component scores only.
- Missing DPS components are reweighted among available DPS components.
- Tank HP remains fixed at 5%; missing HP makes Tank unavailable.
- Missing defensive components are reweighted only within the remaining 95%.
- PvP requires all applicable underlying scores; it does not silently replace missing values with zero.
- HIT and ASPD are excluded.
- Do not include unsupported effects, skill multipliers, buffs, or passives as member-stat features.
