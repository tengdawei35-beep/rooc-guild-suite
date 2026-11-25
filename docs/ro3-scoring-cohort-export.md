# RO3 scoring cohort export

This utility creates an anonymized CSV of persisted RO3 stat snapshots for offline scoring calibration.

## Run

From the repository root, with dependencies installed and `DATABASE_URL` pointing to the intended database:

```bash
npx tsx scripts/export-ro3-scoring-cohort.ts
```

By default, the file is written to `ro3-scoring-cohort.csv` in the repository root. To choose another output path:

```bash
RO3_SCORING_EXPORT_PATH=/absolute/path/to/ro3-scoring-cohort.csv npx tsx scripts/export-ro3-scoring-cohort.ts
```

The query includes active guild members belonging to RO3 guilds with a non-null `ro3Stats` snapshot. It exports only the stored job label and numeric values for the canonical RO3 stat fields. It does not select or export member IDs, Discord IDs, character names, guild IDs, or guild names.

## Handling

- Run against the intended production or representative dataset only when authorized.
- Review the CSV before sharing it.
- Do not include guild/member identifiers or add identity columns to the export.
- The output contains raw persisted stat values; it does not calculate or change scoring weights.
- Keep the cohort export private and share it only for the requested calibration analysis.
