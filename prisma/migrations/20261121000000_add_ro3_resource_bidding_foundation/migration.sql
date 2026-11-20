-- RO3 resource bidding is modelled independently from the legacy ROOC resource engine.
CREATE TYPE "Ro3ResourceCategory" AS ENUM ('CARD', 'EQUIPMENT', 'ECHO');
CREATE TYPE "Ro3SeasonStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "Ro3OptInCapMode" AS ENUM ('TOTAL', 'PER_CATEGORY');
CREATE TYPE "Ro3QueueEntryStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "Ro3AllocationStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

ALTER TYPE "EventType" ADD VALUE 'RO3_CUSTOM';

ALTER TABLE "Event" ADD COLUMN "ro3EventTypeId" TEXT;
DROP INDEX IF EXISTS "Event_guildId_type_date_key";

CREATE TABLE "Ro3Season" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "Ro3SeasonStatus" NOT NULL DEFAULT 'DRAFT',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "capMode" "Ro3OptInCapMode" NOT NULL DEFAULT 'TOTAL',
  "totalOptInCap" INTEGER,
  "cardOptInCap" INTEGER,
  "equipmentOptInCap" INTEGER,
  "echoOptInCap" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Ro3Season_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Ro3Season_totalOptInCap_check" CHECK ("totalOptInCap" IS NULL OR "totalOptInCap" >= 0),
  CONSTRAINT "Ro3Season_cardOptInCap_check" CHECK ("cardOptInCap" IS NULL OR "cardOptInCap" >= 0),
  CONSTRAINT "Ro3Season_equipmentOptInCap_check" CHECK ("equipmentOptInCap" IS NULL OR "equipmentOptInCap" >= 0),
  CONSTRAINT "Ro3Season_echoOptInCap_check" CHECK ("echoOptInCap" IS NULL OR "echoOptInCap" >= 0),
  CONSTRAINT "Ro3Season_date_range_check" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" >= "startsAt")
);

