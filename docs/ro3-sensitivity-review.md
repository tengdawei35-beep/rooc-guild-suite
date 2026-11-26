# RO3 sensitivity review — engineering evidence

Status: **experimental / not approved for live scoring**. The embedded simulator is the authoritative calculation model for current engineering; live-game validation is not required as a gate.

This review records the output of CI run #438 on simulator engine fingerprint
`095c4c5e73b28306839093015cb3451e43e147189ba954a552ab4c41848fb76b`.
The report uses synthetic profiles and synthetic probe skills only. No production
cohort, member record, or persisted score was read.

## Fixed reference scenario

- Attacker and defender: Level 99.
- Physical and magic probe attack: 10,000 PATK / MATK.
- Defender: PDEF 1,980 and MDEF 1,980, race ID 2 (Demi-Human), size ID 2 (Medium).
- The evaluator's current mitigation term produces 50% damage at this equal-level,
  1,980 defence reference point.
- Probe skill: one 100% ratio hit, no flat damage, guaranteed hit, no critical chance,
  no active buffs/cards/totems/bond adjustments.
- Baseline damage: 5,000 for both channels.

These values exist to expose the evaluator's response to controlled changes; they
are not recommended character baselines or claims about actual in-game damage.

## Measured results

| Probe | Baseline | Changed | Damage delta |
|---|---:|---:|---:|
| PATK +10% (physical) | 5,000 | 5,500 | +10.00% |
| MATK +10% (magic) | 5,000 | 5,500 | +10.00% |
| Physical Damage +10 percentage points (211) | 5,000 | 5,500 | +10.00% |
| Magic Damage +10 percentage points (213) | 5,000 | 5,500 | +10.00% |
| General Damage +10 percentage points (215), physical | 5,000 | 5,500 | +10.00% |
| General Damage +10 percentage points (215), magic | 5,000 | 5,500 | +10.00% |
| Demi-Human target bonus +10 percentage points (402) | 5,000 | 5,500 | +10.00% |
| Medium target bonus +10 percentage points (503) | 5,000 | 5,500 | +10.00% |
| Critical Damage +1,000 bp (209), guaranteed physical critical | 7,500 | 8,000 | +6.67% |
| Target PDEF reduced 10% | 5,000 | 5,263 | +5.26% |
| Target MDEF reduced 10% | 5,000 | 5,263 | +5.26% |

### Overlapping damage bonus check

- Physical Damage +10 points plus General Damage +10 points: 5,000 → 6,000 (+20%).
- Magic Damage +10 points plus General Damage +10 points: 5,000 → 6,000 (+20%).

The evaluator adds these values into one sheet-bonus bracket. They are additive
within that bracket, not multiplicative (which would have produced +21%). This
is a statement about the current simulator implementation, not proof of the
game's complete live damage-bracket rules.

## What this supports

1. **PATK and MATK:** direct, linear attack inputs in the current evaluator.
   Their persisted-to-simulator mappings (103 / 104) are eligible for further
   offensive scoring engineering. This does not by itself define a fair class
   comparison or a final score weight.
2. **Physical Damage (211), Magic Damage (213), General Damage (215):** the
   evaluator responds linearly in the isolated probes and combines channel
   damage plus General Damage additively. OCR display-unit conversion is
   implemented, but source-screen aggregation semantics are still unverified.
   Keep these fields blocked from live calibration until their capture and
   aggregation semantics are checked against actual character screens.
3. **Demi-Human (402) and Medium (503):** the simulator routes them to the
   matching defender race/size IDs and responds linearly in this probe.
   Persisted units and aggregation/source semantics are unverified. Keep them
   blocked from live calibration.
4. **PDEF / MDEF (105 / 106):** the evaluator uses these as target mitigation
   inputs. This establishes a defensive effect on outgoing damage *against a
   target*. It does not establish a player's own defensive score or their
   survival against player damage. Do not treat these as a Tank score input
   based on this harness.

## What remains unsupported or unverified

- Penetration (physical/magic): not applied by the current evaluator.
- Incoming physical/magic/general reduction, critical damage reduction, and
  race/size/job-specific damage reduction: no validated incoming player-damage
  evaluator.
- HP: defensive context only here; no survival, healing, shield, or time-to-kill
  model is measured.
- Critical damage (209): a separate guaranteed-physical-critical probe now
  measures 7,500 → 8,000 (+6.67%) for +1,000 bp. This is consistent with the
  evaluator's 1.5x critical base and its (15,000 + 209) / 15,000 critical
  modifier. Persisted source/aggregation semantics remain unverified, so the
  field is still blocked from live calibration.
- Element, skill-specific, ranged/melee, buffs, pet/totem, cards, and class
  effects: not covered by these isolated probes.
- The evaluator contains inferred assumptions, including its DEF formula and
  damage-bracket interpretation. Sensitivity tests do not validate those
  assumptions against the live game.

## Calibration decision

Do not derive final DPS weights or Tank/PvP scores from these results. They show
that several inputs move the current evaluator as expected, not how much each
stat should matter across classes or builds. Continue with:
- a separate controlled critical-damage probe;
- actual game/source verification for persisted percentage and target-bonus
  fields;
- further deterministic paired-scenario sensitivity against the embedded simulator, using verified persisted-field mappings;
- an incoming player-damage evaluator before Tank/PvP calibration.

Do not run a production cohort export at this stage because the RO3 database does not yet contain a meaningful sample. The user has approved the future fixed defensive baseline cohort (eligible Archbishop, Royal Guard (Tank), and Rune Knight (Tank) across all Heimdall RO3 guilds).
