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


## Raw-stat capability boundary

`src/lib/ro3-combat-simulator/raw-stat-support.ts` records the current persisted-field to simulator-attribute evidence map. It distinguishes directly supported core attack inputs, candidate percentage modifiers whose capture units still need verification, defensive context fields, and fields not modeled by the evaluator.

The registry is intentionally not a normalization formula. In particular:
- PATK and MATK are the only currently direct outgoing-damage inputs marked eligible for immediate damage calibration.
- Physical/magic damage bonus, general damage increase, critical damage, Demi-Human and Medium bonuses remain blocked pending capture-unit and aggregation verification.
- Penetration and damage-reduction fields are not credited as simulator-backed because the current evaluator does not apply them.
- PDEF, MDEF and HP are defensive context only; this is not an incoming player-damage evaluator.

The raw-stat registry tests assert that every persisted field has an explicit classification and that unsupported or semantics-unverified fields cannot silently become calibration inputs. At this stage, only direct PATK/MATK fields are eligible for offensive damage calibration.


## Persisted profile → simulator attribute adapter

`src/lib/ro3-combat-simulator/persisted-stat-adapter.ts` now converts only fields with a defensible unit mapping:
- HP, PATK, MATK, PDEF and MDEF pass through as numeric attributes 101, 103, 104, 105 and 106.
- OCR percentage fields 209, 211, 213 and 215 are stored as displayed percentage numbers because the OCR parser requires a literal percent sign and strips it (for example, `12.5%` becomes `12.5`). The simulator consumes basis points divided by 10000, so the adapter converts `12.5` to `1250`.
- Penetration, reductions, target bonuses with unverified capture semantics, healing, and crystals are excluded with an explicit reason.

This verifies the display-unit conversion path, not the game-side aggregation/source semantics of those bonuses. The adapter is a safe input-preparation layer only; it does not call the simulator, calculate DPS, or assign member scores.