CREATE TABLE "Ro3SeasonResource" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "Ro3ResourceCategory" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Ro3SeasonResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ro3EventType" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Ro3EventType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ro3EventRewardPool" (
  "id" TEXT NOT NULL,
  "eventTypeId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Ro3EventRewardPool_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Ro3EventRewardPool_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "Ro3EventReward" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Ro3EventReward_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Ro3EventReward_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "Ro3PersistentInterest" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Ro3PersistentInterest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Ro3PersistentInterest_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "Ro3EventOptIn" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Ro3EventOptIn_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Ro3EventOptIn_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "Ro3ResourceRotation" (
  "id" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "initializedAt" TIMESTAMP(3),
  "initializedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Ro3ResourceRotation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ro3ResourceQueueEntry" (
  "id" TEXT NOT NULL,
  "rotationId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "status" "Ro3QueueEntryStatus" NOT NULL DEFAULT 'ACTIVE',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Ro3ResourceQueueEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Ro3ResourceQueueEntry_position_check" CHECK ("position" >= 0)
);

CREATE TABLE "Ro3AllocationRun" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "status" "Ro3AllocationStatus" NOT NULL DEFAULT 'RUNNING',
  "errorMessage" TEXT,
  "rotationSnapshotBefore" JSONB,
  "rotationSnapshotAfter" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "Ro3AllocationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ro3AllocationResult" (
  "id" TEXT NOT NULL,
  "allocationRunId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Ro3AllocationResult_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Ro3AllocationResult_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "Ro3AllocationResourceResult" (
  "id" TEXT NOT NULL,
  "allocationRunId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "totalQuantity" INTEGER NOT NULL,
  "allocatedQuantity" INTEGER NOT NULL,
  "unallocatedQuantity" INTEGER NOT NULL,
  CONSTRAINT "Ro3AllocationResourceResult_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Ro3AllocationResourceResult_quantity_check" CHECK (
    "totalQuantity" >= 0 AND "allocatedQuantity" >= 0 AND "unallocatedQuantity" >= 0
    AND "allocatedQuantity" + "unallocatedQuantity" = "totalQuantity"
  )
);

CREATE UNIQUE INDEX "Ro3Season_guildId_name_key" ON "Ro3Season"("guildId", "name");
CREATE INDEX "Ro3Season_guildId_status_idx" ON "Ro3Season"("guildId", "status");
CREATE UNIQUE INDEX "Ro3Season_one_active_per_guild_key" ON "Ro3Season"("guildId") WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "Ro3SeasonResource_seasonId_name_key" ON "Ro3SeasonResource"("seasonId", "name");
CREATE INDEX "Ro3SeasonResource_seasonId_category_idx" ON "Ro3SeasonResource"("seasonId", "category");
CREATE INDEX "Ro3SeasonResource_seasonId_active_idx" ON "Ro3SeasonResource"("seasonId", "active");

CREATE UNIQUE INDEX "Ro3EventType_seasonId_name_key" ON "Ro3EventType"("seasonId", "name");
CREATE INDEX "Ro3EventType_guildId_idx" ON "Ro3EventType"("guildId");
CREATE INDEX "Ro3EventType_seasonId_active_idx" ON "Ro3EventType"("seasonId", "active");

CREATE UNIQUE INDEX "Ro3EventRewardPool_eventTypeId_resourceId_key" ON "Ro3EventRewardPool"("eventTypeId", "resourceId");
CREATE INDEX "Ro3EventRewardPool_resourceId_idx" ON "Ro3EventRewardPool"("resourceId");
CREATE UNIQUE INDEX "Ro3EventReward_eventId_resourceId_key" ON "Ro3EventReward"("eventId", "resourceId");
CREATE INDEX "Ro3EventReward_resourceId_idx" ON "Ro3EventReward"("resourceId");

CREATE UNIQUE INDEX "Ro3PersistentInterest_memberId_resourceId_key" ON "Ro3PersistentInterest"("memberId", "resourceId");
CREATE INDEX "Ro3PersistentInterest_resourceId_active_idx" ON "Ro3PersistentInterest"("resourceId", "active");
CREATE UNIQUE INDEX "Ro3EventOptIn_eventId_memberId_resourceId_key" ON "Ro3EventOptIn"("eventId", "memberId", "resourceId");
CREATE INDEX "Ro3EventOptIn_eventId_resourceId_idx" ON "Ro3EventOptIn"("eventId", "resourceId");
CREATE INDEX "Ro3EventOptIn_memberId_idx" ON "Ro3EventOptIn"("memberId");

CREATE UNIQUE INDEX "Ro3ResourceRotation_resourceId_key" ON "Ro3ResourceRotation"("resourceId");
CREATE UNIQUE INDEX "Ro3ResourceQueueEntry_rotationId_memberId_key" ON "Ro3ResourceQueueEntry"("rotationId", "memberId");
CREATE INDEX "Ro3ResourceQueueEntry_rotationId_status_position_idx" ON "Ro3ResourceQueueEntry"("rotationId", "status", "position");
CREATE INDEX "Ro3ResourceQueueEntry_memberId_idx" ON "Ro3ResourceQueueEntry"("memberId");

CREATE UNIQUE INDEX "Ro3AllocationRun_eventId_key" ON "Ro3AllocationRun"("eventId");
CREATE INDEX "Ro3AllocationRun_seasonId_createdAt_idx" ON "Ro3AllocationRun"("seasonId", "createdAt");
CREATE UNIQUE INDEX "Ro3AllocationResult_allocationRunId_memberId_resourceId_key" ON "Ro3AllocationResult"("allocationRunId", "memberId", "resourceId");
CREATE INDEX "Ro3AllocationResult_memberId_idx" ON "Ro3AllocationResult"("memberId");
CREATE INDEX "Ro3AllocationResult_resourceId_idx" ON "Ro3AllocationResult"("resourceId");
CREATE UNIQUE INDEX "Ro3AllocationResourceResult_allocationRunId_resourceId_key" ON "Ro3AllocationResourceResult"("allocationRunId", "resourceId");
CREATE INDEX "Ro3AllocationResourceResult_resourceId_idx" ON "Ro3AllocationResourceResult"("resourceId");

CREATE INDEX "Event_ro3EventTypeId_idx" ON "Event"("ro3EventTypeId");
CREATE UNIQUE INDEX "Event_guildId_type_date_rooc_key" ON "Event"("guildId", "type", "date") WHERE "ro3EventTypeId" IS NULL;
CREATE UNIQUE INDEX "Event_guildId_ro3EventTypeId_date_key" ON "Event"("guildId", "ro3EventTypeId", "date") WHERE "ro3EventTypeId" IS NOT NULL;

ALTER TABLE "Ro3Season" ADD CONSTRAINT "Ro3Season_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ro3SeasonResource" ADD CONSTRAINT "Ro3SeasonResource_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Ro3Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ro3EventType" ADD CONSTRAINT "Ro3EventType_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ro3EventType" ADD CONSTRAINT "Ro3EventType_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Ro3Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ro3EventRewardPool" ADD CONSTRAINT "Ro3EventRewardPool_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "Ro3EventType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ro3EventRewardPool" ADD CONSTRAINT "Ro3EventRewardPool_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Ro3SeasonResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ro3EventReward" ADD CONSTRAINT "Ro3EventReward_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ro3EventReward" ADD CONSTRAINT "Ro3EventReward_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Ro3SeasonResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ro3PersistentInterest" ADD CONSTRAINT "Ro3PersistentInterest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GuildMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ro3PersistentInterest" ADD CONSTRAINT "Ro3PersistentInterest_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Ro3SeasonResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ro3EventOptIn" ADD CONSTRAINT "Ro3EventOptIn_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ro3EventOptIn" ADD CONSTRAINT "Ro3EventOptIn_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GuildMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ro3EventOptIn" ADD CONSTRAINT "Ro3EventOptIn_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Ro3SeasonResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ro3ResourceRotation" ADD CONSTRAINT "Ro3ResourceRotation_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Ro3SeasonResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ro3ResourceQueueEntry" ADD CONSTRAINT "Ro3ResourceQueueEntry_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "Ro3ResourceRotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ro3ResourceQueueEntry" ADD CONSTRAINT "Ro3ResourceQueueEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GuildMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ro3AllocationRun" ADD CONSTRAINT "Ro3AllocationRun_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Ro3Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ro3AllocationRun" ADD CONSTRAINT "Ro3AllocationRun_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ro3AllocationResult" ADD CONSTRAINT "Ro3AllocationResult_allocationRunId_fkey" FOREIGN KEY ("allocationRunId") REFERENCES "Ro3AllocationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ro3AllocationResult" ADD CONSTRAINT "Ro3AllocationResult_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GuildMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ro3AllocationResult" ADD CONSTRAINT "Ro3AllocationResult_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Ro3SeasonResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ro3AllocationResourceResult" ADD CONSTRAINT "Ro3AllocationResourceResult_allocationRunId_fkey" FOREIGN KEY ("allocationRunId") REFERENCES "Ro3AllocationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ro3AllocationResourceResult" ADD CONSTRAINT "Ro3AllocationResourceResult_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Ro3SeasonResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_ro3EventTypeId_fkey" FOREIGN KEY ("ro3EventTypeId") REFERENCES "Ro3EventType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
