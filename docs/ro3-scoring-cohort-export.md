# RO3 scoring cohort export

This utility creates an anonymized CSV of persisted RO3 Tank/Support stat snapshots and calculates a Level 99 global defensive baseline from all Heimdall RO3 guilds.

## Run

From the repository root, with dependencies installed and `DATABASE_URL` pointing to the intended database:

```bash
npx tsx scripts/export-ro3-scoring-cohort.ts
```

By default, the CSV is written to `ro3-scoring-cohort.csv` and the baseline JSON to `ro3-scoring-baseline.json` in the repository root. To choose another CSV output path:

```bash
RO3_SCORING_EXPORT_PATH=/absolute/path/to/ro3-scoring-cohort.csv npx tsx scripts/export-ro3-scoring-cohort.ts
```

The query includes active, eligible members belonging to RO3 guilds whose job is Archbishop, Royal Guard (Tank), or Rune Knight (Tank), with a non-null `ro3Stats` snapshot. DPS-labelled Royal Guard and Rune Knight characters are excluded. It exports only the stored job label and numeric values for the canonical RO3 stat fields. It does not select or export member IDs, Discord IDs, character names, guild IDs, or guild names.

## Handling

- Run against the intended production or representative dataset only when authorized.
- Review the CSV before sharing it.
- Do not include guild/member identifiers or add identity columns to the export.
- The baseline JSON records reference level 99, qualifying character count, separate PDEF/MDEF sample counts, and the arithmetic mean of each stat using only non-null values. PDEF and MDEF averages are calculated independently so a missing value in one field does not discard a valid value in the other. The exporter does not calculate or change scoring weights.
- Keep the cohort export private and share it only for the requested calibration analysis.
