# Proposed RO3 member scoring model (v1 proposal)

These are proposed starting weights for guild comparison, not official game ratings. Keep weights versioned and editable after playtesting. Calculate from the latest valid RO3 stat submission and display each component.

## Scoring method

Normalize each stat to 0–100 using configurable reference ranges or percentile ranks within the selected comparison cohort. For guild leaderboards, prefer percentile normalization within the same guild and role archetype. Winsorize outliers at the 5th/95th percentile, then apply weights. Missing stats are excluded and remaining weights proportionally rebalanced; never silently treat missing values as zero.

For higher-is-better stats, higher values score better. For defensive stats, higher defence/reduction scores better. Offensive/defensive counterpart pairs (for example Damage vs Medium and Damage Reduction vs Medium) belong to different score categories; do not add both sides into one score.

## DPS score

| Component | Weight | Included stats |
| --- | ---: | --- |
| Attack power | 25% | PATK, MATK (use class/skill profile to select or blend channel) |
| Penetration | 20% | Physical penetration / ignore PDEF, magic penetration / ignore MDEF |
| Damage amplification | 20% | Physical or magic damage bonus, all-damage increase |
| Target bonuses | 15% | Damage vs Medium, Small, Demi-human, Brute, and supported target types |
| Critical output | 10% | Crit rate and crit damage |
| Accuracy / tempo | 10% | HIT and ASPD |

## Tank score

| Component | Weight | Included stats |
| --- | ---: | --- |
| Effective health | 25% | HP |
| Physical / magic defence | 20% | PDEF, MDEF |
| Damage reduction | 25% | Physical, magic, and general damage reduction |
| PvP survivability | 20% | PvP damage reduction, damage reduction vs Demi-human |
| Critical resilience | 10% | Critical damage reduction / critical resistance |

## PvP score

| Component | Weight | Included stats |
| --- | ---: | --- |
| PvP damage output | 20% | PvP damage bonus |
| PvP survivability | 20% | PvP damage reduction |
| Penetration | 15% | Ignore PDEF / MDEF and penetration |
| General damage amplification | 15% | Physical/magic damage bonus and general damage increase |
| Demi-human matchup | 15% | Damage vs Demi-human |
| Durability | 10% | HP and defensive stats |
| Critical performance | 5% | Crit chance, crit damage, critical damage reduction |

## Guardrails

- Use class and role archetypes when choosing PATK vs MATK and physical vs magic penetration. A universal blended score can mis-rank specialized builds.
- Avoid double-counting overlapping fields. Verify damage bonus brackets before scoring both general and specialized bonuses.
- The upstream simulator does not fully model PvP effects, healing, shields, and some Divine Totem effects. PvP score is a stat-readiness score, not simulated win probability.
- Keep score versions (for example `RO3_DPS_V1`) with weight definitions and normalization ranges. Store the version with every computed score so historic rankings remain explainable.
- Calibrate weights against real guild performance data before presenting them as predictive.
