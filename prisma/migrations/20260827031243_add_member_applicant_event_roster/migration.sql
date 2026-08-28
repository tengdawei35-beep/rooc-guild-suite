-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('GUILD_LEAGUE', 'EMPERIUM_OVERRUN');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PLANNED', 'FINALIZED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RosterSource" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "ParticipationStatus" AS ENUM ('SELECTED', 'ATTENDED', 'ABSENT', 'EXCUSED');

-- CreateEnum
CREATE TYPE "RosterRole" AS ENUM ('HEALER', 'BARD_DANCER', 'SUPPORT', 'DPS');

-- AlterTable
ALTER TABLE "GuildMember" ADD COLUMN     "characterName" TEXT,
ADD COLUMN     "critRes" DOUBLE PRECISION,
ADD COLUMN     "damageReductionVsBrute" DOUBLE PRECISION,
ADD COLUMN     "damageReductionVsDemiHuman" DOUBLE PRECISION,
ADD COLUMN     "damageReductionVsMedium" DOUBLE PRECISION,
ADD COLUMN     "damageReductionVsSmall" DOUBLE PRECISION,
ADD COLUMN     "damageVsBrute" DOUBLE PRECISION,
ADD COLUMN     "damageVsDemiHuman" DOUBLE PRECISION,
ADD COLUMN     "damageVsMedium" DOUBLE PRECISION,
ADD COLUMN     "damageVsSmall" DOUBLE PRECISION,
ADD COLUMN     "equipmentMdefPercent" DOUBLE PRECISION,
ADD COLUMN     "equipmentPdefPercent" DOUBLE PRECISION,
ADD COLUMN     "hp" DOUBLE PRECISION,
ADD COLUMN     "ignoreMdef" DOUBLE PRECISION,
ADD COLUMN     "ignorePdef" DOUBLE PRECISION,
ADD COLUMN     "job" TEXT,
ADD COLUMN     "matk" DOUBLE PRECISION,
ADD COLUMN     "mdef" DOUBLE PRECISION,
ADD COLUMN     "mdmgPercent" DOUBLE PRECISION,
ADD COLUMN     "mdmgReductionPercent" DOUBLE PRECISION,
ADD COLUMN     "patk" DOUBLE PRECISION,
ADD COLUMN     "pdef" DOUBLE PRECISION,
ADD COLUMN     "pdmgPercent" DOUBLE PRECISION,
ADD COLUMN     "pdmgReductionPercent" DOUBLE PRECISION,
ADD COLUMN     "pvpDamageBonus" DOUBLE PRECISION,
ADD COLUMN     "pvpDamageReduction" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "MemberLeave" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberLeave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Applicant" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "discordId" TEXT,
    "characterName" TEXT NOT NULL,
    "job" TEXT,
    "applicationText" TEXT,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "pdef" DOUBLE PRECISION,
    "mdef" DOUBLE PRECISION,
    "pvpDamageBonus" DOUBLE PRECISION,
    "pvpDamageReduction" DOUBLE PRECISION,
    "pdmgPercent" DOUBLE PRECISION,
    "mdmgPercent" DOUBLE PRECISION,
    "pdmgReductionPercent" DOUBLE PRECISION,
    "mdmgReductionPercent" DOUBLE PRECISION,
    "critRes" DOUBLE PRECISION,
    "ignorePdef" DOUBLE PRECISION,
    "ignoreMdef" DOUBLE PRECISION,
    "damageVsMedium" DOUBLE PRECISION,
    "damageReductionVsMedium" DOUBLE PRECISION,
    "damageVsSmall" DOUBLE PRECISION,
    "damageReductionVsSmall" DOUBLE PRECISION,
    "damageVsDemiHuman" DOUBLE PRECISION,
    "damageReductionVsDemiHuman" DOUBLE PRECISION,
    "damageVsBrute" DOUBLE PRECISION,
    "damageReductionVsBrute" DOUBLE PRECISION,
    "equipmentPdefPercent" DOUBLE PRECISION,
    "equipmentMdefPercent" DOUBLE PRECISION,
    "patk" DOUBLE PRECISION,
    "matk" DOUBLE PRECISION,
    "hp" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Applicant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'PLANNED',
    "playerCapacity" INTEGER NOT NULL,
    "partySize" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Battlefield" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "battlefieldNumber" INTEGER NOT NULL,
    "name" TEXT,
    "playerCapacity" INTEGER NOT NULL,
    "partyCapacity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Battlefield_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Raid" (
    "id" TEXT NOT NULL,
    "battlefieldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Raid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "battlefieldId" TEXT NOT NULL,
    "raidId" TEXT,
    "partyNumber" INTEGER NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterMember" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "slotNumber" INTEGER NOT NULL,
    "source" "RosterSource" NOT NULL DEFAULT 'MANUAL',
    "role" "RosterRole",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventParticipation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "ParticipationStatus" NOT NULL DEFAULT 'SELECTED',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberLeave_memberId_idx" ON "MemberLeave"("memberId");

-- CreateIndex
CREATE INDEX "MemberLeave_date_idx" ON "MemberLeave"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MemberLeave_memberId_date_key" ON "MemberLeave"("memberId", "date");

-- CreateIndex
CREATE INDEX "Applicant_guildId_idx" ON "Applicant"("guildId");

-- CreateIndex
CREATE INDEX "Applicant_status_idx" ON "Applicant"("status");

-- CreateIndex
CREATE INDEX "Applicant_job_idx" ON "Applicant"("job");

-- CreateIndex
CREATE INDEX "Event_guildId_idx" ON "Event"("guildId");

-- CreateIndex
CREATE INDEX "Event_guildId_date_idx" ON "Event"("guildId", "date");

-- CreateIndex
CREATE INDEX "Event_type_idx" ON "Event"("type");

-- CreateIndex
CREATE INDEX "Battlefield_eventId_idx" ON "Battlefield"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Battlefield_eventId_battlefieldNumber_key" ON "Battlefield"("eventId", "battlefieldNumber");

-- CreateIndex
CREATE INDEX "Raid_battlefieldId_idx" ON "Raid"("battlefieldId");

-- CreateIndex
CREATE INDEX "Party_battlefieldId_idx" ON "Party"("battlefieldId");

-- CreateIndex
CREATE INDEX "Party_raidId_idx" ON "Party"("raidId");

-- CreateIndex
CREATE UNIQUE INDEX "Party_battlefieldId_partyNumber_key" ON "Party"("battlefieldId", "partyNumber");

-- CreateIndex
CREATE INDEX "RosterMember_partyId_idx" ON "RosterMember"("partyId");

-- CreateIndex
CREATE INDEX "RosterMember_memberId_idx" ON "RosterMember"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterMember_partyId_slotNumber_key" ON "RosterMember"("partyId", "slotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RosterMember_partyId_memberId_key" ON "RosterMember"("partyId", "memberId");

-- CreateIndex
CREATE INDEX "EventParticipation_eventId_idx" ON "EventParticipation"("eventId");

-- CreateIndex
CREATE INDEX "EventParticipation_memberId_idx" ON "EventParticipation"("memberId");

-- CreateIndex
CREATE INDEX "EventParticipation_status_idx" ON "EventParticipation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EventParticipation_eventId_memberId_key" ON "EventParticipation"("eventId", "memberId");

-- CreateIndex
CREATE INDEX "BidSlot_memberId_idx" ON "BidSlot"("memberId");

-- CreateIndex
CREATE INDEX "BidSlot_resourceId_idx" ON "BidSlot"("resourceId");

-- CreateIndex
CREATE INDEX "GuildMember_job_idx" ON "GuildMember"("job");

-- CreateIndex
CREATE INDEX "GuildMember_active_idx" ON "GuildMember"("active");

-- CreateIndex
CREATE INDEX "GuildMember_eligible_idx" ON "GuildMember"("eligible");

-- AddForeignKey
ALTER TABLE "MemberLeave" ADD CONSTRAINT "MemberLeave_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GuildMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battlefield" ADD CONSTRAINT "Battlefield_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Raid" ADD CONSTRAINT "Raid_battlefieldId_fkey" FOREIGN KEY ("battlefieldId") REFERENCES "Battlefield"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_battlefieldId_fkey" FOREIGN KEY ("battlefieldId") REFERENCES "Battlefield"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_raidId_fkey" FOREIGN KEY ("raidId") REFERENCES "Raid"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterMember" ADD CONSTRAINT "RosterMember_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterMember" ADD CONSTRAINT "RosterMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GuildMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipation" ADD CONSTRAINT "EventParticipation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipation" ADD CONSTRAINT "EventParticipation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GuildMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
