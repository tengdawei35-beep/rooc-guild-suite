ALTER TABLE "RosterMember"
ADD COLUMN "tankPercentile" DOUBLE PRECISION,
ADD COLUMN "dpsPercentile" DOUBLE PRECISION,
ADD COLUMN "pvpPercentile" DOUBLE PRECISION;

-- ------------------------------------------------------------
-- Backfill existing roster records.
--
-- Percentiles are calculated using the same percentile
-- definition already used by the roster generator:
--
-- unique sorted values
-- count values strictly below target
-- divide by unique_count - 1
-- multiply by 100
--
-- We calculate each category independently.
-- ------------------------------------------------------------

WITH tank_values AS (
  SELECT DISTINCT "tankScore" AS value
  FROM "RosterMember"
),
tank_ranked AS (
  SELECT
    value,
    COUNT(*) OVER (
      ORDER BY value
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS lower_count,
    COUNT(*) OVER () AS total_count
  FROM tank_values
),
tank_percentiles AS (
  SELECT
    value,
    CASE
      WHEN total_count <= 1 THEN 100
      ELSE
        (lower_count::DOUBLE PRECISION /
          (total_count - 1)::DOUBLE PRECISION) * 100
    END AS percentile
  FROM tank_ranked
)
UPDATE "RosterMember" rm
SET "tankPercentile" = tp.percentile
FROM tank_percentiles tp
WHERE rm."tankScore" = tp.value;


WITH dps_values AS (
  SELECT DISTINCT "dpsScore" AS value
  FROM "RosterMember"
),
dps_ranked AS (
  SELECT
    value,
    COUNT(*) OVER (
      ORDER BY value
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS lower_count,
    COUNT(*) OVER () AS total_count
  FROM dps_values
),
dps_percentiles AS (
  SELECT
    value,
    CASE
      WHEN total_count <= 1 THEN 100
      ELSE
        (lower_count::DOUBLE PRECISION /
          (total_count - 1)::DOUBLE PRECISION) * 100
    END AS percentile
  FROM dps_ranked
)
UPDATE "RosterMember" rm
SET "dpsPercentile" = dp.percentile
FROM dps_percentiles dp
WHERE rm."dpsScore" = dp.value;


WITH pvp_values AS (
  SELECT DISTINCT "pvpScore" AS value
  FROM "RosterMember"
),
pvp_ranked AS (
  SELECT
    value,
    COUNT(*) OVER (
      ORDER BY value
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS lower_count,
    COUNT(*) OVER () AS total_count
  FROM pvp_values
),
pvp_percentiles AS (
  SELECT
    value,
    CASE
      WHEN total_count <= 1 THEN 100
      ELSE
        (lower_count::DOUBLE PRECISION /
          (total_count - 1)::DOUBLE PRECISION) * 100
    END AS percentile
  FROM pvp_ranked
)
UPDATE "RosterMember" rm
SET "pvpPercentile" = pp.percentile
FROM pvp_percentiles pp
WHERE rm."pvpScore" = pp.value;


-- ------------------------------------------------------------
-- Make the new snapshot fields required after backfill.
-- ------------------------------------------------------------

ALTER TABLE "RosterMember"
ALTER COLUMN "tankPercentile" SET NOT NULL,
ALTER COLUMN "dpsPercentile" SET NOT NULL,
ALTER COLUMN "pvpPercentile" SET NOT NULL;