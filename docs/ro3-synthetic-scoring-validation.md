# RO3 synthetic scoring validation

Status: experimental composition validation only.

## Purpose

The live Heimdall database does not yet contain a meaningful RO3 population for statistical calibration. These deterministic synthetic fixtures let engineering validate the existing score-composition layer without querying or changing production data.

## Run

```bash
npm run test:ro3-scoring
```

The command runs both the core composition tests and `scoring.synthetic.test.ts`.

## What is covered

- Reproducibility: identical normalized inputs produce identical results.
- Bounds: scores remain in the documented 0–100 component range.
- Monotonicity: increasing an included normalized DPS component cannot reduce the composed score.
- Role routing: Warlock selects Magic DPS and PvP composition remains deterministic.
- Missing-data behaviour: missing components are reported, not fabricated.
- Input isolation: unrelated raw-stat-shaped properties do not affect the normalized-component API.

## What is deliberately not covered

- These fixture values are already-normalized component scores, not PATK/MATK/PDEF/MDEF or other raw character stats.
- The fixtures do not establish raw-stat normalization, class parity, real-world score distributions, or calibrated weights.
- They do not validate simulator-to-persisted-field mappings or the semantics/units of aggregate bonus fields.
- They do not validate Tank/PvP incoming-damage mechanics.
- No fixture is a real member, a production baseline, or a ranking.

## Next calibration gate

Raw-stat calibration must wait until the simulator's supported inputs can be mapped to persisted fields with verified units and deterministic paired scenarios. Population-derived distributions and defensive baselines must wait until the real cohort is sufficiently populated. Until those gates are met, keep member scores experimental and do not publish them as authoritative rankings.
