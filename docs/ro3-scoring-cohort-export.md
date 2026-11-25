# RO3 scoring cohort exports

These utilities create anonymized calibration inputs from persisted RO3 member snapshots. They do not calculate member scores or publish rankings.

## Tank/Support defensive baseline

Run from the repository root with dependencies installed and `DATABASE_URL` pointing to the intended database:

```bash
npx tsx scripts/export-ro3-scoring-cohort.ts
```

By default, this writes `ro3-scoring-cohort.csv` and `ro3-scoring-baseline.json`. Override paths with `RO3_SCORING_EXPORT_PATH` and `RO3_SCORING_BASELINE_PATH`.

The cohort includes active Archbishop, Royal Guard (Tank), and Rune Knight (Tank) characters across all RO3 guilds. It calculates independent average PDEF and MDEF values for the Level 99 defensive reference. DPS-labelled RG/RK and unsuffixed legacy hybrid jobs are excluded.

## Full scoring calibration cohort

Run:

```bash
npm run export:ro3-calibration
```

By default, this writes `ro3-calibration-cohort.csv` and `ro3-calibration-distribution.json`. Override paths with `RO3_CALIBRATION_EXPORT_PATH` and `RO3_CALIBRATION_SUMMARY_PATH`.

This export includes active members across all RO3 guilds whose jobs are explicitly recognized by the RO3 scoring model and who have a persisted `ro3Stats` snapshot. It groups Warlock as Magic DPS, other recognized DPS jobs as Physical DPS, and Archbishop/Tank-labelled jobs as Tank/Support. Legacy unsuffixed Royal Guard/Rune Knight records are excluded until a manager explicitly classifies them.

The CSV contains only job/archetype labels and numeric stat values. The JSON summary contains per-archetype and per-job character counts, field coverage, and interpolated P10/P50/P90 distributions. Neither output selects or exports member IDs, Discord IDs, character names, guild IDs, or guild names.

## Handling and calibration guardrails

- Run against the intended production or representative dataset only when authorized.
- Review the CSV and JSON before sharing them; keep exports private.
- These percentiles describe the captured cohort. They are calibration inputs, not dynamic scoring baselines and must not cause scores to move when the population changes.
- Do not map fields into simulator attributes until source-screen semantics and units are confirmed.
- Missing values are left blank and excluded from each field's sample; they are never treated as zero.
- Neither exporter writes to the database, updates member scores, or changes rankings.
- The exports are anonymized at query time: no member, Discord, character, or guild identifiers are selected.
