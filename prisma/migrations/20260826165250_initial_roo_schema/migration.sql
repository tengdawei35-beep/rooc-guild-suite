-- CreateEnum
CREATE TYPE "MemberPriority" AS ENUM ('LEADER', 'OFFICER', 'COUNCIL', 'MEMBER');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('FEATHER', 'CARD');

-- CreateEnum
CREATE TYPE "AllocationRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BidPageType" AS ENUM ('FEATHER', 'CARD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildMember" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "eligible" BOOLEAN NOT NULL DEFAULT true,
    "priority" "MemberPriority" NOT NULL DEFAULT 'MEMBER',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "total" INTEGER NOT NULL,
    "perPlayerLimit" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservedAllocation" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservedAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotationState" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "rotationIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotationState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationRun" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "status" "AllocationRunStatus" NOT NULL DEFAULT 'RUNNING',
    "rotationIndexBefore" JSONB,
    "rotationIndexAfter" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AllocationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationResult" (
    "id" TEXT NOT NULL,
    "allocationRunId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "assignedQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllocationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceResult" (
    "id" TEXT NOT NULL,
    "allocationRunId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "reserved" INTEGER NOT NULL,
    "allocated" INTEGER NOT NULL,
    "overflow" INTEGER NOT NULL,

    CONSTRAINT "ResourceResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidPage" (
    "id" TEXT NOT NULL,
    "allocationRunId" TEXT NOT NULL,
    "type" "BidPageType" NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BidPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidSlot" (
    "id" TEXT NOT NULL,
    "bidPageId" TEXT NOT NULL,
    "slotNumber" INTEGER NOT NULL,
    "resourceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BidSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "Guild_discordGuildId_key" ON "Guild"("discordGuildId");

-- CreateIndex
CREATE INDEX "GuildMember_guildId_idx" ON "GuildMember"("guildId");

-- CreateIndex
CREATE INDEX "GuildMember_userId_idx" ON "GuildMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildMember_guildId_displayName_key" ON "GuildMember"("guildId", "displayName");

-- CreateIndex
CREATE INDEX "Resource_guildId_idx" ON "Resource"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_guildId_name_key" ON "Resource"("guildId", "name");

-- CreateIndex
CREATE INDEX "ReservedAllocation_guildId_idx" ON "ReservedAllocation"("guildId");

-- CreateIndex
CREATE INDEX "ReservedAllocation_memberId_idx" ON "ReservedAllocation"("memberId");

-- CreateIndex
CREATE INDEX "ReservedAllocation_resourceId_idx" ON "ReservedAllocation"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservedAllocation_guildId_memberId_resourceId_key" ON "ReservedAllocation"("guildId", "memberId", "resourceId");

-- CreateIndex
CREATE INDEX "RotationState_guildId_idx" ON "RotationState"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "RotationState_guildId_resourceId_key" ON "RotationState"("guildId", "resourceId");

-- CreateIndex
CREATE INDEX "AllocationRun_guildId_idx" ON "AllocationRun"("guildId");

-- CreateIndex
CREATE INDEX "AllocationRun_guildId_createdAt_idx" ON "AllocationRun"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "AllocationResult_allocationRunId_idx" ON "AllocationResult"("allocationRunId");

-- CreateIndex
CREATE INDEX "AllocationResult_memberId_idx" ON "AllocationResult"("memberId");

-- CreateIndex
CREATE INDEX "AllocationResult_resourceId_idx" ON "AllocationResult"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationResult_allocationRunId_memberId_resourceId_key" ON "AllocationResult"("allocationRunId", "memberId", "resourceId");

-- CreateIndex
CREATE INDEX "ResourceResult_allocationRunId_idx" ON "ResourceResult"("allocationRunId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceResult_allocationRunId_resourceId_key" ON "ResourceResult"("allocationRunId", "resourceId");

-- CreateIndex
CREATE INDEX "BidPage_allocationRunId_idx" ON "BidPage"("allocationRunId");

-- CreateIndex
CREATE UNIQUE INDEX "BidPage_allocationRunId_type_pageNumber_key" ON "BidPage"("allocationRunId", "type", "pageNumber");

-- CreateIndex
CREATE INDEX "BidSlot_bidPageId_idx" ON "BidSlot"("bidPageId");

-- CreateIndex
CREATE UNIQUE INDEX "BidSlot_bidPageId_slotNumber_key" ON "BidSlot"("bidPageId", "slotNumber");

-- AddForeignKey
ALTER TABLE "GuildMember" ADD CONSTRAINT "GuildMember_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildMember" ADD CONSTRAINT "GuildMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservedAllocation" ADD CONSTRAINT "ReservedAllocation_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservedAllocation" ADD CONSTRAINT "ReservedAllocation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GuildMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservedAllocation" ADD CONSTRAINT "ReservedAllocation_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotationState" ADD CONSTRAINT "RotationState_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotationState" ADD CONSTRAINT "RotationState_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationRun" ADD CONSTRAINT "AllocationRun_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationResult" ADD CONSTRAINT "AllocationResult_allocationRunId_fkey" FOREIGN KEY ("allocationRunId") REFERENCES "AllocationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationResult" ADD CONSTRAINT "AllocationResult_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GuildMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationResult" ADD CONSTRAINT "AllocationResult_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceResult" ADD CONSTRAINT "ResourceResult_allocationRunId_fkey" FOREIGN KEY ("allocationRunId") REFERENCES "AllocationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceResult" ADD CONSTRAINT "ResourceResult_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidPage" ADD CONSTRAINT "BidPage_allocationRunId_fkey" FOREIGN KEY ("allocationRunId") REFERENCES "AllocationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidSlot" ADD CONSTRAINT "BidSlot_bidPageId_fkey" FOREIGN KEY ("bidPageId") REFERENCES "BidPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidSlot" ADD CONSTRAINT "BidSlot_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidSlot" ADD CONSTRAINT "BidSlot_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GuildMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
