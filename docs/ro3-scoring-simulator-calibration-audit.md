# RO3 scoring calibration audit — simulator and persisted-stat coverage

Status: simulator-authoritative working model. For current RO3 damage-derived scoring work, the embedded Heimdall damage simulator is the source of truth until explicitly superseded by a later simulator revision or product decision. This is an engineering authority decision, not a claim that the simulator has been independently verified against live-game combat.

## Executive finding

The current RO3 damage simulator can support a defensible, sensitivity-derived **offensive DPS** model for a subset of persisted stats. It cannot, by itself, derive a complete Tank or PvP score from every field currently stored by Heimdall.

Use the simulator as the authoritative calculation model for the mechanics it implements. Build and compare offensive scoring inputs against its outputs without requiring separate in-game damage samples first. Fields and mechanics the simulator does not implement remain unsupported: do not invent penetration, incoming-damage reduction, complete Tank or PvP calculations.

## Simulator formula audit

The relevant implementation is `evaluateSkillDamage()` in `src/lib/ro3-combat-simulator/ro3-damage-sim.html`.

The damage path, simplified from the implementation, is:

1. Select physical or magic attack and the skill's own ratio/flat component.
2. Apply the target DEF/MDEF mitigation:
   `1 - DEF / (DEF + 20 * attackerLevel)`.
3. Apply the elemental matchup factor.
4. Apply the supported damage bonus bracket:
   - General Damage Increase (attribute 215)
   - Physical Damage Increase (211) and melee/ranged physical damage (227/229), or Magic Damage Increase (213)
   - Applicable target element/race/size bonus
5. Apply the simulator's separate buff layer (12xx attributes), crit handling and modeled totem/bond adjustments.

The simulator explicitly documents some assumptions as inferred or incomplete. These assumptions must remain visible in any scoring calibration report.

## Persisted RO3 stat coverage

The whitelist below is the current `RO3_STAT_FIELDS` registry in `src/lib/constants/ro3-stats.ts`. A field is eligible for calibration only if it is persisted in `ro3Stats`; simulator-only inputs and unpersisted build details must not leak into the score.

| Persisted field | Simulator relationship | Calibration status |
| --- | --- | --- |
| `patk` | Physical attack attribute 103; direct input to physical skill damage | Supported for Physical DPS |
| `matk` | Magic attack attribute 104; direct input to magic skill damage | Supported for Magic DPS |
| `physicalDamageBonusPercent` | Closest mapping is P.DMG attribute 211; simulator also has separate melee/ranged attributes 227/229 | Partially supported; confirm capture semantics before mapping |
| `magicDamageBonusPercent` | M.DMG attribute 213 | Supported for Magic DPS, subject to capture semantics |
| `damageIncreasePercent` | General damage increase attribute 215 | Supported for both DPS channels |
| `critDamagePercent` | Crit damage attribute 209; applied to physical critical hits in the evaluator | Supported only for physical crit-capable profiles; critical rate is not persisted |
| `damageVsDemiHuman` | Demi-Human is race ID 2 in simulator; target bonus uses attribute 402 | Supported only if the stored field has the same bonus semantics and units |
| `damageVsMedium` | Medium is size ID 2; target bonus uses attribute 503 | Supported only if the stored field has the same bonus semantics and units |
| `hp` | Attribute 101; used in parts of simulator/totem calculations, but not a direct outgoing-damage multiplier | Not an offensive DPS weight; potential Tank input only |
| `pdef` / `mdef` | Attributes 105/106; used as the target's DEF/MDEF in outgoing damage mitigation | Can calibrate how much these values reduce damage when the member is the target; does not constitute a full incoming-damage model |
| `physicalPenetrationPercent` / `magicPenetrationPercent` | No corresponding penetration term appears in the current `evaluateSkillDamage()` formula | Unsupported by this simulator version; exclude rather than guess |
| `physicalDamageReductionPercent` / `magicDamageReductionPercent` / `damageReductionPercent` | No incoming-player damage calculation consumes these fields in `evaluateSkillDamage()` | Unsupported for Tank/PvP until an incoming-damage evaluator exists |
| `critDamageReductionPercent` | No corresponding defender-side critical mitigation term in the evaluator | Unsupported for Tank/PvP |
| `damageVsAllJob` | No All Job modifier is applied by the current target-bonus function | Unsupported by this simulator version |
| `damageReductionVsAllJob` | No matching defender-side term | Unsupported |
| `damageReductionVsMedium` / `damageReductionVsDemiHuman` | No matching defender-side terms | Unsupported |
| `healingDonePercent` | The evaluator models damage skills, not healing output | Unsupported for this damage-derived score |
| `bladeCrystal` / `shieldCrystal` / `manaCrystal` / `magicDefCrystal` | These are Special Dish capture fields, not direct inputs to the current damage evaluator | Exclude unless a documented simulator formula consumes them |

