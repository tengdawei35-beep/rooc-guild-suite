/*
  Warnings:

  - You are about to drop the column `name` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `partySize` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `playerCapacity` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `EventParticipation` table. All the data in the column will be lost.
  - You are about to drop the column `battlefieldId` on the `Raid` table. All the data in the column will be lost.
  - You are about to drop the column `sortOrder` on the `Raid` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `RosterMember` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `RosterMember` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `RosterMember` table. All the data in the column will be lost.
  - You are about to drop the `Applicant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Battlefield` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Party` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[guildId,type,date]` on the table `Event` will be added. If there are existing duplicate values, this will fail.

*/

-- CreateEnum
CREATE TYPE "RosterGenerationMode" AS ENUM ('MANUAL', 'AUTOMATIC');

-- DropForeignKey
ALTER TABLE "Applicant" DROP CONSTRAINT "Applicant_guildId_fkey";

-- DropForeignKey
ALTER TABLE "Battlefield" DROP CONSTRAINT "Battlefield_eventId_fkey";

-- DropForeignKey
ALTER TABLE "Party" DROP CONSTRAINT "Party_battlefieldId_fkey";

-- DropForeignKey
ALTER TABLE "Party" DROP CONSTRAINT "Party_raidId_fkey";

-- DropForeignKey
ALTER TABLE "Raid" DROP CONSTRAINT "Raid_battlefieldId_fkey";

-- DropForeignKey
ALTER TABLE "RosterMember" DROP CONSTRAINT "RosterMember_partyId_fkey";

-- DropIndex
DROP INDEX "BidSlot_memberId_idx";

-- DropIndex
DROP INDEX "BidSlot_resourceId_idx";

-- DropIndex
DROP INDEX "Event_guildId_date_idx";

-- DropIndex
DROP INDEX "Event_type_idx";

-- DropIndex
DROP INDEX "EventParticipation_status_idx";

-- DropIndex
DROP INDEX "Raid_battlefieldId_idx";

-- AlterTable
ALTER TABLE "AllocationRun" ADD COLUMN     "eventId" TEXT;

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "name",
DROP COLUMN "partySize",
DROP COLUMN "playerCapacity",
DROP COLUMN "status";

-- AlterTable
ALTER TABLE "EventParticipation" DROP COLUMN "status",
ADD COLUMN     "available" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Raid" DROP COLUMN "battlefieldId",
DROP COLUMN "sortOrder";

-- AlterTable
ALTER TABLE "RosterMember" DROP COLUMN "role",
DROP COLUMN "source",
DROP COLUMN "updatedAt";

-- DropTable
DROP TABLE "Applicant";

-- DropTable
DROP TABLE "Battlefield";

-- CreateEnum
CREATE TYPE "Battlefield" AS ENUM ('BATTLEFIELD_1', 'BATTLEFIELD_2');

-- DropTable
DROP TABLE "Party";

-- DropEnum
DROP TYPE "EventStatus";

-- DropEnum
DROP TYPE "ParticipationStatus";

-- DropEnum
DROP TYPE "RosterRole";

-- DropEnum
DROP TYPE "RosterSource";

-- CreateTable
CREATE TABLE "Roster" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "generationMode" "RosterGenerationMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Roster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterParty" (
    "id" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "partyNumber" INTEGER NOT NULL,
    "battlefield" "Battlefield" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaidParty" (
    "id" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaidParty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Roster_eventId_idx" ON "Roster"("eventId");

-- CreateIndex
CREATE INDEX "RosterParty_rosterId_idx" ON "RosterParty"("rosterId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterParty_rosterId_battlefield_partyNumber_key" ON "RosterParty"("rosterId", "battlefield", "partyNumber");

-- CreateIndex
CREATE INDEX "RaidParty_raidId_idx" ON "RaidParty"("raidId");

-- CreateIndex
CREATE INDEX "RaidParty_partyId_idx" ON "RaidParty"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "RaidParty_raidId_partyId_key" ON "RaidParty"("raidId", "partyId");

-- CreateIndex
CREATE INDEX "AllocationRun_eventId_idx" ON "AllocationRun"("eventId");

-- CreateIndex
CREATE INDEX "Event_date_idx" ON "Event"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Event_guildId_type_date_key" ON "Event"("guildId", "type", "date");

-- AddForeignKey
ALTER TABLE "AllocationRun" ADD CONSTRAINT "AllocationRun_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roster" ADD CONSTRAINT "Roster_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterParty" ADD CONSTRAINT "RosterParty_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterMember" ADD CONSTRAINT "RosterMember_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "RosterParty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidParty" ADD CONSTRAINT "RaidParty_raidId_fkey" FOREIGN KEY ("raidId") REFERENCES "Raid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidParty" ADD CONSTRAINT "RaidParty_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "RosterParty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
