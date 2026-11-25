# RO3 simulator sensitivity harness

Status: engineering validation only. This is not a production calibration, final scoring model, or in-game formula validation.

## Reproducibility

- Harness: `src/lib/ro3-combat-simulator/sensitivity-harness.ts`
- Tests: `src/lib/ro3-combat-simulator/sensitivity-harness.test.ts`
- The harness extracts the generated engine between `@@ENGINE-BEGIN` and `@@ENGINE-END` in `ro3-damage-sim.html`, then imports that exact source as an ES module.
- Every report includes the SHA-256 fingerprint of the extracted engine region. A changed engine produces a different fingerprint.
- Both attacker and defender are fixed at Level 99.

## Reference scenario

The physical and magic reference profiles are synthetic controlled fixtures with fixed PATK/MATK and no active buffs, cards, totems, bond bonuses, or crit chance. A one-hit 100% ratio probe skill is used for each channel. The defender is fixed at PDEF 1,980, MDEF 1,980, element 1, Demi-Human race (2), and Medium size (2).

These are deliberately controlled test values, not observed character builds, class averages, or recommended baselines. The skill rows are synthetic probes, not named in-game skills.

## Measurements

The harness performs one-at-a-time probes for:

- PATK (103) and MATK (104), each increased by 10%.
- Physical Damage (211), Magic Damage (213), and General Damage (215), each increased by 1,000 basis points.
- Demi-Human (402) and Medium (503) target bonuses, each increased by 1,000 basis points.
- Target PDEF/MDEF, each reduced by 10%, reported separately from attacker stats.
- Overlapping Physical/Magic Damage and General Damage bonuses to verify their combined treatment in the current evaluator.

The current evaluator adds the applicable sheet damage bonuses into one bracket before applying its multiplier. Therefore, +10 percentage points in the channel-specific damage attribute plus +10 percentage points in General Damage should yield approximately +20% together, subject to integer rounding, rather than multiplicative +21%.

## Guardrails

- No production database access, cohort export, member identifiers, or persisted member scores are used.
- The +10% and +1,000 bp probes are controlled engineering deltas, not P10–P90 population ranges.
- Penetration is not measured because the current evaluator does not implement it.
- Incoming damage reduction, complete Tank scoring, and PvP scoring are not measured by this outgoing-damage harness.
- OCR-to-simulator unit conversion does not prove source-screen aggregation semantics. The four percentage fields remain gated from live calibration until those semantics are confirmed.
- The simulator contains inferred assumptions; passing these tests validates deterministic behavior against the current embedded evaluator, not equivalence with live game combat.

Run with `npm run test:ro3-scoring`.