### Important distinctions

- The simulator's target-bonus function applies bonuses against a target's **race, element and size**. Its race ordering is Brute (1), Demi-Human (2), Demon (3), Plant (4), Undead (5), Formless (6), Fish (7), Angel (8), Insect (9), Dragon (10). Demi-Human therefore maps to race attribute 402, not to a generic PvP or All Job modifier.
- Medium maps to size attribute 503.
- The current stored schema has aggregate fields such as `physicalDamageBonusPercent`, while the simulator separates P.DMG from melee/ranged P.DMG. Do not assume the aggregate field represents every simulator bracket.
- The simulator's damage formula does not currently use the persisted penetration fields. Their existence in the database is not evidence that the simulator models them. Under the current authority decision, this means penetration is excluded until the simulator itself implements it.
- The current damage evaluator is an outgoing-skill calculator. It does not provide a complete model for a player receiving physical/magic/PvP damage. A Tank score cannot be fully calibrated from it.

## Calibration method under the simulator-authoritative decision

Use simulator sensitivity over the real persisted-stat distribution, not arbitrary percentage-point bumps.

1. Build a calibration cohort from persisted RO3 member snapshots, split into Physical DPS, Magic DPS and any other valid archetypes. Do not synthesize missing stats.
2. For each supported stat, measure its observed P10–P90 range in the cohort. Exclude a stat from that cohort if there is insufficient coverage.
3. Create representative simulator scenarios using the same stored profile as the baseline. Hold skill multipliers, skill ratios, passive skill setup, temporary buffs and all unpersisted inputs constant between paired runs. These inputs may be used only to define a fixed scenario, never as scoring features.
4. Change one eligible persisted stat from P10 to P90 while holding other inputs constant; calculate the change in expected damage per cast / DPS. Repeat across multiple profiles, skill archetypes and target matchups.
5. Use permutation-averaged (Shapley-style) attribution or a grouped factorial method for stats that share a damage bracket, so overlapping modifiers are not naively counted twice.
6. Average contributions across the defined scenario mix, normalize the positive contributions to 100%, and publish the scenario mix, cohort date, sample count, coverage and formula version alongside the weights.
7. Keep unsupported fields out of the calibrated model. Do not redistribute their presumed value into a placeholder category.

A single percentage-point increase is not a fair comparison between PATK, a damage bonus and a target-specific modifier. P10–P90 deltas give each field a cohort-grounded and unit-aware test range.

## Category feasibility

| Category | Current feasibility | Reason |
| --- | --- | --- |
| Physical DPS | Partial | PATK and selected damage modifiers can be tested; penetration is not implemented in the current formula; skill/target scenarios affect marginal contributions |
| Magic DPS | Partial | MATK and magic/general damage modifiers can be tested; penetration is not implemented; crit damage is not part of the current magic damage path |
| Tank | Not yet calibratable as a complete score | HP and target DEF can be evaluated in limited ways, but no full incoming-damage pipeline consumes stored reduction/crit-resistance fields |
| PvP | Not yet calibratable as a complete score | All Job and defender-side PvP reductions are not modeled; current simulator scenarios are not a complete player-vs-player damage model |

## Required next inputs / engineering work

- When meaningful persisted profile data becomes available, calculate P10/P50/P90 ranges and field coverage; do not export sparse/empty production data merely to fill the gap.
- Treat the current simulator's formula, data tables and generated engine fingerprint as the authoritative calculation contract. Pin each scoring revision to that engine fingerprint.
- Use deterministic paired simulator scenarios to measure supported persisted inputs and interactions. Do not require separate live-game samples as a gate for using the current simulator model.
- Keep unsupported fields out of the score. Tank/PvP components that require incoming-damage mechanics remain unavailable until the simulator implements those mechanics.

## Guardrails

- This audit does not change the existing preliminary scoring function or rankings.
- Do not assign provisional weights to unsupported fields.
- Preserve the simulator's inferred-formula caveats in any user-facing score explanation.
- Version every published calibration and retain the inputs/scenario mix needed to reproduce it.
