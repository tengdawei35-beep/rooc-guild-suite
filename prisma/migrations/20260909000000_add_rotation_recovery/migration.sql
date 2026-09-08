CREATE TABLE "RotationRecovery" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "sourceRunId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotationRecovery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RotationRecovery_sourceRunId_memberId_resourceId_key"
ON "RotationRecovery"("sourceRunId", "memberId", "resourceId");

CREATE INDEX "RotationRecovery_guildId_idx"
ON "RotationRecovery"("guildId");

CREATE INDEX "RotationRecovery_memberId_idx"
ON "RotationRecovery"("memberId");

CREATE INDEX "RotationRecovery_resourceId_idx"
ON "RotationRecovery"("resourceId");

CREATE INDEX "RotationRecovery_sourceRunId_idx"
ON "RotationRecovery"("sourceRunId");

CREATE INDEX "RotationRecovery_consumedAt_idx"
ON "RotationRecovery"("consumedAt");

ALTER TABLE "RotationRecovery"
ADD CONSTRAINT "RotationRecovery_guildId_fkey"
FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RotationRecovery"
ADD CONSTRAINT "RotationRecovery_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "GuildMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RotationRecovery"
ADD CONSTRAINT "RotationRecovery_resourceId_fkey"
FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RotationRecovery"
ADD CONSTRAINT "RotationRecovery_sourceRunId_fkey"
FOREIGN KEY ("sourceRunId") REFERENCES "AllocationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
