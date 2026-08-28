/*
  Warnings:

  - Added the required column `dpsScore` to the `RosterMember` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guildPercentile` to the `RosterMember` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pvpScore` to the `RosterMember` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tankScore` to the `RosterMember` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "RosterMember_partyId_memberId_key";

-- ============================================================
-- Add ranking snapshot columns as nullable first
-- ============================================================

ALTER TABLE "RosterMember"
ADD COLUMN "guildPercentile" DOUBLE PRECISION,
ADD COLUMN "tankScore" DOUBLE PRECISION,
ADD COLUMN "dpsScore" DOUBLE PRECISION,
ADD COLUMN "pvpScore" DOUBLE PRECISION;

-- ============================================================
-- Backfill existing roster assignments
-- ============================================================
--
-- Existing roster records predate the ranking snapshot.
-- We do not have a historical percentile snapshot for them,
-- so initialize them to 0 rather than pretending we know
-- their historical ranking.
--

UPDATE "RosterMember"
SET
  "guildPercentile" = 0,
  "tankScore" = 0,
  "dpsScore" = 0,
  "pvpScore" = 0
WHERE
  "guildPercentile" IS NULL
  OR "tankScore" IS NULL
  OR "dpsScore" IS NULL
  OR "pvpScore" IS NULL;

-- ============================================================
-- Make ranking snapshots required for future roster members
-- ============================================================

ALTER TABLE "RosterMember"
ALTER COLUMN "guildPercentile" SET NOT NULL,
ALTER COLUMN "tankScore" SET NOT NULL,
ALTER COLUMN "dpsScore" SET NOT NULL,
ALTER COLUMN "pvpScore" SET NOT NULL;
